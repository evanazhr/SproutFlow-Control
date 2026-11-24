import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Droplets, Thermometer, Wind, Sprout, Power, Settings2, LogOut } from 'lucide-react'
import { z } from 'zod'
import { useForm } from '@tanstack/react-form'
import ConnectionBadge from '../components/ConnectionBadge'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../hooks/useAuth'
import { useDevice } from '../hooks/useDevice'
import { clearLiveTelemetry, useLiveTelemetry } from '../lib/liveTelemetry'
import { useMqttTelemetry } from '../hooks/useMqttTelemetry'
import { usePumpControl } from '../hooks/usePumpControl'
import { ApiError, api } from '../lib/api'
import type { PumpCommand, PumpMode } from '../lib/api'
import { authClient, getSessionSafe } from '../lib/auth-client'
import { disconnectMqtt } from '../lib/mqtt'
import { clearPumpLiveState, usePumpLive } from '../lib/pumpLive'
import { toast } from '../lib/toast'
import { env } from '../env'

export const Route = createFileRoute('/')({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSessionSafe()
    if (!session?.user) throw redirect({ to: '/login' })
  },
  component: ControlPage,
})

const thresholdSchema = z.object({
  moisture_threshold: z
    .number('Ambang harus berupa angka')
    .int('Gunakan bilangan bulat')
    .min(0, 'Minimal 0')
    .max(100, 'Maksimal 100'),
})
const thresholdFieldSchema = thresholdSchema.shape.moisture_threshold

function fmt(n: number | null | undefined, digits = 0) {
  return n === null || n === undefined ? '—' : n.toFixed(digits)
}

