import { useState } from 'react'
import type { RunRecord } from '../types'

interface Props {
  runs: RunRecord[]
}

function duration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function StatusBadge({ status }: { status: RunRecord['status'] }) {
  const colors: Record<string, string> = {
    complete: '#16a34a',
    stopped:  '#6b7280',
    active:   '#2563eb',
    paused:   '#d97706',
    idle:     '#374151',
  }
  return (
    <span style={{
      background: colors[status] ?? '#374151',
      color: '#fff', fontSize: 11, fontWeight: 700,
      borderRadius: 4, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{status}</span>
  )
}

function RunRow({ run }: { run: RunRecord }) {
  const [expanded, setExpanded] = useState(false)
  const pct = run.tasks_total > 0 ? Math.round((run.tasks_done / run.tasks_total) * 100) : 0

  return (
    <div style={{ borderBottom: '1px solid #1f2937' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '10px 16px', textAlign: 'left',
        }}
      >
        <span style={{ color: '#6b7280', fontSize: 12, minWidth: 130 }}>
          {formatDate(run.started_at)}
        </span>
        <StatusBadge status={run.status} />
        <span style={{ color: '#d1d5db', fontSize: 13, flex: 1 }}>
          {run.tasks_done}/{run.tasks_total} tasks done
        </span>
        <div style={{ width: 80, background: '#374151', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, background: '#16a34a', height: '100%' }} />
        </div>
        <span style={{ color: '#6b7280', fontSize: 12, minWidth: 50, textAlign: 'right' }}>
          {duration(run.duration_sec)}
        </span>
        <span style={{ color: '#6b7280', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Detail label="Run ID" value={run.id} mono />
            <Detail label="Repo" value={run.repo_path} mono />
            <Detail label="Events" value={String(run.event_count)} />
            <Detail label="Agents" value={run.workers.join(', ') || '—'} />
          </div>
          {run.done_ids.length > 0 && (
            <div>
              <span style={{ color: '#6b7280', fontSize: 12 }}>Completed tasks: </span>
              <span style={{ color: '#d1d5db', fontSize: 12 }}>{run.done_ids.join(', ')}</span>
            </div>
          )}
          {run.summary && (
            <pre style={{
              background: '#0f172a', borderRadius: 6, padding: 12,
              color: '#94a3b8', fontSize: 12, fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', margin: 0, maxHeight: 200, overflowY: 'auto',
            }}>{run.summary}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#d1d5db', fontSize: 12, fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
    </div>
  )
}

export function RunHistory({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <div style={{
        background: '#1f2937', border: '1px solid #374151', borderRadius: 8, padding: 20,
        color: '#6b7280', fontSize: 13, textAlign: 'center',
      }}>
        No run history yet. Start a run to begin recording history.
      </div>
    )
  }

  return (
    <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#f9fafb', fontWeight: 700, fontSize: 14 }}>Run History</span>
        <span style={{
          background: '#374151', color: '#9ca3af', borderRadius: 10,
          padding: '1px 8px', fontSize: 12,
        }}>{runs.length}</span>
      </div>
      {runs.map(r => <RunRow key={r.id} run={r} />)}
    </div>
  )
}
