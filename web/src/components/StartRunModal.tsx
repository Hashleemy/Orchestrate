import { useState } from 'react'

interface Props {
  onStart: (tasks: string, workerCount: number) => Promise<void>
  onClose: () => void
}

const PLACEHOLDER = `# Tasks

## Global Rules
- Do not edit files outside your assigned scope
- Request approval for package installs

## Active Tasks

### TASK-001
status: ready
priority: high
type: feature
title: Your task title here
owner: agent-backend-01
branch: agent/backend-01
worktree:
depends_on: []
blocked_by: []
files:
  - path/to/file.go
acceptance:
  - criterion one
risk: low
major_change: no`

export function StartRunModal({ onStart, onClose }: Props) {
  const [tasks, setTasks] = useState('')
  const [workerCount, setWorkerCount] = useState(1)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!tasks.trim()) { setErr('Paste your tasks.md content first.'); return }
    setLoading(true)
    setErr(null)
    try {
      await onStart(tasks, workerCount)
      onClose()
    } catch (e) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#1f2937', border: '1px solid #374151',
        borderRadius: 12, padding: 28, width: 640, maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#f9fafb', fontSize: 16, fontWeight: 700 }}>Start a Run</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
          Paste your <code style={{ color: '#d1d5db' }}>tasks.md</code> content. The coordinator agent will be spawned automatically.
          See <code style={{ color: '#d1d5db' }}>examples/tasks.md</code> for the format.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <label style={{ color: '#9ca3af', fontSize: 13, whiteSpace: 'nowrap' }}>Worker agents:</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setWorkerCount(n)}
                style={{
                  width: 36, height: 32, border: '1px solid',
                  borderColor: workerCount === n ? '#2563eb' : '#374151',
                  borderRadius: 6,
                  background: workerCount === n ? '#2563eb' : '#111827',
                  color: workerCount === n ? '#fff' : '#9ca3af',
                  cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}
              >{n}</button>
            ))}
          </div>
          <span style={{ color: '#6b7280', fontSize: 12 }}>
            {workerCount === 1 ? '1 worker + coordinator' : `${workerCount} workers + coordinator`}
          </span>
        </div>

        <textarea
          value={tasks}
          onChange={e => setTasks(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={18}
          style={{
            width: '100%', background: '#111827',
            border: '1px solid #374151', borderRadius: 6,
            color: '#d1d5db', fontSize: 12, fontFamily: 'monospace',
            padding: 12, resize: 'vertical', outline: 'none',
          }}
        />

        {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: '#374151', color: '#d1d5db', border: 'none',
            borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontWeight: 600,
          }}>Cancel</button>
          <button onClick={submit} disabled={loading} style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 24px', cursor: 'pointer', fontWeight: 600,
            opacity: loading ? 0.6 : 1,
          }}>{loading ? 'Starting…' : workerCount > 1 ? `Start Run (${workerCount} workers)` : 'Start Run'}</button>
        </div>
      </div>
    </div>
  )
}
