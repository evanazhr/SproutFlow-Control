import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, type PumpCommand } from '../lib/api'
import { toast } from '../lib/toast'
import { useDevice } from './useDevice'

/**
 * Kirim perintah pompa dan tunggu konfirmasi lewat `pump_status` (MQTT).
 * Tanpa konfirmasi dalam 10 detik → toast error.
 */
export function usePumpControl(deviceId: string) {
  const queryClient = useQueryClient()
  const device = useDevice(deviceId)
  const pumpStatus = device.data?.pump_status
  const [pendingCommand, setPendingCommand] = useState<PumpCommand | null>(null)

  const mutation = useMutation({
    mutationFn: (command: PumpCommand) => api.pump(deviceId, command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pump-logs', deviceId] })
    },
    onError: (error) => {
      setPendingCommand(null)
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
      if (pendingCommand) return
      setPendingCommand(command)
      mutation.mutate(command)
    },
    [pendingCommand, mutation],
  )

  // Konfirmasi diterima: pump_status berubah sesuai perintah
  useEffect(() => {
    if (pendingCommand && pumpStatus === pendingCommand) {
      setPendingCommand(null)
      toast.success(
        pendingCommand === 'ON' ? 'Pompa menyala' : 'Pompa dimatikan',
        'Perangkat mengonfirmasi status pompa.',
      )
    }
  }, [pendingCommand, pumpStatus])

  // Watchdog 10 detik di sisi UI
  useEffect(() => {
    if (!pendingCommand) return
    const timer = window.setTimeout(() => {
      setPendingCommand((current) => {
        if (current) {
          toast.error(
            'Perangkat tidak merespons',
            `Perintah ${current} tidak dikonfirmasi dalam 10 detik.`,
          )
        }
        return null
      })
    }, 10_000)
    return () => window.clearTimeout(timer)
  }, [pendingCommand])

  return { pendingCommand, send, isSending: mutation.isPending }
}
