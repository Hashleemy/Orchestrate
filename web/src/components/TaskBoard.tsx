import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { compactMode, useSetting } from '../settings'
import type { AgentMessage, OrchestratorEvent, Task } from '../types'
import { PriorityChip, RiskChip, STATUS_COLOR, StatusChip } from './chips'
import { CopyId } from './CopyId'
import { TaskDrawer } from './TaskDrawer'
import { toast } from './Toast'

const EDITABLE_STATUSES = [
  'todo', 'ready', 'in_progress', 'blocked',
  'awaiting_review', 'awaiting_approval', 'done', 'cancelled',
] as const

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, normal: 1, low: 2, '': 3 }

const ALL_STATUSES = ['all', 'todo', 'ready', 'in_progress', 'blocked', 'awaiting_review', 'awaiting_approval', 'done', 'cancelled']

const FILTER_STATUS_KEY  = 'orchestrate.taskboard.filterstatus'
const SORT_PRIORITY_KEY  = 'orchestrate.taskboard.sortpriority'

interface Props {
  tasks:           Task[]
  onTaskCreated?:  () => void
  events?:         OrchestratorEvent[]
  messages?:       AgentMessage[]
  onFilterFeedToTask?: (taskId: string) => void
}

const inputStyle: React.CSSProperties = {
  background: '#111827', border: '1px solid #374151', borderRadius: 5,
  color: '#d1d5db', fontSize: 12, padding: '5px 9px', fontFamily: 'inherit',
}

function AddTaskForm({ onDone }: { onDone: () => void }) {
  const [title,     setTitle]     = useState('')
  const [priority,  setPriority]  = useState('normal')
  const [risk,      setRisk]      = useState('low')
  const [owner,     setOwner]     = useState('')
  const [dependsOn, setDependsOn] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setErr('Title is required'); return }
    setSaving(true); setErr(null)
    try {
      const deps = dependsOn.split(',').map(s => s.trim()).filter(Boolean)
      await api.createTask({ title: title.trim(), priority, risk, owner: owner.trim() || undefined, depends_on: deps })
      onDone()
    } catch (ex) {
      setErr(String(ex).replace(/^Error: /, ''))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#111827', border: '1px solid #374151', borderRadius: 8,
      padding: '14px 16px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
    }}>
      <div style={{ flex: '1 1 220px' }}>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>Title <span style={{ color: '#ef4444' }}>*</span></div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" style={{ ...inputStyle, width: '100%' }} autoFocus />
      </div>
      <div>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>Priority</div>
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>Risk</div>
        <select value={risk} onChange={e => setRisk(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>Owner</div>
        <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="agent-worker-01" style={{ ...inputStyle, width: 140 }} />
      </div>
      <div>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>Depends On</div>
        <input value={dependsOn} onChange={e => setDependsOn(e.target.value)} placeholder="TASK-001, TASK-002" style={{ ...inputStyle, width: 150 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" disabled={saving} style={{
          background: '#2563eb', border: 'none', color: '#fff',
          borderRadius: 5, padding: '6px 14px', fontSize: 12,
          fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
        }}>{saving ? 'Adding…' : 'Add Task'}</button>
        <button type="button" onClick={onDone} style={{
          background: 'none', border: '1px solid #374151', color: '#9ca3af',
          borderRadius: 5, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
        }}>Cancel</button>
      </div>
      {err && <div style={{ width: '100%', color: '#ef4444', fontSize: 12 }}>{err}</div>}
    </form>
  )
}

