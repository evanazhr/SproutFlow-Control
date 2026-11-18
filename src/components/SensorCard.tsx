import type { ReactNode } from 'react'

export type SensorTone = 'leaf' | 'water' | 'dry' | 'neutral'

export default function SensorCard({
  icon,
  label,
  value,
  unit,
  detail,
  tone = 'neutral',
  loading = false,
}: {
  icon: ReactNode
  label: string
  value: string
  unit: string
  detail?: string
  tone?: SensorTone
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="sensor-card" aria-hidden="true">
        <span className="skel skel-icon" />
        <div className="sensor-body">
          <span className="skel skel-label" />
          <span className="skel skel-value" />
        </div>
      </div>
    )
  }

  return (
    <div className={`sensor-card tone-${tone}`}>
      <span className="sensor-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="sensor-body">
        <p className="sensor-label">{label}</p>
        <p className="sensor-value num">
          {value}
          <span className="sensor-unit">{unit}</span>
        </p>
        {detail ? <p className="sensor-detail">{detail}</p> : null}
      </div>
    </div>
  )
}
