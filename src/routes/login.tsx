import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { getSessionSafe, authClient } from '../lib/auth-client'

export const Route = createFileRoute('/login')({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSessionSafe()
    if (session?.user) throw redirect({ to: '/dashboard' })
  },
  component: LoginPage,
})

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.6.75 3.8 3.27 1.96 6.96l3.66 2.84C6.5 7.02 8.98 5.04 12 5.04Z"
      />
      <path
        fill="#4285F4"
        d="M23.25 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.77-2.4 3.68l3.68 2.85c2.15-1.99 3.5-4.92 3.5-8.77Z"
      />
      <path
        fill="#FBBC05"
        d="M5.62 14.2a7.06 7.06 0 0 1 0-4.4L1.96 6.96a11.26 11.26 0 0 0 0 10.08l3.66-2.84Z"
      />
      <path
        fill="#34A853"
        d="M12 23.25c3.04 0 5.6-1 7.46-2.72l-3.68-2.85c-1.02.69-2.33 1.1-3.78 1.1-3.02 0-5.5-1.98-6.38-4.58l-3.66 2.84c1.84 3.69 5.64 6.21 10.04 6.21Z"
      />
    </svg>
  )
}

function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = () => {
    setLoading(true)
    setError(null)
    authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/dashboard`,
      fetchOptions: {
        onError: (ctx) => {
          setError(ctx.error.message || 'Gagal memulai login. Coba lagi.')
          setLoading(false)
        },
      },
    })
  }

  return (
    <main className="login-center">
      <section className="login-shell rise-in">
        <svg className="login-logo" viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
          <path
            d="M12 21c-4.4 0-7.5-2.9-7.5-7 0-4.6 4.2-7.7 7.2-9.9a.6.6 0 0 1 .6 0c3 2.2 7.2 5.3 7.2 9.9 0 4.1-3.1 7-7.5 7Z"
            fill="var(--leaf-tint)"
            stroke="var(--leaf)"
            strokeWidth="1.5"
          />
          <path
            d="M12 21V9m0 4.5c1.8 0 3.2-1.4 3.2-3.2M12 15c-1.8 0-3.2-1.4-3.2-3.2"
            stroke="var(--leaf)"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <h1 className="login-title">Masuk ke SproutFlow</h1>
        <p className="login-desc">
          Pantau kelembapan tanah, suhu, dan kelembapan udara secara langsung — lalu siram
          tanamanmu lewat pompa.
        </p>

        <button type="button" className="login-google-btn" onClick={handleLogin} disabled={loading}>
          <GoogleIcon />
          {loading ? 'Menyiapkan Google…' : 'Masuk dengan Google'}
        </button>

        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="login-note">Hanya akun Google yang kamu daftarkan di server yang bisa masuk.</p>
      </section>
    </main>
  )
}
