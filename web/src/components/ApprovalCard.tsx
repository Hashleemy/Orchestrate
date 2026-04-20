import { useEffect, useState } from 'react'
import type React from 'react'
import { api } from '../api/client'
import type { Approval, DiffSummary } from '../types'

const TRIGGER_COLOR: Record<string, string> = {
  package_install:   '#f97316',
  lockfile_change:   '#eab308',
  sensitive_file:    '#ef4444',
  protected_merge:   '#ef4444',
  major_change:      '#f97316',
  destructive_delete:'#ef4444',
  network_deploy:    '#a855f7',
}

const KIND_COLOR: Record<string, string> = {
  minor:   '#22c55e',
  major:   '#f97316',
  blocked: '#ef4444',
}

const DIFF_TRIGGERS = new Set(['protected_merge', 'major_change', 'lockfile_change'])

export function ApprovalCard({ approval, onResolved }: { approval: Approval; onResolved: () => void }) {
  const [loading, setLoading] = useState(false)
  const [diff, setDiff]       = useState<DiffSummary | null>(null)

  const color    = TRIGGER_COLOR[approval.trigger] ?? '#6b7280'
  const age      = Math.floor((Date.now() - new Date(approval.created_at).getTime()) / 1000)
  const ageLabel = age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`

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
      <div style={{ border: '1px solid #374151', borderRadius: 8, padding: '10px 14px', background: '#111827', opacity: 0.6 }}>
        <span style={{ fontSize: 12, color: approval.status === 'approved' ? '#22c55e' : '#ef4444', fontWeight: 600, textTransform: 'uppercase' }}>
          {approval.status}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{approval.agent} — {approval.detail}</span>
      </div>
    )
  }

  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 8, padding: '12px 16px', background: '#1f2937' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: '#f9fafb', fontSize: 13 }}>{approval.agent}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {diff && (
            <span style={{
              background: KIND_COLOR[diff.kind] ?? '#6b7280',
              color: '#fff', borderRadius: 4, padding: '1px 8px',
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            }}>{diff.kind}</span>
          )}
          <span style={{
            background: color, color: '#fff',
            borderRadius: 4, padding: '1px 8px',
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          }}>{approval.trigger.replace(/_/g, ' ')}</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Task: {approval.task_id}</div>
      <div style={{ fontSize: 13, color: '#d1d5db', marginBottom: 4, fontFamily: 'monospace' }}>{approval.detail}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: diff ? 10 : 12 }}>Requested {ageLabel}</div>

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
