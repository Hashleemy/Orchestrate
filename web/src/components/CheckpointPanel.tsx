import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { approvalKindColor, approvalKindIcon } from './approvalKind'
import { toast } from './Toast'
import type { Checkpoint, DiffSummary } from '../types'

const DIFF_KINDS = new Set(['protected_merge', 'major_change', 'lockfile_change'])
const DIFF_BADGE_COLOR: Record<string, string> = {
  minor:   '#22c55e',
  major:   '#f97316',
  blocked: '#ef4444',
}

function extractAgentId(detail: string): string | null {
  const m = detail.match(/\bagent-[a-z0-9_]+-\d+\b/i)
  return m ? m[0] : null
}

interface Props {
  checkpoints: Checkpoint[]
  onResolved:  () => void
}

const FILTER_KEY = 'orchestrate.checkpoint.kindfilter'
const HIDDEN_KEY = 'orchestrate.checkpoint.hidden'

function loadKindFilter(): Set<string> {
  try {
    const raw = window.localStorage?.getItem(FILTER_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr.filter(x => typeof x === 'string'))
  } catch { /* ignore */ }
  return new Set()
}

function saveKindFilter(s: Set<string>) {
  try { window.localStorage?.setItem(FILTER_KEY, JSON.stringify(Array.from(s))) } catch { /* ignore */ }
}

function loadHidden(): Set<string> {
  try {
    const raw = window.localStorage?.getItem(HIDDEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr.filter(x => typeof x === 'string'))
  } catch { /* ignore */ }
  return new Set()
}

function saveHidden(s: Set<string>) {
  try { window.localStorage?.setItem(HIDDEN_KEY, JSON.stringify(Array.from(s))) } catch { /* ignore */ }
}

