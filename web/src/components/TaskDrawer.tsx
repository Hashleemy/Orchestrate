import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentMessage, OrchestratorEvent, Task } from '../types'
import { PriorityChip, RiskChip, StatusChip } from './chips'
import { CopyId } from './CopyId'
import { api } from '../api/client'
import { toast } from './Toast'

const TASK_STATUS_OPTIONS = [
  'todo', 'ready', 'in_progress', 'blocked',
  'awaiting_review', 'awaiting_approval', 'done', 'cancelled',
] as const

interface Props {
  task: Task | null
  onClose: () => void
  events?: OrchestratorEvent[]
  messages?: AgentMessage[]
  onFilterFeed?: (taskId: string) => void
}

export function TaskDrawer({ task, onClose, events = [], messages = [], onFilterFeed }: Props) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!task) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task])

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
          <StatusEditor task={task} />
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

function StatusEditor({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [value, setValue]     = useState<string>(task.status)

  useEffect(() => { setValue(task.status) }, [task.status, task.id])

  async function save(next: string) {
    if (next === task.status) { setEditing(false); return }
    setSaving(true)
    try {
      await api.updateTaskStatus(task.id, next)
      toast('success', `${task.id} → ${next}`)
      setEditing(false)
    } catch (e) {
      toast('error', 'Status update failed', String(e))
      setValue(task.status)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Change status"
        style={{ background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer' }}
      >
        <StatusChip status={task.status} />
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => { const v = e.target.value; setValue(v); save(v) }}
        autoFocus
        style={{
          background: '#0f172a', color: '#e5e7eb',
          border: '1px solid #334155', borderRadius: 4,
          padding: '2px 6px', fontSize: 12,
        }}
      >
        {TASK_STATUS_OPTIONS.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {saving && <span style={{ fontSize: 11, color: '#6b7280' }}>saving…</span>}
      {!saving && (
        <button
          onClick={() => { setEditing(false); setValue(task.status) }}
          style={{
            background: 'none', border: '1px solid #374151',
            color: '#9ca3af', borderRadius: 4, padding: '1px 6px',
            fontSize: 10, cursor: 'pointer',
          }}
        >cancel</button>
      )}
    </div>
  )
}

type Activity =
  | { kind: 'event';   ts: number; data: OrchestratorEvent }
  | { kind: 'message'; ts: number; data: AgentMessage }

const ACTIVITY_LIMIT_KEY = 'orchestrate.taskdrawer.activitylimit'
const ACTIVITY_LIMITS = [10, 20, 50] as const
type ActivityLimit = typeof ACTIVITY_LIMITS[number]

function loadActivityLimit(): ActivityLimit {
  try {
    const raw = Number(window.localStorage?.getItem(ACTIVITY_LIMIT_KEY))
    if (ACTIVITY_LIMITS.includes(raw as ActivityLimit)) return raw as ActivityLimit
  } catch { /* ignore */ }
  return 20
}

function saveActivityLimit(v: ActivityLimit) {
  try { window.localStorage?.setItem(ACTIVITY_LIMIT_KEY, String(v)) } catch { /* ignore */ }
}

function TaskActivity({ task, events, messages, onFilterFeed }: { task: Task; events: OrchestratorEvent[]; messages: AgentMessage[]; onFilterFeed?: (taskId: string) => void }) {
  const [limit, setLimit] = useState<ActivityLimit>(() => loadActivityLimit())

  const allItems = useMemo((): Activity[] => {
    const taskEvents = events
      .filter(e => e.task_id === task.id)
      .map(e => ({ kind: 'event' as const, ts: new Date(e.timestamp).getTime(), data: e }))
    const taskMsgs = messages
      .filter(m => m.task_id === task.id)
      .map(m => ({ kind: 'message' as const, ts: new Date(m.timestamp).getTime(), data: m }))
    return [...taskEvents, ...taskMsgs].sort((a, b) => b.ts - a.ts)
  }, [events, messages, task.id])
  const items = allItems.slice(0, limit)
  const totalCount = allItems.length

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
      }}>
        <div style={{
          color: '#6b7280', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>Activity ({items.length}{totalCount > items.length ? ` of ${totalCount}` : ''})</span>
          <div style={{ display: 'flex', gap: 2 }}>
            {ACTIVITY_LIMITS.map(v => (
              <button
                key={v}
                onClick={() => { setLimit(v); saveActivityLimit(v) }}
                style={{
                  background: limit === v ? '#334155' : 'transparent',
                  color: limit === v ? '#e2e8f0' : '#6b7280',
                  border: '1px solid #334155',
                  borderRadius: 8, padding: '0 6px', fontSize: 10, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >{v}</button>
            ))}
          </div>
        </div>
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
