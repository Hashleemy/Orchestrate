import { useEffect, useRef, useState } from 'react'
import { Glyph } from './Glyph'
import type { RunRecord } from '../types'

interface Props {
  runs: RunRecord[]
  onRerun?: (run: RunRecord) => void
}

type RunStatus = RunRecord['status']
const STATUS_OPTIONS: RunStatus[] = ['complete', 'stopped', 'active', 'paused', 'idle']
const FILTER_KEY = 'orchestrate.runhistory.statusfilter'

function loadStatusFilter(): Set<RunStatus> {
  try {
    const raw = window.localStorage?.getItem(FILTER_KEY)
    if (!raw) return new Set(STATUS_OPTIONS)
    const arr = JSON.parse(raw) as string[]
    const valid = arr.filter((s): s is RunStatus => (STATUS_OPTIONS as string[]).includes(s))
    return new Set(valid.length ? valid : STATUS_OPTIONS)
  } catch {
    return new Set(STATUS_OPTIONS)
  }
}

function saveStatusFilter(set: Set<RunStatus>) {
  try { window.localStorage?.setItem(FILTER_KEY, JSON.stringify(Array.from(set))) } catch { /* ignore */ }
}

function duration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function StatusBadge({ status }: { status: RunRecord['status'] }) {
  const colors: Record<string, string> = {
    complete: '#16a34a',
    stopped:  '#6b7280',
    active:   '#2563eb',
    paused:   '#d97706',
    idle:     '#374151',
  }
  return (
    <span style={{
      background: colors[status] ?? '#374151',
      color: '#fff', fontSize: 11, fontWeight: 700,
      borderRadius: 4, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{status}</span>
  )
}

function buildRunMarkdown(run: RunRecord): string {
  const lines: string[] = []
  lines.push(`# Run ${run.id}`)
  lines.push('')
  lines.push(`- **Status:** ${run.status}`)
  lines.push(`- **Started:** ${run.started_at}`)
  if (run.ended_at) lines.push(`- **Ended:** ${run.ended_at}`)
  lines.push(`- **Duration:** ${duration(run.duration_sec)}`)
  lines.push(`- **Repo:** \`${run.repo_path}\``)
  lines.push(`- **Tasks:** ${run.tasks_done}/${run.tasks_total}`)
  lines.push(`- **Events:** ${run.event_count}`)
  lines.push(`- **Agents:** ${run.workers.join(', ') || '—'}`)
  if (run.done_ids.length > 0) {
    lines.push('')
    lines.push('## Completed Tasks')
    for (const id of run.done_ids) lines.push(`- ${id}`)
  }
  if (run.summary) {
    lines.push('')
    lines.push('## Summary')
    lines.push('')
    lines.push('```')
    lines.push(run.summary)
    lines.push('```')
  }
  return lines.join('\n') + '\n'
}

function downloadMarkdown(filename: string, body: string) {
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadRunMarkdown(run: RunRecord) {
  downloadMarkdown(`run-${run.id}.md`, buildRunMarkdown(run))
}

function downloadAllRunsMarkdown(runs: RunRecord[]) {
  const header = `# Run History (${runs.length})\n\nExported ${new Date().toISOString()}\n\n`
  const body = runs.map(buildRunMarkdown).join('\n---\n\n')
  downloadMarkdown(`runs-${new Date().toISOString().slice(0, 10)}.md`, header + body)
}

function RunRow({ run, expanded, onToggle, selected, onSelect, rowRef, onRerun }: {
  run: RunRecord
  expanded: boolean
  onToggle: () => void
  selected?: boolean
  onSelect?: () => void
  rowRef?: (el: HTMLDivElement | null) => void
  onRerun?: (run: RunRecord) => void
}) {
  const pct = run.tasks_total > 0 ? Math.round((run.tasks_done / run.tasks_total) * 100) : 0

  return (
    <div ref={rowRef} style={{
      borderBottom: '1px solid #1f2937',
      borderLeft: selected ? '3px solid #38bdf8' : '3px solid transparent',
    }}>
      <button
        onClick={() => { onSelect?.(); onToggle() }}
        onMouseEnter={onSelect}
        style={{
          width: '100%', background: selected ? '#0b1d33' : expanded ? '#0f172a' : 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '10px 16px', textAlign: 'left',
          position: expanded ? 'sticky' : undefined,
          top: expanded ? 0 : undefined,
          zIndex: expanded ? 2 : undefined,
          borderBottom: expanded ? '1px solid #1f2937' : undefined,
        }}
      >
        <span style={{ color: '#6b7280', fontSize: 12, minWidth: 130 }}>
          {formatDate(run.started_at)}
        </span>
        <StatusBadge status={run.status} />
        <span style={{ color: '#d1d5db', fontSize: 13, flex: 1 }}>
          {run.tasks_done}/{run.tasks_total} tasks done
        </span>
        <div style={{ width: 80, background: '#374151', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, background: '#16a34a', height: '100%' }} />
        </div>
        <span style={{ color: '#6b7280', fontSize: 12, minWidth: 50, textAlign: 'right' }}>
          {duration(run.duration_sec)}
        </span>
        <span style={{ color: '#6b7280', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{
          padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'runrow-expand 180ms ease-out',
        }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Detail label="Run ID" value={run.id} mono />
            <Detail label="Repo" value={run.repo_path} mono />
            <Detail label="Events" value={String(run.event_count)} />
            <Detail label="Agents" value={run.workers.join(', ') || '—'} />
          </div>
          {run.done_ids.length > 0 && (
            <div>
              <span style={{ color: '#6b7280', fontSize: 12 }}>Completed tasks: </span>
              <span style={{ color: '#d1d5db', fontSize: 12 }}>{run.done_ids.join(', ')}</span>
            </div>
          )}
          {run.summary && (
            <pre style={{
              background: '#0f172a', borderRadius: 6, padding: 12,
              color: '#94a3b8', fontSize: 12, fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', margin: 0, maxHeight: 200, overflowY: 'auto',
            }}>{run.summary}</pre>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => downloadRunMarkdown(run)}
              style={{
                background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb',
                borderRadius: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >⬇ Export as Markdown</button>
            {onRerun && (
              <button
                onClick={() => onRerun(run)}
                title={`Open Start Run prefilled with ${run.workers.length || 1} worker${run.workers.length === 1 ? '' : 's'}`}
                style={{
                  background: '#14532d', color: '#86efac', border: '1px solid #16a34a',
                  borderRadius: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >↻ Rerun</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#d1d5db', fontSize: 12, fontFamily: mono ? 'monospace' : undefined }}>{value}</div>
    </div>
  )
}

export function RunHistory({ runs, onRerun }: Props) {
  const [statusFilter, setStatusFilter] = useState<Set<RunStatus>>(() => loadStatusFilter())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState<number>(-1)
  const [hovered, setHovered] = useState(false)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => { saveStatusFilter(statusFilter) }, [statusFilter])

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleStatus(s: RunStatus) {
    setStatusFilter(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      if (next.size === 0) return new Set(STATUS_OPTIONS)
      return next
    })
  }

  function resetFilter() { setStatusFilter(new Set(STATUS_OPTIONS)) }

  if (runs.length === 0) {
    return (
      <div style={{
        background: '#1f2937', border: '1px solid #374151', borderRadius: 8, padding: 24,
        color: '#6b7280', fontSize: 13, textAlign: 'center', lineHeight: 1.6,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Glyph name="runs" size={22} /></div>
        No runs recorded yet. Each run you start will show up here with
        duration, tasks completed, and an export-to-Markdown option.
      </div>
    )
  }

  const allSelected = statusFilter.size === STATUS_OPTIONS.length
  const filtered = allSelected ? runs : runs.filter(r => statusFilter.has(r.status))
  const counts: Record<RunStatus, number> = {
    complete: 0, stopped: 0, active: 0, paused: 0, idle: 0,
  }
  for (const r of runs) counts[r.status] = (counts[r.status] ?? 0) + 1

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setCursor(-1) }}
      style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}
    >
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#f9fafb', fontWeight: 700, fontSize: 14 }}>Run History</span>
        <span style={{
          background: '#374151', color: '#9ca3af', borderRadius: 10,
          padding: '1px 8px', fontSize: 12,
        }}>{allSelected ? runs.length : `${filtered.length}/${runs.length}`}</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(s => {
            const on = statusFilter.has(s)
            const dim = counts[s] === 0
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                disabled={dim}
                title={dim ? `No runs with status ${s}` : `Toggle ${s}`}
                style={{
                  background: on ? '#0f172a' : 'transparent',
                  border: `1px solid ${on ? '#2563eb' : '#374151'}`,
                  color: on ? '#93c5fd' : '#6b7280',
                  borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  cursor: dim ? 'default' : 'pointer',
                  opacity: dim ? 0.4 : 1,
                }}
              >{s} <span style={{ opacity: 0.6, marginLeft: 2 }}>{counts[s]}</span></button>
            )
          })}
          {!allSelected && (
            <button
              onClick={resetFilter}
              style={{
                background: 'transparent', border: '1px solid #374151', color: '#9ca3af',
                borderRadius: 10, padding: '1px 8px', fontSize: 11, cursor: 'pointer',
              }}
              title="Show all"
            >reset</button>
          )}
        </div>
        <button
          onClick={() => downloadAllRunsMarkdown(filtered)}
          style={{
            marginLeft: 'auto',
            background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb',
            borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}
        >⬇ Export {allSelected ? 'all' : 'shown'}</button>
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 20, color: '#6b7280', fontSize: 12, textAlign: 'center' }}>
          No runs match this filter.
        </div>
      ) : (
        filtered.map((r, i) => (
          <RunRow
            key={r.id}
            run={r}
            expanded={expanded.has(r.id)}
            onToggle={() => toggleExpanded(r.id)}
            selected={cursor === i}
            onSelect={() => setCursor(i)}
            rowRef={(el) => { rowRefs.current[i] = el }}
            onRerun={onRerun}
          />
        ))
      )}
      {hovered && (
        <RunHistoryKeyNav
          count={filtered.length}
          cursor={cursor}
          setCursor={setCursor}
          onEnter={() => {
            const run = filtered[cursor]
            if (run) toggleExpanded(run.id)
          }}
          rowRefs={rowRefs}
        />
      )}
    </div>
  )
}

function RunHistoryKeyNav({ count, cursor, setCursor, onEnter, rowRefs }: {
  count: number
  cursor: number
  setCursor: (v: number | ((c: number) => number)) => void
  onEnter: () => void
  rowRefs: { current: Array<HTMLDivElement | null> }
}) {
  useEffect(() => {
    function isTyping(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e.target)) return
      if (count === 0) return
      if (e.key === 'j') {
        e.preventDefault()
        setCursor((c: number) => Math.min(count - 1, c < 0 ? 0 : c + 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setCursor((c: number) => Math.max(0, c < 0 ? 0 : c - 1))
      } else if (e.key === 'Enter' && cursor >= 0) {
        onEnter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, cursor, onEnter, setCursor])

  useEffect(() => {
    if (cursor < 0) return
    const el = rowRefs.current[cursor]
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursor, rowRefs])

  return null
}
