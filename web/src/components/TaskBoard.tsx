import { useState } from 'react'
import { api } from '../api/client'
import type { Task } from '../types'

const STATUS_COLOR: Record<string, string> = {
  todo:               '#6b7280',
  ready:              '#3b82f6',
  in_progress:        '#22c55e',
  blocked:            '#f97316',
  awaiting_review:    '#eab308',
  awaiting_approval:  '#f59e0b',
  done:               '#15803d',
  cancelled:          '#ef4444',
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, '': 3 }

const ALL_STATUSES = ['all', 'todo', 'ready', 'in_progress', 'blocked', 'awaiting_review', 'awaiting_approval', 'done', 'cancelled']

interface Props {
  tasks:           Task[]
  onTaskCreated?:  () => void
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

export function TaskBoard({ tasks, onTaskCreated }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortByPriority, setSortByPriority] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const filtered = tasks.filter(t => filterStatus === 'all' || t.status === filterStatus)

  const sorted = sortByPriority
    ? [...filtered].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
    : filtered

  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'all' ? tasks.length : tasks.filter(t => t.status === s).length
    return acc
  }, {})

  function handleFormDone() {
    setShowForm(false)
    onTaskCreated?.()
  }

  return (
    <div>
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
            style={{
              background: showForm ? '#374151' : '#1d4ed8',
              color: '#fff', border: 'none',
              borderRadius: 4, padding: '3px 10px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >{showForm ? '✕ Cancel' : '+ Add Task'}</button>
        </div>
      </div>

      {showForm && <AddTaskForm onDone={handleFormDone} />}

      {/* Table */}
      {sorted.length === 0
        ? <div style={{ color: '#4b5563', fontSize: 13, padding: 4 }}>No tasks match the current filter.</div>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                {['ID', 'Status', 'Priority', 'Owner', 'Title', 'Risk', 'Depends On'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={td()}><code style={{ fontSize: 11, color: '#93c5fd' }}>{t.id}</code></td>
                  <td style={td()}>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={td()}>
                    <PriorityDot priority={t.priority} />
                  </td>
                  <td style={td()}><span style={{ color: '#9ca3af' }}>{t.owner || '—'}</span></td>
                  <td style={{ ...td(), maxWidth: 360 }}>
                    <span style={{ color: '#d1d5db', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  </td>
                  <td style={td()}>
                    {t.risk && (
                      <span style={{ color: t.risk === 'high' ? '#ef4444' : t.risk === 'medium' ? '#f97316' : '#6b7280', fontSize: 11 }}>
                        {t.risk}
                      </span>
                    )}
                  </td>
                  <td style={td()}>
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      background: STATUS_COLOR[status] ?? '#6b7280',
      color: '#fff',
      borderRadius: 4,
      padding: '1px 8px',
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>{status.replace(/_/g, ' ')}</span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const color = priority === 'high' ? '#ef4444' : priority === 'medium' ? '#f97316' : '#6b7280'
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 11, color: '#9ca3af' }}>{priority || '—'}</span>
    </span>
  )
}

function td(): React.CSSProperties {
  return { padding: '7px 10px', verticalAlign: 'middle' }
}

import type React from 'react'
