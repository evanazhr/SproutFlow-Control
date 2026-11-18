import { env } from '../env'

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface Meta {
  page: number
  limit: number
  total: number
}

export interface Envelope<T> {
  data: T
  meta?: Meta
}

async function request<T>(path: string, init?: RequestInit): Promise<Envelope<T>> {
  let res: Response
  try {
    res = await fetch(`${env.VITE_API_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke server')
  }

  if (res.ok) return (await res.json()) as Envelope<T>

  let code = 'INTERNAL_ERROR'
  let message = `Terjadi kesalahan (${res.status})`
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } }
    if (body.error) {
      code = body.error.code ?? code
      message = body.error.message ?? message
    }
  } catch {
    // body bukan JSON — pakai default
  }
  throw new ApiError(res.status, code, message)
}

// ===== Tipe respons API (kontrak PRD 3.4) =====

export type PumpCommand = 'ON' | 'OFF'
export type PumpLogStatus = 'sent' | 'confirmed' | 'timeout'

export interface LatestReading {
  soil_moisture: number
  temperature: number
  humidity: number
  recorded_at: string
}

export interface Device {
  id: string
  name: string
  online: boolean
  pump_status: PumpCommand
}

export interface DeviceDetail extends Device {
  latest: LatestReading | null
}

export interface Reading extends LatestReading {}

export interface PumpLog {
  id: string
  command: PumpCommand
  status: PumpLogStatus
  triggered_by: { type: 'user' | 'auto'; id?: string; name?: string }
  created_at: string
  confirmed_at: string | null
}

export interface DeviceSettings {
  device_id: string
  moisture_threshold: number
  pump_mode: PumpMode
  updated_at: string | null
}

export type PumpMode = 'auto' | 'manual'

export interface ReadingsParams {
  from?: string
  to?: string
  interval?: 'raw' | '5m' | '1h'
  page?: number
  limit?: number
}

export interface PumpLogsParams {
  from?: string
  to?: string
  page?: number
  limit?: number
}

function buildQuery(path: string, params: object) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

export const api = {
  device: (id: string) => request<DeviceDetail>(`/api/devices/${id}`),

  readings: (id: string, params: ReadingsParams) =>
    request<Reading[]>(buildQuery(`/api/devices/${id}/readings`, params)),

  pumpLogs: (id: string, params: PumpLogsParams) =>
    request<PumpLog[]>(buildQuery(`/api/devices/${id}/pump-logs`, params)),

  pump: (id: string, command: PumpCommand) =>
    request<{ request_id: string; command: string; status: string }>(
      `/api/devices/${id}/pump`,
      { method: 'POST', body: JSON.stringify({ command }) },
    ),

  settings: (id: string) => request<DeviceSettings>(`/api/devices/${id}/settings`),

  updateSettings: (id: string, moisture_threshold: number) =>
    request<DeviceSettings>(`/api/devices/${id}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ moisture_threshold }),
    }),

  updatePumpMode: (id: string, pump_mode: PumpMode) =>
    request<DeviceSettings>(`/api/devices/${id}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ pump_mode }),
    }),
}
