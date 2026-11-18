import { createFileRoute, redirect } from '@tanstack/react-router'

// Aplikasi v1 langsung ke dashboard; guard auth ada di /dashboard.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})
