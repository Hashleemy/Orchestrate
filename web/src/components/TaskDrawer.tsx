import { useEffect } from 'react'
import type { AgentMessage, OrchestratorEvent, Task } from '../types'
import { PriorityChip, RiskChip, StatusChip } from './chips'
import { CopyId } from './CopyId'

interface Props {
  task: Task | null
  onClose: () => void
  events?: OrchestratorEvent[]
  messages?: AgentMessage[]
  onFilterFeed?: (taskId: string) => void
}

export function TaskDrawer({ task, onClose, events = [], messages = [], onFilterFeed }: Props) {
  useEffect(() => {
    if (!task) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task, onClose])

  if (!task) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 460, maxWidth: '100vw', height: '100%',
          background: '#111827', borderLeft: '1px solid #374151',
          padding: '22px 26px', overflowY: 'auto',
          boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 4, fontFamily: 'monospace' }}>
              <CopyId value={task.id} color="#93c5fd" />
            </div>
            <h2 style={{ margin: 0, color: '#f9fafb', fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #374151',
              color: '#9ca3af', borderRadius: 4,
              padding: '2px 10px', fontSize: 11, cursor: 'pointer',
            }}
          >Esc</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <StatusChip status={task.status} />
          <PriorityChip priority={task.priority} />
          <RiskChip risk={task.risk} />
        </div>

        <DetailRow label="Owner"    value={task.owner || '—'} />
        <DetailRow label="Branch"   value={task.branch || '—'} mono />
        <DetailRow label="Depends on"
          value={task.depends_on?.length ? task.depends_on.join(', ') : '—'} mono />
        <DetailRow label="Blocked by"
          value={task.blocked_by?.length ? task.blocked_by.join(', ') : '—'} mono />

        <TaskActivity task={task} events={events} messages={messages} onFilterFeed={onFilterFeed} />

        <div style={{ marginTop: 'auto', color: '#4b5563', fontSize: 11, paddingTop: 20 }}>
          Click outside or press Esc to close.
        </div>
      </div>
    </div>
  )
}

type Activity =
  | { kind: 'event';   ts: number; data: OrchestratorEvent }
  | { kind: 'message'; ts: number; data: AgentMessage }

function TaskActivity({ task, events, messages, onFilterFeed }: { task: Task; events: OrchestratorEvent[]; messages: AgentMessage[]; onFilterFeed?: (taskId: string) => void }) {
  const taskEvents = events
    .filter(e => e.task_id === task.id)
    .map(e => ({ kind: 'event' as const, ts: new Date(e.timestamp).getTime(), data: e }))
  const taskMsgs = messages
    .filter(m => m.task_id === task.id)
    .map(m => ({ kind: 'message' as const, ts: new Date(m.timestamp).getTime(), data: m }))
  const items: Activity[] = [...taskEvents, ...taskMsgs].sort((a, b) => b.ts - a.ts).slice(0, 20)

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
      }}>
        <div style={{
          color: '#6b7280', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>Activity ({items.length})</div>
        {items.length > 0 && onFilterFeed && (
          <button
            onClick={() => onFilterFeed(task.id)}
            style={{
              background: 'none', border: '1px solid #134e4a',
              color: '#5eead4', borderRadius: 4,
              padding: '2px 8px', fontSize: 10, cursor: 'pointer',
            }}
          >Filter feed to this task</button>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ color: '#4b5563', fontSize: 12 }}>No events or messages yet for this task.</div>
      ) : (
        <div style={{
          background: '#0b1220', border: '1px solid #1f2937', borderRadius: 6,
          maxHeight: 220, overflowY: 'auto', padding: '6px 8px',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {items.map((it, i) => (
            <ActivityRow key={i} item={it} />
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityRow({ item }: { item: Activity }) {
  if (item.kind === 'event') {
    const e = item.data
    return (
      <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#9ca3af', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#374151', fontSize: 10 }}>{formatShortTime(e.timestamp)}</span>
        <span style={{ color: '#60a5fa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{e.type.replace(/_/g, ' ')}</span>
        <span style={{ color: '#a78bfa', fontSize: 10 }}>{e.agent}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.detail ?? ''}</span>
      </div>
    )
  }
  const m = item.data
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#9ca3af', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <span style={{ color: '#374151', fontSize: 10 }}>{formatShortTime(m.timestamp)}</span>
      <span style={{ color: '#5eead4', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.type}</span>
      <span style={{ color: '#a78bfa', fontSize: 10 }}>{m.from} → {m.to}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.body}</span>
    </div>
  )
}

function formatShortTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        color: '#6b7280', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
      }}>{label}</div>
      <div style={{
        color: '#e5e7eb', fontSize: 13,
        fontFamily: mono ? 'monospace' : undefined,
        wordBreak: 'break-word',
      }}>{value}</div>
    </div>
  )
}
