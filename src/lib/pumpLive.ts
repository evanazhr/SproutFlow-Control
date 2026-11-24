import { useSyncExternalStore } from 'react'
import type { PumpCommand } from './api'

/**
 * Status pompa terkini hasil pesan MQTT `pump/status`.
 *
 * Disimpan terpisah dari cache TanStack Query karena query `device` di-refetch
 * tiap 30 detik dari REST. Kalau DB backend belum sempat diupdate (misalnya
 * koneksi MQTT backend putus saat konfirmasi), refetch itu bisa mengembalikan
 * status lama dan menimpa status realtime di UI.
 */
export interface PumpLiveState {
  status: PumpCommand
  requestId?: string
  ts: number
  /** Naik setiap kali pesan pump/status diterima; dipakai untuk membedakan ack lama. */
  version: number
}

const states = new Map<string, PumpLiveState>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function publishPumpStatus(
  deviceId: string,
  status: PumpCommand,
  ts: number,
  requestId?: string,
) {
  const prev = states.get(deviceId)
  states.set(deviceId, {
    status,
    requestId,
    ts,
    version: (prev?.version ?? 0) + 1,
  })
  emit()
}

export function getPumpLiveState(deviceId: string): PumpLiveState | null {
  return states.get(deviceId) ?? null
}

export function clearPumpLiveState(deviceId: string) {
  states.delete(deviceId)
  emit()
}

export function subscribePumpLive(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePumpLive(deviceId: string): PumpLiveState | null {
  return useSyncExternalStore(
    subscribePumpLive,
    () => getPumpLiveState(deviceId),
    () => null,
  )
}
