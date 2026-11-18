import type { ReactNode } from 'react'

/** Render children hanya untuk admin; selain itu tampilkan fallback (atau sembunyi). */
export default function RoleGate({
  isAdmin,
  fallback = null,
  children,
}: {
  isAdmin: boolean
  fallback?: ReactNode
  children: ReactNode
}) {
  return isAdmin ? <>{children}</> : <>{fallback}</>
}
