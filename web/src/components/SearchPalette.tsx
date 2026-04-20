import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import type { AgentStatus, OrchestratorEvent, Task } from '../types'

export type SearchResult =
  | { kind: 'agent'; id: string; label: string; detail: string }
  | { kind: 'task';  id: string; label: string; detail: string }
  | { kind: 'event'; agent: string; taskId: string | null; label: string; detail: string; ts: number }

export interface PaletteActions {
  onPickAgent: (id: string) => void
  onPickTask:  (task: Task) => void
  onPickEvent: (event: SearchResult & { kind: 'event' }) => void
}

interface Props {
  open:    boolean
  onClose: () => void
  agents:  AgentStatus[]
  tasks:   Task[]
  events:  OrchestratorEvent[]
  actions: PaletteActions
}

const MAX_RESULTS = 12
const EVENT_HISTORY = 200

let sessionQuery = ''

export function SearchPalette({ open, onClose, agents, tasks, events, actions }: Props) {
  const [q, setQState] = useState(() => sessionQuery)
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function setQ(v: string) {
    sessionQuery = v
    setQState(v)
  }

  useEffect(() => {
    if (!open) return
    setIdx(0)
    const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10)
    return () => clearTimeout(t)
  }, [open])

  const results = useMemo<SearchResult[]>(() => {
    const query = q.trim().toLowerCase()
    if (!query) {
      return [
        ...agents.slice(0, 4).map<SearchResult>(a => ({
          kind: 'agent', id: a.agent,
          label: a.agent,
          detail: `${a.state}${a.task_id ? ' · ' + a.task_id : ''}`,
        })),
        ...tasks.slice(0, 6).map<SearchResult>(t => ({
          kind: 'task', id: t.id,
          label: `${t.id} — ${t.title}`,
          detail: `${t.status}${t.owner ? ' · ' + t.owner : ''}`,
        })),
      ].slice(0, MAX_RESULTS)
    }

    const out: SearchResult[] = []
    for (const a of agents) {
      const hay = `${a.agent} ${a.state} ${a.task_id ?? ''} ${a.branch ?? ''}`.toLowerCase()
      if (hay.includes(query)) {
        out.push({
          kind: 'agent', id: a.agent,
          label: a.agent,
          detail: `${a.state}${a.task_id ? ' · ' + a.task_id : ''}`,
        })
      }
    }
    for (const t of tasks) {
      const hay = `${t.id} ${t.title} ${t.owner ?? ''} ${t.status}`.toLowerCase()
      if (hay.includes(query)) {
        out.push({
          kind: 'task', id: t.id,
          label: `${t.id} — ${t.title}`,
          detail: `${t.status}${t.owner ? ' · ' + t.owner : ''}`,
        })
      }
    }
    const recent = events.slice(-EVENT_HISTORY)
    for (let i = recent.length - 1; i >= 0; i--) {
      const e = recent[i]
      const hay = `${e.type} ${e.detail ?? ''} ${e.agent} ${e.task_id ?? ''}`.toLowerCase()
      if (hay.includes(query)) {
        out.push({
          kind: 'event',
          agent: e.agent,
          taskId: e.task_id ?? null,
          label: `${e.type.replace(/_/g, ' ')} — ${e.agent}`,
          detail: e.detail ?? '',
          ts: new Date(e.timestamp).getTime(),
        })
      }
      if (out.length >= MAX_RESULTS) break
    }
    return out.slice(0, MAX_RESULTS)
  }, [q, agents, tasks, events])

  useEffect(() => { if (idx >= results.length) setIdx(Math.max(0, results.length - 1)) }, [results, idx])

  if (!open) return null

  function pick(r: SearchResult) {
    if (r.kind === 'agent') actions.onPickAgent(r.id)
    else if (r.kind === 'task') {
      const t = tasks.find(t => t.id === r.id)
      if (t) actions.onPickTask(t)
    } else {
      actions.onPickEvent(r)
    }
    onClose()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault(); setIdx(i => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault(); setIdx(i => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[idx]) pick(results[idx])
    } else if (e.key === 'Escape') {
      e.preventDefault(); onClose()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '94vw',
          background: '#0f172a', border: '1px solid #334155',
          borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column', maxHeight: '70vh', overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setIdx(0) }}
          onKeyDown={onKey}
          placeholder="Search agents, tasks, events…"
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#e2e8f0', fontSize: 15, padding: '14px 18px',
            borderBottom: '1px solid #1f2937',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ overflowY: 'auto', padding: 4 }}>
          {results.length === 0 ? (
            <div style={{ padding: '20px 18px', color: '#64748b', fontSize: 13 }}>
              {q ? 'No matches.' : 'Start typing to search.'}
            </div>
          ) : results.map((r, i) => (
            <ResultRow key={resultKey(r, i)} result={r} active={i === idx} onHover={() => setIdx(i)} onPick={() => pick(r)} />
          ))}
        </div>
        <div style={{
          padding: '7px 14px', borderTop: '1px solid #1f2937',
          color: '#475569', fontSize: 11, display: 'flex', gap: 14,
        }}>
          <span><kbd style={kbd}>↑</kbd><kbd style={kbd}>↓</kbd> navigate</span>
          <span><kbd style={kbd}>Enter</kbd> select</span>
          <span><kbd style={kbd}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

function resultKey(r: SearchResult, i: number): string {
  if (r.kind === 'agent') return `a|${r.id}|${i}`
  if (r.kind === 'task')  return `t|${r.id}|${i}`
  return `e|${r.agent}|${r.ts}|${i}`
}

const TYPE_COLOR: Record<SearchResult['kind'], string> = {
  agent: '#60a5fa',
  task:  '#5eead4',
  event: '#c084fc',
}

const TYPE_LABEL: Record<SearchResult['kind'], string> = {
  agent: 'AGENT',
  task:  'TASK',
  event: 'EVENT',
}

const kbd: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 10,
  border: '1px solid #1f2937', padding: '1px 5px',
  borderRadius: 3, background: '#0b1220', color: '#94a3b8',
  marginRight: 4,
}

function ResultRow({ result, active, onHover, onPick }: { result: SearchResult; active: boolean; onHover: () => void; onPick: () => void }) {
  return (
    <div
      onMouseEnter={onHover}
      onClick={onPick}
      style={{
        padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
        background: active ? '#1e293b' : 'transparent',
        display: 'flex', gap: 10, alignItems: 'center',
      }}
    >
      <span style={{
        color: TYPE_COLOR[result.kind],
        background: TYPE_COLOR[result.kind] + '15',
        border: `1px solid ${TYPE_COLOR[result.kind]}30`,
        borderRadius: 3, padding: '1px 6px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', minWidth: 46, textAlign: 'center',
      }}>{TYPE_LABEL[result.kind]}</span>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <span style={{ color: '#e2e8f0', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.label}</span>
        {result.detail && <span style={{ color: '#64748b', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.detail}</span>}
      </div>
    </div>
  )
}