function ControlPage() {
  const deviceId = env.VITE_DEVICE_ID
  const { user } = useAuth()
  const device = useDevice(deviceId)
  const { status, lastUpdated } = useMqttTelemetry(deviceId)
  const liveTelemetry = useLiveTelemetry(deviceId)
  const livePump = usePumpLive(deviceId)
  const { send } = usePumpControl(deviceId)
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)

  const settings = useQuery({
    queryKey: ['settings', deviceId],
    queryFn: () => api.settings(deviceId),
    select: (res) => res.data,
  })

  const saveMode = useMutation({
    mutationFn: (pump_mode: PumpMode) => api.updatePumpMode(deviceId, pump_mode),
    onSuccess: (res) => {
      queryClient.setQueryData(['settings', deviceId], res)
      toast.success(
        'Mode pompa diperbarui',
        res.data.pump_mode === 'auto' ? 'Pompa mengikuti ambang kelembapan.' : 'Pompa dikendalikan manual.',
      )
    },
    onError: (error) => {
      if (error instanceof ApiError) toast.error('Gagal menyimpan', error.message)
    },
  })

  const saveThreshold = useMutation({
    mutationFn: (moisture_threshold: number) => api.updateSettings(deviceId, moisture_threshold),
    onSuccess: (res) => {
      queryClient.setQueryData(['settings', deviceId], res)
      toast.success('Ambang tersimpan', `Ambang kelembapan ${res.data.moisture_threshold}%.`)
    },
    onError: (error) => {
      if (error instanceof ApiError) toast.error('Gagal menyimpan', error.message)
    },
  })

  const handleLogout = async () => {
    setSigningOut(true)
    try { await authClient.signOut() }
    finally {
      disconnectMqtt()
      clearPumpLiveState(deviceId)
      clearLiveTelemetry(deviceId)
      queryClient.clear()
      window.location.href = '/login'
    }
  }

  const data = device.data
  // Bacaan MQTT lebih baru daripada REST; refetch DB tidak menimpanya.
  const latest = liveTelemetry ?? data?.latest ?? null
  const offline = data ? !data.online : true
  // Status MQTT lebih segar daripada REST; refetch DB tidak boleh menimpanya.
  const pumpStatus: PumpCommand = livePump?.status ?? data?.pump_status ?? 'OFF'
  const pumpMode = settings.data?.pump_mode ?? 'auto'
  const threshold = settings.data?.moisture_threshold ?? 35
  const deviceError = device.isError ? (device.error instanceof Error ? device.error.message : 'Terjadi kesalahan.') : null

  return (
    <main className="control-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-dot" aria-hidden="true"><Sprout size={18} strokeWidth={2.2} /></span>
          <div>
            <p className="brand-name">SproutFlow</p>
            <p className="brand-sub">{data?.name ?? deviceId}</p>
          </div>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <span className={`status-pill ${offline ? 'is-offline' : 'is-online'}`}>
            <span className="status-pill-dot" aria-hidden="true" />
            {offline ? 'Offline' : 'Online'}
          </span>
          <button type="button" className="icon-btn" onClick={handleLogout} disabled={signingOut} aria-label="Keluar">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="control-body">
        {deviceError ? (
          <div className="inline-notice" role="status">
            <span>Perangkat belum terhubung. {deviceError}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void device.refetch()}>Coba lagi</button>
          </div>
        ) : null}

            <section className="panel pump-hero" aria-labelledby="pump-title">
              <div className="pump-hero-head">
                <div>
                  <p className="section-kicker">Kontrol pompa</p>
                  <h1 id="pump-title" className="pump-state">
                    {pumpStatus === 'ON' ? 'Pompa menyala' : 'Pompa mati'}
                  </h1>
                  <p className="pump-meta">
                    {pumpMode === 'auto'
                      ? `Mode otomatis · ambang ${threshold}%`
                      : 'Mode manual · kamu yang menentukan.'}
                  </p>
                </div>
                <div className={`pump-orb ${pumpStatus === 'ON' ? 'is-on' : ''}`} aria-hidden="true">
                  <Power size={28} strokeWidth={2.4} />
                </div>
              </div>

              <PumpAction
                pumpStatus={pumpStatus}
                pumpMode={pumpMode}
                onSend={send}
              />

              <div className="pump-foot">
                <ConnectionBadge status={status} lastUpdated={lastUpdated} />
              </div>
            </section>

            <section className="sensor-strip" aria-label="Status sensor ringkas">
              <SensorPill icon={<Droplets size={18} />} label="Tanah" value={fmt(latest?.soil_moisture)} unit="%" tone={toneForMoisture(latest?.soil_moisture ?? null, threshold)} loading={device.isLoading} />
              <SensorPill icon={<Thermometer size={18} />} label="Suhu" value={fmt(latest?.temperature, 1)} unit="°C" tone="warm" loading={device.isLoading} />
              <SensorPill icon={<Wind size={18} />} label="Udara" value={fmt(latest?.humidity)} unit="%" tone="cool" loading={device.isLoading} />
            </section>

            <section className="panel config-panel" aria-labelledby="config-title">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Konfigurasi</p>
                  <h2 id="config-title" className="section-title">Atur cara pompa bekerja</h2>
                </div>
                <Settings2 size={20} className="section-icon" aria-hidden="true" />
              </div>

              <div className="config-block">
                <p className="field-label">Mode pompa</p>
                <div className="mode-grid" role="group" aria-label="Mode pompa">
                  <button type="button" className={`mode-btn ${pumpMode === 'auto' ? 'is-active' : ''}`} disabled={saveMode.isPending} onClick={() => saveMode.mutate('auto')}>
                    <span className="mode-btn-title">Otomatis</span>
                    <span className="mode-btn-desc">Ikuti ambang kelembapan</span>
                  </button>
                  <button type="button" className={`mode-btn ${pumpMode === 'manual' ? 'is-active' : ''}`} disabled={saveMode.isPending} onClick={() => saveMode.mutate('manual')}>
                    <span className="mode-btn-title">Manual</span>
                    <span className="mode-btn-desc">Kontrol lewat tombol</span>
                  </button>
                </div>
              </div>

              <ThresholdForm
                key={settings.data?.updated_at ?? 'init'}
                initial={threshold}
                saving={saveThreshold.isPending}
                onSubmit={(value) => saveThreshold.mutateAsync(value)}
              />
            </section>

            <p className="signed-as">Masuk sebagai {user?.name ?? user?.email ?? 'pengguna'}</p>
      </div>
    </main>
  )
}

function toneForMoisture(value: number | null, threshold: number): 'dry' | 'ok' | 'cool' {
  if (value === null) return 'ok'
  if (value < threshold) return 'dry'
  return 'ok'
}

