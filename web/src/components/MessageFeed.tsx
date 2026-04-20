import type { AgentMessage } from '../types'

const TYPE_COLOR: Record<string, string> = {
  question:  '#3b82f6',
  answer:    '#22c55e',
  broadcast: '#8b5cf6',
  status:    '#6b7280',
  block:     '#f97316',
}

function fmt(ts: string) {
  try { return new Date(ts).toLocaleTimeString() } catch { return ts }
}

export function MessageFeed({ messages }: { messages: AgentMessage[] }) {
  if (messages.length === 0) {
    return <div style={{ color: '#4b5563', fontSize: 13, padding: 4 }}>No inter-agent messages yet.</div>
  }

  const sorted = [...messages].sort((a, b) => a.timestamp < b.timestamp ? 1 : -1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
      {sorted.map((m, i) => (
        <div key={i} style={{
          background: '#1a2332',
          border: '1px solid #1f2937',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{
              background: TYPE_COLOR[m.type] ?? '#6b7280',
              color: '#fff',
              borderRadius: 3,
              padding: '0px 6px',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>{m.type}</span>
            <span style={{ color: '#9ca3af', fontWeight: 600 }}>{m.from}</span>
            {m.to && m.to !== '*' && <>
              <span style={{ color: '#4b5563' }}>→</span>
              <span style={{ color: '#9ca3af' }}>{m.to}</span>
            </>}
            {m.task_id && <span style={{ color: '#4b5563' }}>[{m.task_id}]</span>}
            <span style={{ color: '#4b5563', marginLeft: 'auto' }}>{fmt(m.timestamp)}</span>
          </div>
          <div style={{ color: '#d1d5db', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.body}</div>
        </div>
      ))}
    </div>
  )
}
