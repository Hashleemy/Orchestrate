import type React from 'react'

export const STATUS_COLOR: Record<string, string> = {
  todo:               '#6b7280',
  ready:              '#3b82f6',
  in_progress:        '#22c55e',
  blocked:            '#f97316',
  awaiting_review:    '#eab308',
  awaiting_approval:  '#f59e0b',
  done:               '#15803d',
  cancelled:          '#ef4444',
}

export const PRIORITY_COLOR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f97316',
  normal: '#6b7280',
  low:    '#6b7280',
}

export const RISK_COLOR: Record<string, string> = {
  low:    '#6b7280',
  medium: '#f97316',
  high:   '#ef4444',
}

const baseChip: React.CSSProperties = {
  color: '#fff',
  borderRadius: 4,
  padding: '1px 8px',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  letterSpacing: '0.04em',
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span style={{ ...baseChip, background: STATUS_COLOR[status] ?? '#6b7280' }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function PriorityChip({ priority }: { priority: string }) {
  const color = PRIORITY_COLOR[priority] ?? '#6b7280'
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 11, color: '#9ca3af' }}>{priority || '—'}</span>
    </span>
  )
}

export function RiskChip({ risk }: { risk: string }) {
  if (!risk) return null
  return (
    <span style={{ color: RISK_COLOR[risk] ?? '#6b7280', fontSize: 11 }}>{risk}</span>
  )
}
