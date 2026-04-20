import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Glyph } from './Glyph'
import { CopyId } from './CopyId'
import type { AgentMessage, OrchestratorEvent } from '../types'

const SHA_RE = /\b([a-f0-9]{7,40})\b/i

interface Props {
  events:   OrchestratorEvent[]
  messages: AgentMessage[]
  maxItems?: number
  agentFilter?: string | null
  onClearAgentFilter?: () => void
  taskFilter?: string | null
  onTaskFilterChange?: (id: string | null) => void
}

type FeedItem =
  | { kind: 'event';   ts: number; data: OrchestratorEvent }
  | { kind: 'message'; ts: number; data: AgentMessage }

type TypeFilter = 'all' | 'events' | 'messages'

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

export function CommFeed({ events, messages, maxItems = 120, agentFilter = null, onClearAgentFilter, taskFilter: taskFilterProp, onTaskFilterChange }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [newSinceScroll, setNewSinceScroll] = useState(0)
  const [internalTaskFilter, setInternalTaskFilter] = useState<string | null>(null)
  const taskFilter = taskFilterProp !== undefined ? taskFilterProp : internalTaskFilter
  const setTaskFilter = (id: string | null) => {
    if (onTaskFilterChange) onTaskFilterChange(id)
    else setInternalTaskFilter(id)
  }
  const scrollRef = useRef<HTMLDivElement | null>(null)

  let items: FeedItem[] = [
    ...(typeFilter === 'messages' ? [] : events.map(e => ({ kind: 'event' as const, ts: new Date(e.timestamp).getTime(), data: e }))),
    ...(typeFilter === 'events'   ? [] : messages.map(m => ({ kind: 'message' as const, ts: new Date(m.timestamp).getTime(), data: m }))),
  ]

  if (agentFilter) {
    items = items.filter(it => it.kind === 'event'
      ? it.data.agent === agentFilter
      : it.data.from === agentFilter || it.data.to === agentFilter)
  }

  if (taskFilter) {
    items = items.filter(it => it.data.task_id === taskFilter)
  }

  const q = search.trim().toLowerCase()
  if (q) {
    items = items.filter(it => {
      if (it.kind === 'event') {
        return `${it.data.type} ${it.data.detail ?? ''} ${it.data.agent} ${it.data.task_id ?? ''}`.toLowerCase().includes(q)
      }
      return `${it.data.type} ${it.data.body ?? ''} ${it.data.from} ${it.data.to} ${it.data.task_id ?? ''}`.toLowerCase().includes(q)
    })
  }

  items = items.sort((a, b) => b.ts - a.ts).slice(0, maxItems)

  const mounted = useRef(false)
  const knownKeys = useRef<Set<string>>(new Set())
  const [flashingKeys, setFlashingKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!mounted.current) {
      for (const it of items) knownKeys.current.add(feedKey(it))
      mounted.current = true
      return
    }
    const newKeys: string[] = []
    for (const it of items) {
      const k = feedKey(it)
      if (!knownKeys.current.has(k)) {
        newKeys.push(k)
        knownKeys.current.add(k)
      }
    }
    if (newKeys.length === 0) return
    setFlashingKeys(prev => {
      const next = new Set(prev)
      for (const k of newKeys) next.add(k)
      return next
    })
    const t = window.setTimeout(() => {
      setFlashingKeys(prev => {
        const next = new Set(prev)
        for (const k of newKeys) next.delete(k)
        return next
      })
    }, 2000)

    const el = scrollRef.current
    const atTop = !el || el.scrollTop < 24
    if (autoScroll && atTop) {
      if (el) el.scrollTop = 0
      setNewSinceScroll(0)
    } else {
      setNewSinceScroll(n => n + newKeys.length)
    }

    return () => window.clearTimeout(t)
  }, [items, autoScroll])

  function jumpToNewest() {
    const el = scrollRef.current
    if (el) el.scrollTop = 0
    setAutoScroll(true)
    setNewSinceScroll(0)
  }

  const filterBar = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search communications…"
        style={{
          background: '#0f172a', border: '1px solid #334155',
          color: '#e2e8f0', borderRadius: 4,
          padding: '3px 9px', fontSize: 12, fontFamily: 'monospace',
          width: 220, outline: 'none',
        }}
      />
      {q && (
        <button
          onClick={() => setSearch('')}
          style={{
            background: 'none', border: '1px solid #374151',
            color: '#9ca3af', borderRadius: 4,
            padding: '2px 8px', fontSize: 11, cursor: 'pointer',
          }}
        >Clear</button>
      )}
      {(['all', 'events', 'messages'] as TypeFilter[]).map(opt => (
        <button
          key={opt}
          onClick={() => setTypeFilter(opt)}
          style={{
            background: typeFilter === opt ? '#2563eb' : 'transparent',
            color:      typeFilter === opt ? '#fff' : '#9ca3af',
            border:     `1px solid ${typeFilter === opt ? '#2563eb' : '#374151'}`,
            borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.03em', cursor: 'pointer',
          }}
        >{opt}</button>
      ))}
      {agentFilter && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#1e3a8a', color: '#dbeafe',
          border: '1px solid #3b82f6', borderRadius: 12,
          padding: '2px 4px 2px 10px', fontSize: 11, fontWeight: 600,
        }}>
          {agentFilter}
          {onClearAgentFilter && (
            <button onClick={onClearAgentFilter} style={{
              background: 'none', border: 'none', color: '#dbeafe',
              cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1,
            }} title="Clear agent filter">×</button>
          )}
        </span>
      )}
      {taskFilter && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#134e4a', color: '#ccfbf1',
          border: '1px solid #14b8a6', borderRadius: 12,
          padding: '2px 4px 2px 10px', fontSize: 11, fontWeight: 600,
        }}>
          {taskFilter}
          <button onClick={() => setTaskFilter(null)} style={{
            background: 'none', border: 'none', color: '#ccfbf1',
            cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1,
          }} title="Clear task filter">×</button>
        </span>
      )}
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto', color: '#9ca3af', fontSize: 11, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={autoScroll}
          onChange={e => setAutoScroll(e.target.checked)}
          style={{ accentColor: '#2563eb' }}
        />
        auto-scroll to newest
      </label>
    </div>
  )

  if (items.length === 0) {
    return (
      <>
        {filterBar}
        <div style={{ color: '#6b7280', fontSize: 13, padding: '12px 4px', lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}><Glyph name="comms" size={22} /></div>
          {agentFilter
            ? `No communications for ${agentFilter} yet.`
            : 'No communications yet. Events and inter-agent messages will stream here live.'}
        </div>
      </>
    )
  }

  return (
    <>
      {filterBar}
      <div style={{ position: 'relative' }}>
        <div
          ref={scrollRef}
          onScroll={e => {
            const el = e.currentTarget
            if (el.scrollTop > 24 && autoScroll) setAutoScroll(false)
            if (el.scrollTop < 24) setNewSinceScroll(0)
          }}
          style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {items.map((item) => {
            const k = feedKey(item)
            const flash = flashingKeys.has(k)
            return item.kind === 'event'
              ? <EventRow key={k} event={item.data} flash={flash} onTaskClick={setTaskFilter} />
              : <MessageRow key={k} message={item.data} flash={flash} onTaskClick={setTaskFilter} />
          })}
        </div>
        {!autoScroll && newSinceScroll > 0 && (
          <button
            onClick={jumpToNewest}
            style={{
              position: 'absolute', top: 6, right: 10,
              background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 14,
              padding: '3px 12px', fontSize: 11, fontWeight: 700,
              boxShadow: '0 2px 10px rgba(0,0,0,0.4)', cursor: 'pointer',
            }}
          >Jump to newest ({newSinceScroll}) ↑</button>
        )}
      </div>
    </>
  )
}

