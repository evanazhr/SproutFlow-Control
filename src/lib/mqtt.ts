import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { env } from '../env'
import { deviceStatusSchema, pumpStatusSchema, telemetrySchema } from '../schemas/mqtt'

export type MqttStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export type MqttMessage =
  | ({ type: 'telemetry' } & {
      soil_moisture: number
      temperature: number
      humidity: number
      ts: number
    })
  | ({ type: 'pump_status' } & {
      pump_status: 'ON' | 'OFF'
      ts: number
      request_id?: string
    })
  | ({ type: 'status' } & { online: boolean })

type OnStatus = (status: MqttStatus) => void
type OnMessage = (message: MqttMessage) => void

let client: MqttClient | null = null
let statusListener: OnStatus | null = null
let messageHandler: OnMessage | null = null

function setStatus(status: MqttStatus) {
  statusListener?.(status)
}

function handleMessage(topic: string, payload: Uint8Array) {
  if (!messageHandler) return
  const [, , kind, sub] = topic.split('/')

  let json: unknown
  try {
    json = JSON.parse(new TextDecoder().decode(payload))
  } catch {
    console.warn(`[mqtt] payload bukan JSON valid: ${topic}`)
    return
  }

  if (kind === 'telemetry') {
    const parsed = telemetrySchema.safeParse(json)
    if (parsed.success) {
      messageHandler({
        type: 'telemetry',
        soil_moisture: parsed.data.soil_moisture,
        temperature: parsed.data.temperature,
        humidity: parsed.data.humidity,
        ts: parsed.data.ts,
      })
    } else {
      console.warn(`[mqtt] telemetry tidak valid: ${topic}`)
    }
  } else if (kind === 'pump' && sub === 'status') {
    const parsed = pumpStatusSchema.safeParse(json)
    if (parsed.success) {
      messageHandler({
        type: 'pump_status',
        pump_status: parsed.data.pump_status,
        ts: parsed.data.ts,
        request_id: parsed.data.request_id,
      })
    } else {
      console.warn(`[mqtt] pump/status tidak valid: ${topic}`)
    }
  } else if (kind === 'status') {
    const parsed = deviceStatusSchema.safeParse(json)
    if (parsed.success) {
      messageHandler({ type: 'status', online: parsed.data.online })
    } else {
      console.warn(`[mqtt] status tidak valid: ${topic}`)
    }
  }
}

/**
 * Koneksi singleton (dibuat setelah login; diputus saat logout).
 * Dipanggil ulang (mis. pindah halaman) tidak membuat koneksi baru.
 */
export function connectMqtt(onStatus: OnStatus, onMessage: OnMessage) {
  statusListener = onStatus
  messageHandler = onMessage
  if (client) {
    setStatus(client.connected ? 'connected' : 'connecting')
    return
  }

  client = mqtt.connect(env.VITE_MQTT_URL, {
    username: env.VITE_MQTT_USERNAME || undefined,
    password: env.VITE_MQTT_PASSWORD || undefined,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    clientId: `sproutflow-web-${Math.random().toString(16).slice(2, 10)}`,
  })

  const prefix = env.VITE_MQTT_TOPIC_PREFIX
  const deviceId = env.VITE_DEVICE_ID

  client.on('connect', () => {
    setStatus('connected')
    client?.subscribe(
      [
        `${prefix}/${deviceId}/telemetry`,
        `${prefix}/${deviceId}/pump/status`,
        `${prefix}/${deviceId}/status`,
      ],
      { qos: 1 },
    )
  })
  client.on('reconnect', () => setStatus('reconnecting'))
  client.on('close', () => setStatus('disconnected'))
  client.on('offline', () => setStatus('disconnected'))
  client.on('error', (err) => {
    console.warn(`[mqtt] ${err.message}`)
    setStatus('disconnected')
  })
  client.on('message', handleMessage)
}

export function disconnectMqtt() {
  const c = client
  client = null
  statusListener = null
  messageHandler = null
  if (c) {
    c.removeAllListeners()
    c.end(true)
  }
}
