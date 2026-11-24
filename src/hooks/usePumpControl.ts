import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api } from '../lib/api'
import type { PumpCommand } from '../lib/api'
import { getPumpLiveState, usePumpLive } from '../lib/pumpLive'
import { toast } from '../lib/toast'

interface PendingCommand {
  command: PumpCommand
  /** Diisi dari respons POST /pump; dipakai untuk mencocokkan pump/status. */
  requestId: string | null
  /** Versi status live sebelum perintah dikirim, agar ack lama tidak diterima. */
  sinceVersion: number
}

const ACK_TIMEOUT_MS = 10_000

/**
 * Kirim perintah pompa dan tunggu konfirmasi lewat `pump_status` (MQTT).
 * Konfirmasi hanya diterima bila request_id cocok dengan perintah yang
 * dikirim. Tanpa konfirmasi dalam 10 detik → toast error.
 */
export function usePumpControl(deviceId: string) {
  const queryClient = useQueryClient()
  const live = usePumpLive(deviceId)
  const [pending, setPending] = useState<PendingCommand | null>(null)

  // Watchdog membaca state terbaru tanpa perlu di-reset saat request_id masuk.
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  const mutation = useMutation({
    mutationFn: (command: PumpCommand) => api.pump(deviceId, command),
    onSuccess: (res) => {
      const requestId = res.data.request_id
      setPending((current) => (current ? { ...current, requestId } : current))
      queryClient.invalidateQueries({ queryKey: ['pump-logs', deviceId] })
    },
    onError: (error) => {
      setPending(null)
      if (error instanceof ApiError) {
        if (error.code === 'FORBIDDEN') {
          toast.error('Anda tidak memiliki izin', 'Kontrol pompa hanya untuk admin.')
        } else if (error.code === 'RATE_LIMITED') {
          toast.error('Terlalu sering', 'Tunggu sebentar sebelum mengirim perintah lagi.')
        } else if (error.status === 0) {
          toast.error('Tidak dapat terhubung ke server', error.message)
        } else {
          toast.error('Perintah gagal dikirim', error.message)
        }
      }
    },
  })

  const send = useCallback(
    (command: PumpCommand) => {
      if (pending) return
      setPending({
        command,
        requestId: null,
        sinceVersion: getPumpLiveState(deviceId)?.version ?? 0,
      })
      mutation.mutate(command)
    },
    [pending, deviceId, mutation],
  )

  // Konfirmasi diterima: pump/status untuk request_id ini, setelah perintah dikirim.
  useEffect(() => {
    if (!pending?.requestId || !live) return
    if (live.version <= pending.sinceVersion) return
    if (live.status !== pending.command) return
    if (live.requestId && live.requestId !== pending.requestId) return

    setPending(null)
    // DB backend bisa tertinggal bila koneksi MQTT-nya putus saat konfirmasi.
    void queryClient.invalidateQueries({ queryKey: ['device', deviceId] })
    toast.success(
      pending.command === 'ON' ? 'Pompa menyala' : 'Pompa dimatikan',
      'Perangkat mengonfirmasi status pompa.',
    )
  }, [pending, live, deviceId, queryClient])

  // Watchdog 10 detik di sisi UI
  useEffect(() => {
    if (!pending?.command) return
    const timer = window.setTimeout(() => {
      const current = pendingRef.current
      if (!current) return
      toast.error(
        'Perangkat tidak merespons',
        `Perintah ${current.command} tidak dikonfirmasi dalam 10 detik.`,
      )
      void queryClient.invalidateQueries({ queryKey: ['device', deviceId] })
      setPending(null)
    }, ACK_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [pending?.command, deviceId, queryClient])

  return { pendingCommand: pending?.command ?? null, send, isSending: mutation.isPending }
}