function feedKey(item: FeedItem): string {
  if (item.kind === 'event') {
    const d = item.data
    return `e|${d.agent}|${d.timestamp}|${d.type}|${d.detail ?? ''}`
  }
  const d = item.data
  return `m|${d.from}|${d.to}|${d.timestamp}|${d.body ?? ''}`
}

function EventRow({ event, flash, onTaskClick }: { event: OrchestratorEvent; flash?: boolean; onTaskClick?: (id: string) => void }) {
  const color = EVENT_COLOR[event.type] ?? '#6b7280'
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '4px 0 4px 6px', borderBottom: '1px solid #111827',
      borderLeft: flash ? `3px solid ${color}` : '3px solid transparent',
      background: flash ? `${color}10` : undefined,
      transition: 'background 600ms ease, border-left-color 600ms ease',
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
        <code
          onClick={() => onTaskClick?.(event.task_id)}
          title={`Filter feed to ${event.task_id}`}
          style={{ fontSize: 10, color: '#475569', cursor: onTaskClick ? 'pointer' : 'default' }}
        >{event.task_id}</code>
      )}
      <span style={{ color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {renderEventDetail(event)}
      </span>
    </div>
  )
}

function renderEventDetail(event: OrchestratorEvent): ReactNode {
  const detail = event.detail ?? ''
  if (event.type !== 'commit' && event.type !== 'push' && event.type !== 'merged') return detail
  const m = detail.match(SHA_RE)
  if (!m) return detail
  const sha = m[1]
  const idx = m.index ?? 0
  return (
    <>
      {detail.slice(0, idx)}
      <CopyId value={sha} color="#a78bfa" />
      {detail.slice(idx + sha.length)}
    </>
  )
}

function MessageRow({ message, flash, onTaskClick }: { message: AgentMessage; flash?: boolean; onTaskClick?: (id: string) => void }) {
  const color = MSG_TYPE_COLOR[message.type] ?? '#6b7280'
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '5px 0 5px 6px', borderBottom: '1px solid #111827',
      borderLeft: flash ? `3px solid ${color}` : '3px solid transparent',
      background: flash ? `${color}10` : undefined,
      transition: 'background 600ms ease, border-left-color 600ms ease',
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
        <code
          onClick={() => onTaskClick?.(message.task_id)}
          title={`Filter feed to ${message.task_id}`}
          style={{ fontSize: 10, color: '#475569', cursor: onTaskClick ? 'pointer' : 'default' }}
        >{message.task_id}</code>
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