export function CheckpointPanel({ checkpoints, onResolved }: Props) {
  // All hooks before any early returns — rule of hooks
  const pending = useMemo(() => checkpoints.filter(c => c.status === 'pending'), [checkpoints])
  const pendingIdStr = useMemo(() => pending.map(p => p.id).join(','), [pending])

  const [activeKinds, setActiveKinds] = useState<Set<string>>(() => loadKindFilter())
  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden())
  const [showHidden, setShowHidden] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState(false)

  useEffect(() => { saveKindFilter(activeKinds) }, [activeKinds])
  useEffect(() => { saveHidden(hidden) }, [hidden])

  useEffect(() => {
    const pendingIds = new Set(pendingIdStr.split(',').filter(Boolean))
    setHidden(prev => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (pendingIds.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [pendingIdStr])

  const visiblePending = useMemo(
    () => showHidden ? pending : pending.filter(c => !hidden.has(c.id)),
    [pending, showHidden, hidden]
  )
  const hiddenCount = pending.length - visiblePending.length
  const kindCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const cp of visiblePending) m.set(cp.kind, (m.get(cp.kind) ?? 0) + 1)
    return m
  }, [visiblePending])
  const kinds = useMemo(() => Array.from(kindCounts.keys()).sort(), [kindCounts])
  const effective = useMemo(() => activeKinds.size === 0 ? null : activeKinds, [activeKinds])
  const filtered = useMemo(
    () => effective ? visiblePending.filter(c => effective.has(c.kind)) : visiblePending,
    [visiblePending, effective]
  )
  const bulkResolvable = useMemo(
    () => filtered.filter(c => (c.next_steps?.length ?? 0) > 0),
    [filtered]
  )

  if (pending.length === 0) return null

  async function resolveAll() {
    setBulkBusy(true)
    let okCount = 0
    let failCount = 0
    for (const cp of bulkResolvable) {
      const step = cp.next_steps![0]
      try {
        await api.resolveCheckpoint(cp.id, step)
        okCount++
      } catch (e) {
        failCount++
        toast('error', `Failed to resolve ${cp.id}`, String(e).replace(/^Error: /, ''))
      }
    }
    if (okCount > 0) toast('success', `Resolved ${okCount} checkpoint${okCount === 1 ? '' : 's'}`, failCount > 0 ? `${failCount} failed` : undefined)
    setBulkBusy(false)
    setBulkConfirm(false)
    onResolved()
  }

  if (visiblePending.length === 0 && hiddenCount > 0) {
    return (
      <div style={{
        background: '#1c0a00', border: '2px dashed #4b2005', borderRadius: 10,
        padding: '10px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 13, color: '#9a5a2a' }}>
          {hiddenCount} checkpoint{hiddenCount !== 1 ? 's' : ''} hidden from view
        </span>
        <button
          onClick={() => setShowHidden(true)}
          style={{
            background: 'transparent', border: '1px solid #4b2005',
            color: '#fb923c', borderRadius: 4, padding: '2px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >Show hidden</button>
      </div>
    )
  }

  function toggleKind(k: string) {
    setActiveKinds(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  return (
    <div style={{
      background: '#1c0a00',
      border: '2px solid #f97316',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🛑</span>
        <h2 style={{ margin: 0, color: '#fb923c', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Orchestration Paused — {effective ? `${filtered.length}/${visiblePending.length}` : visiblePending.length} Checkpoint{visiblePending.length !== 1 ? 's' : ''} Require Your Attention
        </h2>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowHidden(s => !s)}
            style={{
              marginLeft: hiddenCount > 0 && bulkResolvable.length < 2 ? 'auto' : undefined,
              background: 'transparent', border: '1px solid #4b2005',
              color: '#fb923c', borderRadius: 4, padding: '2px 10px', fontSize: 11, cursor: 'pointer',
            }}
          >{showHidden ? `Hide silenced (${hiddenCount})` : `Show hidden (${hiddenCount})`}</button>
        )}
        {bulkResolvable.length >= 2 && (
          bulkConfirm ? (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#fbbf24' }}>Resolve {bulkResolvable.length} with default choice?</span>
              <button
                onClick={resolveAll}
                disabled={bulkBusy}
                style={{
                  background: '#b45309', border: 'none',
                  color: '#fff', borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  cursor: bulkBusy ? 'default' : 'pointer', opacity: bulkBusy ? 0.6 : 1,
                }}
              >{bulkBusy ? 'Resolving…' : 'Yes, resolve all'}</button>
              <button
                onClick={() => setBulkConfirm(false)}
                disabled={bulkBusy}
                style={{
                  background: 'transparent', border: '1px solid #4b2005',
                  color: '#9a5a2a', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
                }}
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setBulkConfirm(true)}
              title="Resolve every listed checkpoint with its first (default) next-step"
              style={{
                marginLeft: 'auto',
                background: '#431407', border: '1px solid #b45309',
                color: '#fdba74', borderRadius: 4, padding: '2px 10px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
              }}
            >Resolve all ({bulkResolvable.length})</button>
          )
        )}
      </div>

      {kinds.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {kinds.map(k => {
            const on = activeKinds.has(k)
            const color = approvalKindColor(k)
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                title={`Toggle ${k}`}
                style={{
                  background: on ? color + '30' : 'transparent',
                  border: `1px solid ${on ? color : '#4b2005'}`,
                  color: on ? color : '#9a5a2a',
                  borderRadius: 10, padding: '2px 9px', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  cursor: 'pointer',
                }}
              >{k.replace(/_/g, ' ')} <span style={{ opacity: 0.7, marginLeft: 2 }}>{kindCounts.get(k)}</span></button>
            )
          })}
          {activeKinds.size > 0 && (
            <button
              onClick={() => setActiveKinds(new Set())}
              style={{
                background: 'transparent', border: '1px solid #4b2005',
                color: '#9a5a2a', borderRadius: 10, padding: '2px 9px', fontSize: 11, cursor: 'pointer',
              }}
            >show all</button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ color: '#9a5a2a', fontSize: 12, fontStyle: 'italic' }}>
            No pending checkpoints match the current filter.
          </div>
        ) : filtered.map(cp => (
          <CheckpointCard
            key={cp.id}
            checkpoint={cp}
            onResolved={onResolved}
            silenced={hidden.has(cp.id)}
            onToggleSilence={() => setHidden(prev => {
              const next = new Set(prev)
              if (next.has(cp.id)) next.delete(cp.id); else next.add(cp.id)
              return next
            })}
          />
        ))}
      </div>
    </div>
  )
}

function CheckpointCard({ checkpoint: cp, onResolved, silenced, onToggleSilence }: { checkpoint: Checkpoint; onResolved: () => void; silenced?: boolean; onToggleSilence?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [chosen,  setChosen]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [diff,    setDiff]    = useState<DiffSummary | null>(null)

  const color = approvalKindColor(cp.kind)
  const icon  = approvalKindIcon(cp.kind)
  const age   = formatAge(cp.created_at)
  const agentId = DIFF_KINDS.has(cp.kind) ? extractAgentId(cp.detail) : null

  useEffect(() => {
    if (!agentId) return
    let cancelled = false
    api.agentDiff(agentId).then(d => { if (!cancelled) setDiff(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [agentId])

  async function resolve(choice: string) {
    setLoading(true)
    setError(null)
    setChosen(choice)
    try {
      await api.resolveCheckpoint(cp.id, choice)
      onResolved()
    } catch (e) {
      setError(String(e))
      setChosen(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#111827',
      border: `1px solid ${color}60`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 8,
      padding: '14px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{
            background: color + '25',
            color,
            border: `1px solid ${color}50`,
            borderRadius: 4,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>{cp.kind.replace(/_/g, ' ')}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <code style={{ fontSize: 10, color: '#374151' }}>{cp.id}</code>
          <span style={{ fontSize: 11, color: '#4b5563' }}>{age}</span>
          {onToggleSilence && (
            <button
              onClick={onToggleSilence}
              title={silenced ? 'Unhide this checkpoint' : 'Hide from view (client-side only; does not resolve)'}
              style={{
                background: 'transparent', border: '1px solid #374151',
                color: silenced ? '#fb923c' : '#6b7280',
                borderRadius: 4, padding: '1px 8px', fontSize: 10, cursor: 'pointer',
              }}
            >{silenced ? 'shown' : 'hide'}</button>
          )}
        </div>
      </div>

      {/* Detail */}
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#d1d5db', lineHeight: 1.5 }}>
        {cp.detail}
      </p>

      {diff && <DiffInline diff={diff} />}

      {/* Next steps */}
      {cp.next_steps && cp.next_steps.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
            Choose a next step:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cp.next_steps.map((step, i) => (
              <button
                key={i}
                disabled={loading}
                onClick={() => resolve(step)}
                style={{
                  background: chosen === step ? color : '#1f2937',
                  color: chosen === step ? '#fff' : '#9ca3af',
                  border: `1px solid ${chosen === step ? color : '#374151'}`,
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: 13,
                  textAlign: 'left',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading && chosen !== step ? 0.5 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ marginRight: 8, opacity: 0.6 }}>{i + 1}.</span>
                {step}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>Error: {error}</div>
      )}
    </div>
  )
}

function DiffInline({ diff }: { diff: DiffSummary }) {
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #374151',
      borderRadius: 6, padding: '8px 12px', marginBottom: 10,
    }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
        <span style={{
          background: DIFF_BADGE_COLOR[diff.kind] ?? '#6b7280',
          color: '#fff', borderRadius: 3,
          padding: '0 6px', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', marginRight: 8,
        }}>{diff.kind}</span>
        {diff.base_ref}..{diff.branch} &nbsp;·&nbsp;
        {diff.file_count} file{diff.file_count !== 1 ? 's' : ''}&nbsp;
        <span style={{ color: '#22c55e' }}>+{diff.insertions}</span>&nbsp;
        <span style={{ color: '#ef4444' }}>−{diff.deletions}</span>
      </div>
      {diff.reasons.map((r, i) => (
        <div key={i} style={{ fontSize: 11, color: '#fbbf24', marginBottom: 2 }}>⚠ {r}</div>
      ))}
      {diff.files.length > 0 && (
        <div style={{ marginTop: 4, maxHeight: 90, overflowY: 'auto' }}>
          {diff.files.slice(0, 15).map((f, i) => (
            <div key={i} style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{f}</div>
          ))}
          {diff.files.length > 15 && (
            <div style={{ fontSize: 10, color: '#6b7280' }}>…and {diff.files.length - 15} more</div>
          )}
        </div>
      )}
    </div>
  )
}

function formatAge(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}
