import { authClient } from '../lib/auth-client'
import type { SessionUser } from '../lib/auth-client'

export function useAuth() {
  const { data, isPending } = authClient.useSession()
  const user = (data?.user ?? null) as SessionUser | null
  return {
    user,
    isAdmin: user?.role === 'admin',
    isPending,
  }
}
