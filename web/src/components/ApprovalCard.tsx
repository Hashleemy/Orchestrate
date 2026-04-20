import { useEffect, useState } from 'react'
import type React from 'react'
import { api } from '../api/client'
import { approvalKindColor, approvalKindIcon } from './approvalKind'
import type { Approval, DiffSummary } from '../types'

const KIND_COLOR: Record<string, string> = {
  minor:   '#22c55e',
  major:   '#f97316',
  blocked: '#ef4444',
}

const DIFF_TRIGGERS = new Set(['protected_merge', 'major_change', 'lockfile_change'])

function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60)    return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60)    return rem ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  const mrem = m % 60
  return mrem ? `${h}h ${mrem}m` : `${h}h`
}

function elapsedColor(seconds: number): string {
  if (seconds < 30)   return '#6b7280'
  if (seconds < 120)  return '#9ca3af'
  if (seconds < 600)  return '#f59e0b'
  return '#ef4444'
}

export function ApprovalCard({ approval, onResolved }: { approval: Approval; onResolved: () => void }) {
  const [loading, setLoading] = useState(false)
  const [diff, setDiff]       = useState<DiffSummary | null>(null)
  const [now, setNow]         = useState(() => Date.now())

  const pending = approval.status === 'pending'
  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [pending])

  const color    = approvalKindColor(approval.trigger)
  const icon     = approvalKindIcon(approval.trigger)
  const createdMs = new Date(approval.created_at).getTime()
  const ageSec   = Math.floor((now - createdMs) / 1000)
  const ageLabel = formatElapsed(ageSec)
  const ageHue   = elapsedColor(ageSec)

  useEffect(() => {
    if (approval.status !== 'pending') return
    if (!DIFF_TRIGGERS.has(approval.trigger)) return
    api.agentDiff(approval.agent).then(setDiff).catch(() => {})
  }, [approval.agent, approval.trigger, approval.status])

  async function resolve(action: 'approve' | 'deny') {
    setLoading(true)
    try {
      if (action === 'approve') await api.approve(approval.id)
      else await api.deny(approval.id)
      onResolved()
    } finally {
      setLoading(false)
    }
  }

  if (approval.status !== 'pending') {
    return (
      <div style={{ border: '1px solid #374151', borderRadius: 8, padding: '10px 14px', background: '#111827', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, color: approval.status === 'approved' ? '#22c55e' : '#ef4444', fontWeight: 600, textTransform: 'uppercase' }}>
          {approval.status}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{approval.agent} — {approval.detail}</span>
      </div>
    )
  }

  return (
    <div style={{
      border: `1px solid ${color}60`, borderLeft: `4px solid ${color}`,
      borderRadius: 8, padding: '12px 16px', background: '#1f2937',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontWeight: 700, color: '#f9fafb', fontSize: 13 }}>{approval.agent}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {diff && (
            <span style={{
              background: KIND_COLOR[diff.kind] ?? '#6b7280',
              color: '#fff', borderRadius: 4, padding: '1px 8px',
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            }}>{diff.kind}</span>
          )}
          <span style={{
            background: color + '25', color,
            border: `1px solid ${color}50`,
            borderRadius: 4, padding: '1px 8px',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>{approval.trigger.replace(/_/g, ' ')}</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Task: {approval.task_id}</div>
      <div style={{ fontSize: 13, color: '#d1d5db', marginBottom: 4, fontFamily: 'monospace' }}>{approval.detail}</div>
      <div style={{ fontSize: 11, marginBottom: diff ? 10 : 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#6b7280' }}>Pending for</span>
        <span style={{
          color: ageHue,
          fontWeight: ageSec >= 120 ? 700 : 600,
          fontVariantNumeric: 'tabular-nums',
        }}>{ageLabel}</span>
        {ageSec >= 600 && (
          <span style={{
            background: '#450a0a', color: '#fca5a5', border: '1px solid #991b1b',
            borderRadius: 4, padding: '0 6px', fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>stale</span>
        )}
      </div>

      {diff && <DiffInline diff={diff} />}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => resolve('approve')} disabled={loading} style={btnStyle('#15803d')}>Approve</button>
        <button onClick={() => resolve('deny')}    disabled={loading} style={btnStyle('#b91c1c')}>Deny</button>
      </div>
    </div>
  )
}

function DiffInline({ diff }: { diff: DiffSummary }) {
  return (
    <div style={{
      background: '#111827', border: '1px solid #374151',
      borderRadius: 6, padding: '8px 12px', marginBottom: 4,
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
        {diff.base_ref}..{diff.branch} &nbsp;·&nbsp;
        {diff.file_count} file{diff.file_count !== 1 ? 's' : ''}&nbsp;
        <span style={{ color: '#22c55e' }}>+{diff.insertions}</span>&nbsp;
        <span style={{ color: '#ef4444' }}>−{diff.deletions}</span>
      </div>

      {diff.reasons.map((r, i) => (
        <div key={i} style={{ fontSize: 11, color: '#fbbf24', marginBottom: 2 }}>⚠ {r}</div>
      ))}

      {diff.files.length > 0 && (
        <div style={{ marginTop: 6, maxHeight: 100, overflowY: 'auto' }}>
          {diff.files.slice(0, 20).map((f, i) => (
            <div key={i} style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{f}</div>
          ))}
          {diff.files.length > 20 && (
            <div style={{ fontSize: 10, color: '#6b7280' }}>…and {diff.files.length - 20} more</div>
          )}
        </div>
      )}
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg, color: '#fff', border: 'none',
    borderRadius: 6, padding: '6px 18px',
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
  }
}
