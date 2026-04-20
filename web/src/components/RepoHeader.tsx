import { useRef, useState } from 'react'
import type React from 'react'
import { api } from '../api/client'
import type { AgentStatus, Task } from '../types'

interface Props {
  agents:         AgentStatus[]
  tasks:          Task[]
  repoPath?:      string
  onChangeRepo?:  (path: string) => Promise<void>
}

export function RepoHeader({ agents, tasks, repoPath, onChangeRepo }: Props) {
  const [editing,  setEditing]  = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [err,      setErr]      = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setInputVal(repoPath ?? '')
    setErr(null)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setEditing(false)
    setErr(null)
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!onChangeRepo || !inputVal.trim()) return
    setSaving(true)
    setErr(null)
    try {
      await onChangeRepo(inputVal.trim())
      setEditing(false)
    } catch (ex) {
      setErr(String(ex).replace(/^Error: /, ''))
    } finally {
      setSaving(false)
    }
  }

  async function browseFolder() {
    if (!onChangeRepo) return
    setErr(null)
    setSaving(true)
    try {
      const { path } = await api.pickRepo()
      if (!path) return // user cancelled
      if (editing) {
        setInputVal(path)
        await onChangeRepo(path)
        setEditing(false)
      } else {
        await onChangeRepo(path)
      }
    } catch (ex) {
      setErr(String(ex).replace(/^Error: /, ''))
      if (!editing) setEditing(true)
    } finally {
      setSaving(false)
    }
  }
  const done       = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const blocked    = tasks.filter(t => t.status === 'blocked').length
  const total      = tasks.length

  const activeBranches = [...new Set(agents.map(a => a.branch).filter(Boolean))]
  const runState = deriveRunState(agents, tasks)

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e3a5f',
      borderRadius: 10,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      flexWrap: 'wrap',
      marginBottom: 24,
    }}>
      {/* Repo path */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={browseFolder}
          disabled={!onChangeRepo || saving}
          title="Browse for repository folder"
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 18, lineHeight: 1,
            cursor: onChangeRepo && !saving ? 'pointer' : 'default',
            opacity: saving ? 0.5 : 1,
          }}
        >📁</button>
        <div>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Repository</div>
          {editing ? (
            <form onSubmit={submitEdit} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              <input
                ref={inputRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="C:\path\to\repo"
                style={{
                  background: '#0f172a', border: `1px solid ${err ? '#ef4444' : '#334155'}`,
                  color: '#e2e8f0', borderRadius: 4,
                  padding: '3px 8px', fontSize: 12, fontFamily: 'monospace',
                  width: 280, outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={browseFolder}
                disabled={saving}
                style={{
                  background: 'none', border: '1px solid #334155',
                  color: '#cbd5e1', borderRadius: 4,
                  padding: '3px 8px', fontSize: 11, cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >Browse…</button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: '#1d4ed8', border: 'none',
                  color: '#fff', borderRadius: 4,
                  padding: '3px 10px', fontSize: 11, cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >{saving ? '…' : 'Open'}</button>
              <button
                type="button"
                onClick={cancelEdit}
                style={{
                  background: 'none', border: '1px solid #334155',
                  color: '#94a3b8', borderRadius: 4,
                  padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                }}
              >Cancel</button>
              {err && <span style={{ fontSize: 11, color: '#ef4444', maxWidth: 200 }}>{err}</span>}
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#93c5fd', fontFamily: 'monospace' }}>
                {repoPath ?? <span style={{ color: '#475569', fontStyle: 'italic' }}>not connected</span>}
              </span>
              {onChangeRepo && (
                <button
                  onClick={startEdit}
                  style={{
                    background: 'none', border: '1px solid #1e3a5f',
                    color: '#475569', borderRadius: 4,
                    padding: '1px 7px', fontSize: 10, cursor: 'pointer',
                  }}
                >Change</button>
              )}
            </div>
          )}
        </div>
      </div>

      <Divider />

      {/* Run state */}
      <div>
        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Run State</div>
        <RunStateBadge state={runState} />
      </div>

      <Divider />

      {/* Task progress */}
      <div>
        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Tasks</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <StatChip label="done"        count={done}       color="#15803d" />
          <StatChip label="in progress" count={inProgress} color="#22c55e" />
          {blocked > 0 && <StatChip label="blocked" count={blocked} color="#f97316" />}
          <span style={{ fontSize: 11, color: '#475569' }}>/ {total}</span>
          {total > 0 && (
            <ProgressBar done={done} total={total} />
          )}
        </div>
      </div>

      <Divider />

      {/* Active branches */}
      <div>
        <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Active Branches</div>
        {activeBranches.length === 0
          ? <span style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>none</span>
          : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {activeBranches.map(b => (
                <code key={b} style={{
                  fontSize: 11, color: '#a5b4fc',
                  background: '#1e1b4b', borderRadius: 4,
                  padding: '1px 7px', border: '1px solid #312e81',
                }}>{b}</code>
              ))}
            </div>
        }
      </div>

      {/* Live indicator */}
      {agents.length > 0 && (
        <>
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 0 2px #052e1620',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
              {agents.length} agent{agents.length !== 1 ? 's' : ''} live
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function deriveRunState(agents: AgentStatus[], tasks: Task[]): string {
  if (agents.length === 0 && tasks.length === 0) return 'idle'
  if (agents.some(a => a.stale)) return 'stale'
  if (tasks.some(t => t.status === 'blocked')) return 'blocked'
  if (agents.some(a => a.state === 'awaiting_approval')) return 'awaiting approval'
  if (agents.some(a => a.state === 'coding' || a.state === 'testing')) return 'running'
  if (tasks.length > 0 && tasks.every(t => t.status === 'done')) return 'complete'
  if (agents.length > 0) return 'running'
  return 'idle'
}

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  idle:              { bg: '#1f2937', text: '#6b7280' },
  running:           { bg: '#052e16', text: '#22c55e' },
  blocked:           { bg: '#431407', text: '#f97316' },
  'awaiting approval': { bg: '#451a03', text: '#fbbf24' },
  stale:             { bg: '#450a0a', text: '#ef4444' },
  complete:          { bg: '#052e16', text: '#4ade80' },
}

function RunStateBadge({ state }: { state: string }) {
  const colors = STATE_COLORS[state] ?? STATE_COLORS.idle
  return (
    <span style={{
      background: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.text}30`,
      borderRadius: 6,
      padding: '3px 12px',
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>{state}</span>
  )
}

function StatChip({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontWeight: 700, color, fontSize: 13 }}>{count}</span>
      <span style={{ fontSize: 11, color: '#475569' }}>{label}</span>
    </span>
  )
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 72, height: 4, background: '#1f2937', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#22c55e', transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: '#475569' }}>{pct}%</span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 36, background: '#1e293b', flexShrink: 0 }} />
}
