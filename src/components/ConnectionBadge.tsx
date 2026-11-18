import type { MqttStatus } from '../lib/mqtt'

const LABELS: Record<MqttStatus, string> = {
  connecting: 'Menyambung…',
  connected: 'Terhubung',
  reconnecting: 'Menyambung ulang…',
  disconnected: 'Terputus',
}

export default function ConnectionBadge({
  status,
  lastUpdated,
}: {
  status: MqttStatus
  lastUpdated: Date | null
}) {
  const updated = lastUpdated
    ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="connection-badge">
      <span className={`status-dot dot-${status}`} aria-hidden="true" />
      <span className="status-text">{LABELS[status]}</span>
      {updated ? <span className="status-updated num">· diperbarui {updated}</span> : null}
    </div>
  )
}
