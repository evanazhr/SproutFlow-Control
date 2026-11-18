import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => api.device(deviceId),
    select: (res) => res.data,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: (failureCount, error) => {
      // Jangan retry 404 (perangkat belum di-seed)
      if ('status' in error && error.status === 404) return false
      return failureCount < 3
    },
  })
}
