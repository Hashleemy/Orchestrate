import type { OrchestratorEvent } from '../types'

const TYPE_COLOR: Record<string, string> = {
  task_started: '#3b82f6',
  file_edit: '#6b7280',
  test_run: '#06b6d4',
  commit: '#22c55e',
  blocked: '#f97316',
  unblocked: '#a3e635',
  approval_requested: '#eab308',
  approval_received: '#a855f7',
  message_sent: '#6b7280',
  message_received: '#6b7280',
  completed: '#15803d',
  error: '#ef4444',
}

function ts(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function EventFeed({ events }: { events: OrchestratorEvent[] }) {
  const sorted = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200)

  return (
    <div style={{ overflowY: 'auto', maxHeight: 400, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sorted.length === 0 && (
        <div style={{ color: '#6b7280', fontSize: 13, padding: 8 }}>No events yet.</div>
      )}
      {sorted.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '3px 0', borderBottom: '1px solid #1f2937' }}>
          <span style={{ color: '#6b7280', flexShrink: 0 }}>{ts(e.timestamp)}</span>
          <span style={{ color: '#9ca3af', flexShrink: 0, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.agent}</span>
          <span style={{
            background: TYPE_COLOR[e.type] ?? '#6b7280',
            color: '#fff',
            borderRadius: 3,
            padding: '0 6px',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            flexShrink: 0,
            alignSelf: 'center',
          }}>{e.type.replace(/_/g, ' ')}</span>
          <span style={{ color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</span>
        </div>
      ))}
    </div>
  )
}
