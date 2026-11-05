import { type ReactNode } from 'react'

export function Stat({
  label,
  value,
  unit,
  detail,
  tone = 'green',
}: {
  label: string
  value: string | number
  unit?: string
  detail?: ReactNode
  tone?: string
}) {
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-label">{label}</span>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  )
}