export function TaskBoard({ tasks, onTaskCreated, events = [], messages = [], onFilterFeedToTask }: Props) {
  const compact = useSetting(compactMode)
  const [filterStatus, setFilterStatusState] = useState<string>(() => {
    try { return localStorage.getItem(FILTER_STATUS_KEY) ?? 'all' } catch { return 'all' }
  })
  const setFilterStatus = (s: string) => {
    try { localStorage.setItem(FILTER_STATUS_KEY, s) } catch { /* ignore */ }
    setFilterStatusState(s)
  }
  const [sortByPriority, setSortByPriorityState] = useState<boolean>(() => {
    try { return localStorage.getItem(SORT_PRIORITY_KEY) !== 'false' } catch { return true }
  })
  const setSortByPriority = (fn: boolean | ((prev: boolean) => boolean)) => {
    setSortByPriorityState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      try { localStorage.setItem(SORT_PRIORITY_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [openTask, setOpenTask] = useState<Task | null>(null)
  const [cursor, setCursor] = useState<number>(-1)
  const [hovered, setHovered] = useState(false)
  const rowRefs = useRef<Array<HTMLElement | null>>([])
  const [view, setView] = useState<'list' | 'board'>(() => {
    try { return (localStorage.getItem('orchestrate.taskboard.view') as 'list' | 'board') ?? 'list' }
    catch { return 'list' }
  })
  useEffect(() => {
    try { localStorage.setItem('orchestrate.taskboard.view', view) } catch { /* ignore */ }
  }, [view])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable
      if (e.key === 'Escape' && showForm) {
        setShowForm(false)
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setShowForm(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showForm])

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (q) {
      const hay = `${t.id} ${t.title} ${t.owner ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [tasks, filterStatus, q])

  const sorted = useMemo(() =>
    sortByPriority
      ? [...filtered].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
      : filtered,
    [filtered, sortByPriority]
  )
  const sortedRef = useRef<Task[]>([])
  sortedRef.current = sorted

  const taskCount = sorted.length
  useEffect(() => {
    if (cursor >= taskCount) setCursor(taskCount > 0 ? taskCount - 1 : -1)
  }, [taskCount, cursor])

  useEffect(() => {
    if (!hovered) return
    function isTypingTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (taskCount === 0) return
      if (e.key === 'j') {
        e.preventDefault()
        setCursor(c => Math.min(taskCount - 1, c < 0 ? 0 : c + 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setCursor(c => Math.max(0, c < 0 ? 0 : c - 1))
      } else if (e.key === 'Enter' && cursor >= 0 && cursor < taskCount) {
        e.preventDefault()
        setOpenTask(sortedRef.current[cursor] ?? null)
      } else if (e.key === 'Escape' && cursor >= 0) {
        e.preventDefault()
        setCursor(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hovered, taskCount, cursor])

  useEffect(() => {
    if (cursor < 0) return
    const el = rowRefs.current[cursor]
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursor])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length }
    for (const t of tasks) c[t.status] = (c[t.status] ?? 0) + 1
    return c
  }, [tasks])

  function handleFormDone() {
    setShowForm(false)
    onTaskCreated?.()
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setCursor(-1) }}
    >
      {/* Search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search id, title, or owner…"
          style={{
            background: '#111827', border: '1px solid #374151', borderRadius: 5,
            color: '#d1d5db', fontSize: 12, padding: '5px 10px', fontFamily: 'inherit',
            width: 280, outline: 'none',
          }}
        />
        {q && (
          <>
            <span style={{ color: '#6b7280', fontSize: 11 }}>
              {filtered.length}/{tasks.length}
            </span>
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none', border: '1px solid #374151',
                color: '#9ca3af', borderRadius: 4,
                padding: '3px 9px', fontSize: 11, cursor: 'pointer',
              }}
            >Clear</button>
          </>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {ALL_STATUSES.filter(s => s === 'all' || counts[s] > 0).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              background: filterStatus === s ? (STATUS_COLOR[s] ?? '#3b82f6') : '#1f2937',
              color: filterStatus === s ? '#fff' : '#9ca3af',
              border: `1px solid ${filterStatus === s ? 'transparent' : '#374151'}`,
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {s.replace(/_/g, ' ')}
            {counts[s] > 0 && (
              <span style={{ marginLeft: 5, opacity: 0.8 }}>{counts[s]}</span>
            )}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>View:</span>
          <button
            onClick={() => setView(v => v === 'list' ? 'board' : 'list')}
            style={{
              background: '#1f2937', color: '#9ca3af', border: '1px solid #374151',
              borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
            }}
          >{view === 'list' ? '▦ Board' : '☰ List'}</button>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Sort:</span>
          <button
            onClick={() => setSortByPriority(p => !p)}
            style={{
              background: sortByPriority ? '#2563eb' : '#1f2937',
              color: '#9ca3af',
              border: '1px solid #374151',
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >Priority</button>
          <button
            onClick={() => setShowForm(f => !f)}
            title={showForm ? 'Close (Esc)' : 'Add a new task (N)'}
            style={{
              background: showForm ? '#374151' : '#1d4ed8',
              color: '#fff', border: 'none',
              borderRadius: 4, padding: '3px 10px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >{showForm ? '✕ Cancel' : '+ Add Task'}</button>
          {!showForm && (
            <kbd style={{
              fontFamily: 'monospace', fontSize: 10, color: '#6b7280',
              border: '1px solid #374151', borderRadius: 3, padding: '1px 5px',
              background: '#111827',
            }}>N</kbd>
          )}
        </div>
      </div>

      <TaskDrawer
        task={openTask}
        onClose={() => setOpenTask(null)}
        events={events}
        messages={messages}
        onFilterFeed={taskId => {
          onFilterFeedToTask?.(taskId)
          setOpenTask(null)
        }}
      />

      {showForm && <AddTaskForm onDone={handleFormDone} />}

      {view === 'board' ? (
        <BoardView tasks={sorted} onOpen={setOpenTask} />
      ) : sorted.length === 0
        ? <div style={{ color: '#4b5563', fontSize: 13, padding: 4 }}>No tasks match the current filter.</div>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 12 : 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                {['ID', 'Status', 'Priority', 'Owner', 'Title', 'Risk', 'Depends On'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: compact ? '4px 8px' : '6px 10px', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr
                  key={t.id}
                  ref={(el) => { rowRefs.current[i] = el }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.closest('button')) return
                    setCursor(i)
                    setOpenTask(t)
                  }}
                  style={{
                    borderBottom: '1px solid #1f2937',
                    cursor: 'pointer',
                    background: cursor === i ? '#082f49' : undefined,
                    boxShadow: cursor === i ? 'inset 3px 0 0 #38bdf8' : undefined,
                  }}
                >
                  <td style={td(compact)}><span style={{ fontSize: 11 }}><CopyId value={t.id} color="#93c5fd" /></span></td>
                  <td style={td(compact)} onClick={e => e.stopPropagation()}>
                    <InlineStatusCell task={t} />
                  </td>
                  <td style={td(compact)}>
                    <PriorityChip priority={t.priority} />
                  </td>
                  <td style={td(compact)}><span style={{ color: '#9ca3af' }}>{t.owner || '—'}</span></td>
                  <td style={{ ...td(compact), maxWidth: 360 }}>
                    <span style={{ color: '#d1d5db', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  </td>
                  <td style={td(compact)}>
                    <RiskChip risk={t.risk} />
                  </td>
                  <td style={td(compact)}>
                    <span style={{ color: '#6b7280', fontSize: 11 }}>
                      {t.depends_on?.length ? t.depends_on.join(', ') : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  )
}

function td(compact?: boolean): React.CSSProperties {
  return { padding: compact ? '4px 8px' : '7px 10px', verticalAlign: 'middle' }
}

function InlineStatusCell({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!editing) return
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setEditing(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setEditing(false); e.stopPropagation() }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [editing])

  async function change(next: string) {
    if (next === task.status) { setEditing(false); return }
    setSaving(true)
    try {
      await api.updateTaskStatus(task.id, next)
      toast('success', `${task.id} → ${next}`)
      setEditing(false)
    } catch (e) {
      toast('error', 'Status update failed', String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Click to change status"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <StatusChip status={task.status} />
      </button>
    )
  }

  return (
    <div ref={ref} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <select
        value={task.status}
        disabled={saving}
        autoFocus
        onChange={e => change(e.target.value)}
        style={{
          background: '#0f172a', color: '#e5e7eb',
          border: '1px solid #334155', borderRadius: 4,
          padding: '2px 6px', fontSize: 11,
        }}
      >
        {EDITABLE_STATUSES.map(s => (
          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
        ))}
      </select>
      {saving && <span style={{ fontSize: 10, color: '#6b7280' }}>saving…</span>}
    </div>
  )
}

const BOARD_COLUMNS = ['todo', 'ready', 'in_progress', 'blocked', 'awaiting_review', 'awaiting_approval', 'done', 'cancelled']

function BoardView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const grouped = useMemo(() => {
    const g: Record<string, Task[]> = {}
    for (const col of BOARD_COLUMNS) g[col] = []
    for (const t of tasks) {
      if (g[t.status]) g[t.status].push(t)
      else (g['todo'] = g['todo'] ?? []).push(t)
    }
    return g
  }, [tasks])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 10,
    }}>
      {BOARD_COLUMNS.map(col => (
        <div key={col} style={{
          background: '#0f172a', border: '1px solid #1f2937',
          borderRadius: 6, padding: 8, minHeight: 80,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: STATUS_COLOR[col] ?? '#9ca3af', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{col.replace(/_/g, ' ')}</span>
            <span style={{ color: '#4b5563' }}>{grouped[col].length}</span>
          </div>
          {grouped[col].length === 0
            ? <div style={{ color: '#334155', fontSize: 11, fontStyle: 'italic' }}>empty</div>
            : grouped[col].map(t => (
                <div
                  key={t.id}
                  onClick={() => onOpen(t)}
                  style={{
                    background: '#1f2937', border: '1px solid #374151', borderRadius: 5,
                    padding: '6px 8px', marginBottom: 6, cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 10, color: '#93c5fd', fontFamily: 'monospace', marginBottom: 2 }}>{t.id}</div>
                  <div style={{ fontSize: 12, color: '#d1d5db', marginBottom: 4, lineHeight: 1.35 }}>{t.title}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <PriorityChip priority={t.priority} />
                    <RiskChip risk={t.risk} />
                  </div>
                </div>
              ))
          }
        </div>
      ))}
    </div>
  )
}
