import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import DataTable from '../components/DataTable'
import { api, type PumpLog, type Reading } from '../lib/api'
import { getSessionSafe } from '../lib/auth-client'
import { env } from '../env'

export const Route = createFileRoute('/history')({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSessionSafe()
    if (!session?.user) throw redirect({ to: '/login' })
  },
  component: HistoryPage,
})

const PAGE_LIMIT = 50

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_LABEL: Record<PumpLog['status'], string> = {
  sent: 'Terkirim',
  confirmed: 'Terkonfirmasi',
  timeout: 'Tidak merespons',
}

function dateToFromIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined
}

function dateToToIso(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined
}

type Tab = 'sensor' | 'pump'

function HistoryPage() {
  const deviceId = env.VITE_DEVICE_ID
  const [tab, setTab] = useState<Tab>('sensor')
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fromIso = dateToFromIso(from)
  const toIso = dateToToIso(to)

  const readings = useQuery({
    queryKey: ['readings-page', deviceId, fromIso, toIso, page],
    queryFn: () =>
      api.readings(deviceId, { from: fromIso, to: toIso, page, limit: PAGE_LIMIT }),
    select: (res) => res,
    enabled: tab === 'sensor',
    placeholderData: keepPreviousData,
    retry: false,
  })

  const pumpLogs = useQuery({
    queryKey: ['pump-logs-page', deviceId, fromIso, toIso, page],
    queryFn: () => api.pumpLogs(deviceId, { from: fromIso, to: toIso, page, limit: PAGE_LIMIT }),
    select: (res) => res,
    enabled: tab === 'pump',
    placeholderData: keepPreviousData,
    retry: false,
  })

  const sensorColumns = useMemo<ColumnDef<Reading, unknown>[]>(
    () => [
      {
        header: 'Waktu',
        accessorKey: 'recorded_at',
        cell: ({ getValue }) => <span className="num">{fmtDateTime(getValue<string>())}</span>,
      },
      {
        header: 'Kelembapan tanah',
        accessorKey: 'soil_moisture',
        cell: ({ getValue }) => <span className="num">{Number(getValue<number>()).toFixed(0)}%</span>,
      },
      {
        header: 'Suhu',
        accessorKey: 'temperature',
        cell: ({ getValue }) => <span className="num">{Number(getValue<number>()).toFixed(1)}°C</span>,
      },
      {
        header: 'Kelembapan udara',
        accessorKey: 'humidity',
        cell: ({ getValue }) => <span className="num">{Number(getValue<number>()).toFixed(0)}%</span>,
      },
    ],
    [],
  )

  const pumpColumns = useMemo<ColumnDef<PumpLog, unknown>[]>(
    () => [
      {
        header: 'Waktu',
        accessorKey: 'created_at',
        cell: ({ getValue }) => <span className="num">{fmtDateTime(getValue<string>())}</span>,
      },
      {
        header: 'Perintah',
        accessorKey: 'command',
        cell: ({ getValue }) => (
          <span className={`badge badge-${getValue<PumpLog['command']>() === 'ON' ? 'on' : 'off'}`}>
            <span className="badge-dot" aria-hidden="true" />
            {getValue<string>()}
          </span>
        ),
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ getValue }) => {
          const status = getValue<PumpLog['status']>()
          return (
            <span className={`badge badge-log-${status}`}>
              <span className="badge-dot" aria-hidden="true" />
              {STATUS_LABEL[status]}
            </span>
          )
        },
      },
      {
        header: 'Dipicu',
        accessorKey: 'triggered_by',
        cell: ({ getValue }) => {
          const t = getValue<PumpLog['triggered_by']>()
          return t.type === 'user' ? t.name ?? 'Pengguna' : 'Otomatis'
        },
      },
      {
        header: 'Dikonfirmasi',
        accessorKey: 'confirmed_at',
        cell: ({ getValue }) =>
          getValue<string | null>() ? (
            <span className="num">{fmtDateTime(getValue<string>()!)}</span>
          ) : (
            '—'
          ),
      },
    ],
    [],
  )

  const active = tab === 'sensor' ? readings : pumpLogs
  const activeData = tab === 'sensor' ? readings.data?.data : pumpLogs.data?.data
  const meta = tab === 'sensor' ? readings.data?.meta : pumpLogs.data?.meta
  const isLoading = tab === 'sensor' ? readings.isLoading : pumpLogs.isLoading

  const switchTab = (next: Tab) => {
    setTab(next)
    setPage(1)
  }

  return (
    <main className="page-wrap px-4 pb-16 pt-8">
      <header className="page-head rise-in">
        <h1 className="page-title">Riwayat</h1>
        <p className="page-sub">
          Data sensor dan aktivitas pompa perangkat <strong>{deviceId}</strong>, dengan pagination
          di sisi server.
        </p>
      </header>

      <div className="filter-row rise-in">
        <div className="tabs" role="tablist" aria-label="Jenis riwayat">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sensor'}
            className={`tab ${tab === 'sensor' ? 'is-active' : ''}`}
            onClick={() => switchTab('sensor')}
          >
            Sensor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pump'}
            className={`tab ${tab === 'pump' ? 'is-active' : ''}`}
            onClick={() => switchTab('pump')}
          >
            Aktivitas pompa
          </button>
        </div>

        <div className="filter-dates">
          <label>
            <span className="filter-label">Dari</span>
            <input
              type="date"
              className="demo-input demo-input-fit"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value)
                setPage(1)
              }}
            />
          </label>
          <label>
            <span className="filter-label">Sampai</span>
            <input
              type="date"
              className="demo-input demo-input-fit"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>
      </div>

      {active.isError ? (
        <section className="island-shell panel-pad error-panel" role="alert">
          <h2 className="panel-title">Data tidak bisa dimuat</h2>
          <p className="panel-desc">
            {active.error instanceof Error ? active.error.message : 'Terjadi kesalahan.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void active.refetch()}>
            Coba lagi
          </button>
        </section>
      ) : (
        <div className="island-shell panel-pad rise-in">
          <DataTable<Reading | PumpLog>
            columns={(tab === 'sensor' ? sensorColumns : pumpColumns) as ColumnDef<Reading | PumpLog, unknown>[]}
            data={activeData ?? []}
            loading={isLoading}
            emptyTitle={tab === 'sensor' ? 'Belum ada data sensor' : 'Belum ada aktivitas pompa'}
            emptyDescription={
              tab === 'sensor'
                ? 'Data muncul setelah perangkat mengirim telemetry. Coba lewati filter tanggal.'
                : 'Log pompa muncul setelah ada perintah yang dikirim admin.'
            }
            page={page}
            limit={meta?.limit ?? PAGE_LIMIT}
            total={meta?.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      )}
    </main>
  )
}
