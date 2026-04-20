import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Glyph } from './Glyph'
import { CopyId } from './CopyId'
import { toast } from './Toast'
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

type TypeFilter = 'all' | 'events' | 'messages' | 'starred'

const STARRED_KEY = 'orchestrate.commfeed.starred'
const TYPE_FILTER_KEY = 'orchestrate.commfeed.typefilter'

function loadTypeFilter(): TypeFilter {
  try {
    const raw = localStorage.getItem(TYPE_FILTER_KEY)
    if (raw === 'all' || raw === 'events' || raw === 'messages' || raw === 'starred') return raw
  } catch { /* ignore */ }
  return 'all'
}

function saveTypeFilter(v: TypeFilter) {
  try { localStorage.setItem(TYPE_FILTER_KEY, v) } catch { /* ignore */ }
}

function loadStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr)
  } catch { /* ignore */ }
  return new Set()
}

function saveStarred(s: Set<string>) {
  try { localStorage.setItem(STARRED_KEY, JSON.stringify([...s])) } catch { /* ignore */ }
}

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
  const [typeFilter, setTypeFilterState] = useState<TypeFilter>(() => loadTypeFilter())
  const setTypeFilter = (v: TypeFilter) => { saveTypeFilter(v); setTypeFilterState(v) }
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [newSinceScroll, setNewSinceScroll] = useState(0)
  const [internalTaskFilter, setInternalTaskFilter] = useState<string | null>(null)
  const taskFilter = taskFilterProp !== undefined ? taskFilterProp : internalTaskFilter
  const setTaskFilter = (id: string | null) => {
    if (onTaskFilterChange) onTaskFilterChange(id)
    else setInternalTaskFilter(id)
  }
  const [starred, setStarred] = useState<Set<string>>(() => loadStarred())
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [cursor, setCursor] = useState<number>(-1)
  const [navHovered, setNavHovered] = useState(false)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])

  function toggleStar(key: string) {
    setStarred(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveStarred(next)
      return next
    })
  }

  const includeEvents   = typeFilter === 'all' || typeFilter === 'events'   || typeFilter === 'starred'
  const includeMessages = typeFilter === 'all' || typeFilter === 'messages' || typeFilter === 'starred'
  let items: FeedItem[] = [
    ...(includeEvents   ? events.map(e   => ({ kind: 'event'   as const, ts: new Date(e.timestamp).getTime(), data: e })) : []),
    ...(includeMessages ? messages.map(m => ({ kind: 'message' as const, ts: new Date(m.timestamp).getTime(), data: m })) : []),
  ]

  if (typeFilter === 'starred') {
    items = items.filter(it => starred.has(feedKey(it)))
  }

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

  type DedupedItem = FeedItem & { collapsedCount?: number }
  const deduped: DedupedItem[] = []
  for (const it of items) {
    const prev = deduped[deduped.length - 1] as DedupedItem | undefined
    if (prev && canCollapse(prev, it, starred)) {
      prev.collapsedCount = (prev.collapsedCount ?? 1) + 1
    } else {
      deduped.push({ ...it })
    }
  }

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

  const itemCount = deduped.length
  useEffect(() => {
    if (cursor >= itemCount) setCursor(itemCount > 0 ? itemCount - 1 : -1)
  }, [itemCount, cursor])

  useEffect(() => {
    if (!navHovered) return
    function isTypingTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (e.key === '/') {
        if (searchInputRef.current) {
          e.preventDefault()
          e.stopPropagation()
          searchInputRef.current.focus()
          searchInputRef.current.select()
        }
        return
      }
      if (itemCount === 0) return
      if (e.key === 'j') {
        e.preventDefault()
        setCursor(c => Math.min(itemCount - 1, c < 0 ? 0 : c + 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setCursor(c => Math.max(0, c < 0 ? 0 : c - 1))
      } else if (e.key === 'Enter' && cursor >= 0 && cursor < itemCount) {
        const it = deduped[cursor]
        const tid = it.data.task_id
        if (tid) {
          e.preventDefault()
          setTaskFilter(tid)
        }
      } else if (e.key === 'Escape' && cursor >= 0) {
        e.preventDefault()
        setCursor(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [itemCount, cursor, deduped, navHovered])

  useEffect(() => {
    if (cursor < 0) return
    const el = rowRefs.current[cursor]
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursor])

  const filterBar = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
      <input
        ref={searchInputRef}
        value={search}
        onChange={e => setSearch(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            setSearch('')
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder="Search communications…  (/ to focus)"
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
      {(['all', 'events', 'messages', 'starred'] as TypeFilter[]).map(opt => {
        const starFilter = opt === 'starred'
        const active = typeFilter === opt
        const activeColor = starFilter ? '#eab308' : '#2563eb'
        return (
          <button
            key={opt}
            onClick={() => setTypeFilter(opt)}
            style={{
              background: active ? activeColor : 'transparent',
              color:      active ? '#fff' : starFilter ? '#eab308' : '#9ca3af',
              border:     `1px solid ${active ? activeColor : starFilter ? '#854d0e' : '#374151'}`,
              borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.03em', cursor: 'pointer',
            }}
          >
            {starFilter ? `★ starred${starred.size > 0 ? ` (${starred.size})` : ''}` : opt}
          </button>
        )
      })}
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
          onMouseEnter={() => setNavHovered(true)}
          onMouseLeave={() => { setNavHovered(false); setCursor(-1) }}
          onScroll={e => {
            const el = e.currentTarget
            if (el.scrollTop > 24 && autoScroll) setAutoScroll(false)
            if (el.scrollTop < 24) setNewSinceScroll(0)
          }}
          style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {deduped.map((item, i) => {
            const k = feedKey(item)
            const flash = flashingKeys.has(k)
            const isStarred = starred.has(k)
            const selected = cursor === i
            const rowRef = (el: HTMLDivElement | null) => { rowRefs.current[i] = el }
            const count = item.collapsedCount
            return item.kind === 'event'
              ? <EventRow key={k} rowRef={rowRef} event={item.data} flash={flash} onTaskClick={setTaskFilter} starred={isStarred} onToggleStar={() => toggleStar(k)} selected={selected} onSelect={() => setCursor(i)} collapsedCount={count} />
              : <MessageRow key={k} rowRef={rowRef} message={item.data} flash={flash} onTaskClick={setTaskFilter} starred={isStarred} onToggleStar={() => toggleStar(k)} selected={selected} onSelect={() => setCursor(i)} collapsedCount={count} />
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

function canCollapse(a: FeedItem, b: FeedItem, starredSet: Set<string>): boolean {
  if (a.kind !== b.kind) return false
  if (Math.abs(a.ts - b.ts) > 2000) return false
  const aKey = feedKey(a)
  const bKey = feedKey(b)
  if (starredSet.has(aKey) || starredSet.has(bKey)) return false
  if (a.kind === 'event' && b.kind === 'event') {
    return a.data.agent === b.data.agent && a.data.type === b.data.type && (a.data.detail ?? '') === (b.data.detail ?? '')
  }
  if (a.kind === 'message' && b.kind === 'message') {
    return a.data.from === b.data.from && a.data.to === b.data.to && a.data.type === b.data.type && (a.data.body ?? '') === (b.data.body ?? '')
  }
  return false
}

function feedKey(item: FeedItem): string {
  if (item.kind === 'event') {
    const d = item.data
    return `e|${d.agent}|${d.timestamp}|${d.type}|${d.detail ?? ''}`
  }
  const d = item.data
  return `m|${d.from}|${d.to}|${d.timestamp}|${d.body ?? ''}`
}

function EventRow({ event, flash, onTaskClick, starred, onToggleStar, selected, onSelect, rowRef, collapsedCount }: { event: OrchestratorEvent; flash?: boolean; onTaskClick?: (id: string) => void; starred?: boolean; onToggleStar?: () => void; selected?: boolean; onSelect?: () => void; rowRef?: (el: HTMLDivElement | null) => void; collapsedCount?: number }) {
  const color = EVENT_COLOR[event.type] ?? '#6b7280'
  return (
    <div ref={rowRef} onClick={onSelect} className="commfeed-row" style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '4px 0 4px 6px', borderBottom: '1px solid #111827',
      borderLeft: selected ? '3px solid #38bdf8' : flash ? `3px solid ${color}` : starred ? '3px solid #eab308' : '3px solid transparent',
      background: selected ? '#082f49' : starred ? '#1a1408' : flash ? `${color}10` : undefined,
      boxShadow: selected ? 'inset 0 0 0 1px #0284c7' : undefined,
      transition: 'background 600ms ease, border-left-color 600ms ease',
      fontSize: 12,
      cursor: onSelect ? 'pointer' : undefined,
    }}>
      <StarButton starred={starred} onToggle={onToggleStar} />
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
      {collapsedCount && collapsedCount > 1 && <DedupeBadge count={collapsedCount} />}
      <CopyRowButton payload={event} label="event" />
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

function MessageRow({ message, flash, onTaskClick, starred, onToggleStar, selected, onSelect, rowRef, collapsedCount }: { message: AgentMessage; flash?: boolean; onTaskClick?: (id: string) => void; starred?: boolean; onToggleStar?: () => void; selected?: boolean; onSelect?: () => void; rowRef?: (el: HTMLDivElement | null) => void; collapsedCount?: number }) {
  const color = MSG_TYPE_COLOR[message.type] ?? '#6b7280'
  return (
    <div ref={rowRef} onClick={onSelect} className="commfeed-row" style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '5px 0 5px 6px', borderBottom: '1px solid #111827',
      borderLeft: selected ? '3px solid #38bdf8' : flash ? `3px solid ${color}` : starred ? '3px solid #eab308' : '3px solid transparent',
      background: selected ? '#082f49' : starred ? '#1a1408' : flash ? `${color}10` : undefined,
      boxShadow: selected ? 'inset 0 0 0 1px #0284c7' : undefined,
      transition: 'background 600ms ease, border-left-color 600ms ease',
      fontSize: 12,
      cursor: onSelect ? 'pointer' : undefined,
    }}>
      <StarButton starred={starred} onToggle={onToggleStar} />
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
      {collapsedCount && collapsedCount > 1 && <DedupeBadge count={collapsedCount} />}
      <CopyRowButton payload={message} label="message" />
    </div>
  )
}

function DedupeBadge({ count }: { count: number }) {
  return (
    <span
      title={`${count} consecutive duplicate rows collapsed`}
      style={{
        background: '#1e293b', color: '#94a3b8',
        border: '1px solid #334155', borderRadius: 10,
        padding: '0 6px', fontSize: 10, fontWeight: 700,
        alignSelf: 'center',
      }}
    >×{count}</span>
  )
}

function CopyRowButton({ payload, label }: { payload: unknown; label: string }) {
  async function doCopy(e: { stopPropagation: () => void }) {
    e.stopPropagation()
    try {
      const json = JSON.stringify(payload, null, 2)
      await navigator.clipboard.writeText(json)
      toast('success', `Copied ${label} JSON`)
    } catch {
      toast('error', 'Copy failed', 'Clipboard API unavailable')
    }
  }
  return (
    <button
      onClick={doCopy}
      title="Copy row as JSON"
      className="commfeed-copy"
      style={{
        background: 'transparent', border: '1px solid #334155',
        color: '#6b7280', cursor: 'pointer',
        fontSize: 10, padding: '0 6px', lineHeight: 1.4,
        borderRadius: 3, opacity: 0,
        transition: 'opacity 120ms ease, color 120ms ease, background 120ms ease',
        marginRight: 4, alignSelf: 'center',
      }}
    >copy</button>
  )
}

function StarButton({ starred, onToggle }: { starred?: boolean; onToggle?: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle?.() }}
      title={starred ? 'Unstar' : 'Star this item'}
      className="commfeed-star"
      style={{
        background: 'none', border: 'none', cursor: onToggle ? 'pointer' : 'default',
        color: starred ? '#eab308' : '#4b5563',
        fontSize: 11, padding: '0 2px', lineHeight: 1,
        opacity: starred ? 1 : 0,
        transition: 'opacity 120ms ease, color 120ms ease',
        alignSelf: 'center',
      }}
    >{starred ? '★' : '☆'}</button>
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