function SensorPill({ icon, label, value, unit, tone, loading }: { icon: React.ReactNode; label: string; value: string; unit: string; tone: 'dry' | 'ok' | 'cool' | 'warm'; loading: boolean }) {
  return (
    <div className={`sensor-pill tone-${tone}`}>
      <span className="sensor-pill-icon" aria-hidden="true">{icon}</span>
      <div className="sensor-pill-body">
        <p className="sensor-pill-label">{label}</p>
        {loading ? <span className="skel skel-inline" /> : <p className="sensor-pill-value">{value}<span className="sensor-pill-unit">{unit}</span></p>}
      </div>
    </div>
  )
}

function PumpAction({ pumpStatus, pumpMode, onSend }: { pumpStatus: PumpCommand; pumpMode: PumpMode; onSend: (cmd: PumpCommand) => void }) {
  const [confirming, setConfirming] = useState<PumpCommand | null>(null)
  const auto = pumpMode === 'auto'
  const isOn = pumpStatus === 'ON'
  const next: PumpCommand = pumpStatus === 'ON' ? 'OFF' : 'ON'

  return (
    <>
      <button
        type="button"
        className={`pump-action ${isOn ? 'is-on' : 'is-off'}`}
        disabled={auto}
        onClick={() => !auto && setConfirming(next)}
        aria-label={pumpStatus === 'ON' ? 'Matikan pompa' : 'Nyalakan pompa'}
      >
        <span className="pump-action-icon" aria-hidden="true"><Power size={24} strokeWidth={2.5} /></span>
        <span className="pump-action-text">
          <span className="pump-action-title">
            {auto ? 'Dikendalikan otomatis' : pumpStatus === 'ON' ? 'Matikan pompa' : 'Nyalakan pompa'}
          </span>
          <span className="pump-action-desc">
            {auto ? 'Ubah ke Manual untuk kontrol langsung' : pumpStatus === 'ON' ? 'Hentikan penyiraman sekarang' : 'Kirim perintah siram ke perangkat'}
          </span>
        </span>
      </button>

      {confirming ? (
        <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.target === e.currentTarget && setConfirming(null)}>
          <div className="dialog-card">
            <h2 id="confirm-title" className="dialog-title">{confirming === 'ON' ? 'Nyalakan pompa?' : 'Matikan pompa?'}</h2>
            <p className="dialog-desc">Perintah dikirim ke perangkat lewat server. Status pompa langsung diperbarui di dashboard.</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(null)}>Batal</button>
              <button type="button" className="btn btn-primary" onClick={() => { onSend(confirming); setConfirming(null) }}>Kirim perintah</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ThresholdForm({ initial, saving, onSubmit }: { initial: number; saving: boolean; onSubmit: (v: number) => Promise<unknown> }) {
  const form = useForm({
    defaultValues: { moisture_threshold: initial },
    validators: { onSubmit: thresholdSchema },
    onSubmit: async ({ value, formApi }) => {
      await onSubmit(value.moisture_threshold)
      formApi.reset({ moisture_threshold: value.moisture_threshold })
    },
  })

  return (
    <form className="config-block" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit() }}>
      <form.Field name="moisture_threshold" validators={{ onChange: thresholdFieldSchema }}>
        {(field) => {
          const err = field.state.meta.errors[0]
          const showErr = !!err && field.state.meta.isTouched
          return (
            <div>
              <div className="field-row">
                <label className="field-label" htmlFor="moisture_threshold">Ambang kelembapan</label>
                <div className="field-input-wrap">
                  <input
                    id="moisture_threshold"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="field-input"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                    aria-invalid={showErr}
                    aria-describedby={showErr ? 'threshold-err' : 'threshold-help'}
                  />
                  <span className="field-unit">%</span>
                </div>
              </div>
              <p className="field-help" id="threshold-help">Di mode otomatis, pompa menyala saat tanah di bawah ambang ini.</p>
              {showErr ? <p className="field-error" id="threshold-err" role="alert">{String((err as any)?.message ?? 'Nilai tidak valid')}</p> : null}
            </div>
          )
        }}
      </form.Field>
      <form.Subscribe selector={(s) => [s.canSubmit, s.isDirty, s.isSubmitting] as const}>
        {([canSubmit, isDirty, isSubmitting]) => (
          <button type="submit" className="btn btn-primary btn-full" disabled={!canSubmit || !isDirty || isSubmitting || saving}>
            {isSubmitting || saving ? 'Menyimpan…' : 'Simpan ambang'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
