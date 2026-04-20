import type { AgentMessage, OrchestratorEvent } from '../types'

interface Props {
  events:   OrchestratorEvent[]
  messages: AgentMessage[]
  maxItems?: number
}

type FeedItem =
  | { kind: 'event';   ts: number; data: OrchestratorEvent }
  | { kind: 'message'; ts: number; data: AgentMessage }

const EVENT_COLOR: Record<string, string> = {
  task_started:       '#3b82f6',
  task_claimed:       '#60a5fa',
  file_edit:          '#22c55e',
  test_run:           '#06b6d4',
  test_pass:          '#15803d',
  test_fail:          '#ef4444',
  commit:             '#8b5cf6',
  push:               '#a855f7',
  merged:             '#15803d',
  blocked:            '#f97316',
  unblocked:          '#22c55e',
  approval_requested: '#eab308',
  approval_received:  '#22c55e',
  approval_denied:    '#ef4444',
  message_sent:       '#9ca3af',
  message_received:   '#9ca3af',
  review_requested:   '#c084fc',
  review_complete:    '#16a34a',
  checkpoint_raised:  '#f97316',
  checkpoint_resolved:'#22c55e',
  completed:          '#15803d',
  error:              '#ef4444',
}

const MSG_TYPE_COLOR: Record<string, string> = {
  question:  '#3b82f6',
  answer:    '#22c55e',
  broadcast: '#9ca3af',
  status:    '#6b7280',
  block:     '#f97316',
}

export function CommFeed({ events, messages, maxItems = 120 }: Props) {
  const items: FeedItem[] = [
    ...events.map(e => ({ kind: 'event' as const, ts: new Date(e.timestamp).getTime(), data: e })),
    ...messages.map(m => ({ kind: 'message' as const, ts: new Date(m.timestamp).getTime(), data: m })),
  ]
  .sort((a, b) => b.ts - a.ts)
  .slice(0, maxItems)

  if (items.length === 0) {
    return (
      <div style={{ color: '#6b7280', fontSize: 13, padding: '12px 4px', lineHeight: 1.6 }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>💬</div>
        No communications yet. Events and inter-agent messages will stream here live.
      </div>
    )
  }

  return (
    <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((item, i) =>
        item.kind === 'event'
          ? <EventRow key={`e-${i}`} event={item.data} />
          : <MessageRow key={`m-${i}`} message={item.data} />
      )}
    </div>
  )
}

function EventRow({ event }: { event: OrchestratorEvent }) {
  const color = EVENT_COLOR[event.type] ?? '#6b7280'
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '4px 0', borderBottom: '1px solid #111827',
      fontSize: 12,
    }}>
      <span style={{ color: '#374151', whiteSpace: 'nowrap', fontSize: 10, paddingTop: 1 }}>
        {formatTime(event.timestamp)}
      </span>
      <span style={{
        background: color + '20', color, borderRadius: 3,
        padding: '0 5px', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', whiteSpace: 'nowrap', paddingTop: 1,
      }}>{event.type.replace(/_/g, ' ')}</span>
      <span style={{ color: '#60a5fa', fontSize: 11, whiteSpace: 'nowrap' }}>{event.agent}</span>
      {event.task_id && (
        <code style={{ fontSize: 10, color: '#475569' }}>{event.task_id}</code>
      )}
      <span style={{ color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {event.detail}
      </span>
    </div>
  )
}

function MessageRow({ message }: { message: AgentMessage }) {
  const color = MSG_TYPE_COLOR[message.type] ?? '#6b7280'
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '5px 0', borderBottom: '1px solid #111827',
      fontSize: 12,
    }}>
      <span style={{ color: '#374151', whiteSpace: 'nowrap', fontSize: 10, paddingTop: 1 }}>
        {formatTime(message.timestamp)}
      </span>
      <span style={{
        background: '#1e293b', color, borderRadius: 3,
        padding: '0 5px', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', whiteSpace: 'nowrap', border: `1px solid ${color}30`,
      }}>{message.type}</span>
      <span style={{ color: '#a78bfa', fontSize: 11, whiteSpace: 'nowrap' }}>
        {message.from} → {message.to}
      </span>
      {message.task_id && (
        <code style={{ fontSize: 10, color: '#475569' }}>{message.task_id}</code>
      )}
      <span style={{ color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {message.body}
      </span>
    </div>
  )
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}
