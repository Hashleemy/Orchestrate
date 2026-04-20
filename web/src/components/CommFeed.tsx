import { useEffect, useRef, useState } from 'react'
import { Glyph } from './Glyph'
import type { AgentMessage, OrchestratorEvent } from '../types'

interface Props {
  events:   OrchestratorEvent[]
  messages: AgentMessage[]
  maxItems?: number
  agentFilter?: string | null
  onClearAgentFilter?: () => void
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

export function CommFeed({ events, messages, maxItems = 120, agentFilter = null, onClearAgentFilter }: Props) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  let items: FeedItem[] = [
    ...(typeFilter === 'messages' ? [] : events.map(e => ({ kind: 'event' as const, ts: new Date(e.timestamp).getTime(), data: e }))),
    ...(typeFilter === 'events'   ? [] : messages.map(m => ({ kind: 'message' as const, ts: new Date(m.timestamp).getTime(), data: m }))),
  ]

  if (agentFilter) {
    items = items.filter(it => it.kind === 'event'
      ? it.data.agent === agentFilter
      : it.data.from === agentFilter || it.data.to === agentFilter)
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
    return () => window.clearTimeout(t)
  }, [items])

  const filterBar = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
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
      <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => {
          const k = feedKey(item)
          const flash = flashingKeys.has(k)
          return item.kind === 'event'
            ? <EventRow key={k} event={item.data} flash={flash} />
            : <MessageRow key={k} message={item.data} flash={flash} />
        })}
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

function EventRow({ event, flash }: { event: OrchestratorEvent; flash?: boolean }) {
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
        <code style={{ fontSize: 10, color: '#475569' }}>{event.task_id}</code>
      )}
      <span style={{ color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {event.detail}
      </span>
    </div>
  )
}

function MessageRow({ message, flash }: { message: AgentMessage; flash?: boolean }) {
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
        <code style={{ fontSize: 10, color: '#475569' }}>{message.task_id}</code>
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
