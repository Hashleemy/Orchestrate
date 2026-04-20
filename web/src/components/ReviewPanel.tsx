import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { Glyph } from './Glyph'
import { toast } from './Toast'
import type { AgentMergeResult, ReviewRequest, ReviewVerdict } from '../types'

interface Props {
  verdicts:      ReviewVerdict[]
  requests:      ReviewRequest[]
  onStartReview: (workerId: string, taskId: string) => Promise<void>
}

function VerdictBadge({ verdict }: { verdict: ReviewVerdict['verdict'] }) {
  const approved = verdict === 'approve'
  return (
    <span style={{
      background: approved ? '#16a34a' : '#dc2626',
      color: '#fff', fontSize: 11, fontWeight: 700,
      borderRadius: 4, padding: '2px 8px', textTransform: 'uppercase',
    }}>{approved ? 'Approved' : 'Revise'}</span>
  )
}

function RiskBadge({ risk }: { risk: ReviewVerdict['risk'] }) {
  const colors = { low: '#16a34a', medium: '#d97706', high: '#dc2626' }
  return (
    <span style={{
      background: colors[risk] ?? '#374151',
      color: '#fff', fontSize: 11, fontWeight: 700,
      borderRadius: 4, padding: '2px 8px',
    }}>{risk}</span>
  )
}

function MergeBadge({ rec }: { rec: ReviewVerdict['merge_recommendation'] }) {
  const colors = { 'ready': '#16a34a', 'needs-changes': '#d97706', 'escalate-to-user': '#7c3aed' }
  const labels = { 'ready': 'Ready to merge', 'needs-changes': 'Needs changes', 'escalate-to-user': 'Escalate to user' }
  return (
    <span style={{
      background: colors[rec] ?? '#374151',
      color: '#fff', fontSize: 11, fontWeight: 600,
      borderRadius: 4, padding: '2px 8px',
    }}>{labels[rec] ?? rec}</span>
  )
}

function MergeResultBanner({ result }: { result: AgentMergeResult }) {
  const ok = result.status === 'merged'
  return (
    <div style={{
      margin: '8px 0 0',
      padding: '6px 10px',
      borderRadius: 5,
      background: ok ? '#052e16' : '#450a0a',
      border: `1px solid ${ok ? '#16a34a' : '#b91c1c'}`,
      fontSize: 12,
      color: ok ? '#4ade80' : '#f87171',
    }}>
      {ok ? `Merged into ${result.into_branch}` : result.status === 'conflicts' ? 'Conflicts — resolve manually' : 'Merge failed'}
      {result.output && <pre style={{ margin: '4px 0 0', fontSize: 10, color: '#9ca3af', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{result.output.slice(0, 400)}</pre>}
    </div>
  )
}

function VerdictCard({ v, selected, onSelect, cardRef, mergeRef, expanded, onToggleExpand }: {
  v: ReviewVerdict
  selected?: boolean
  onSelect?: () => void
  cardRef?: (el: HTMLDivElement | null) => void
  mergeRef?: (fn: (() => void) | null) => void
  expanded: boolean
  onToggleExpand: () => void
}) {
  const [merging,     setMerging]     = useState(false)
  const [mergeResult, setMergeResult] = useState<AgentMergeResult | null>(null)
  const date = (() => {
    try { return new Date(v.reviewed_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return v.reviewed_at }
  })()

  const canMerge = v.verdict === 'approve' && v.merge_recommendation === 'ready'

  async function handleMerge() {
    setMerging(true)
    setMergeResult(null)
    try {
      const result = await api.mergeBranch(v.worker_id)
      setMergeResult(result)
      if (result.status === 'merged') {
        toast('success', `Merged ${result.branch}`, `into ${result.into_branch}`)
      } else if (result.status === 'conflicts') {
        toast('warning', 'Merge conflicts', 'Resolve manually in the worktree')
      } else {
        toast('error', 'Merge failed', result.output)
      }
    } catch (e) {
      setMergeResult({ agent_id: v.worker_id, branch: v.branch, into_branch: 'main', status: 'error', conflicts: false })
      toast('error', 'Merge error', String(e))
    } finally {
      setMerging(false)
    }
  }

  useEffect(() => {
    if (!mergeRef) return
    mergeRef(canMerge && mergeResult?.status !== 'merged' ? handleMerge : null)
    return () => mergeRef(null)
  }, [canMerge, mergeResult, merging, mergeRef])

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      style={{
        border: `1px solid ${selected ? '#38bdf8' : '#374151'}`,
        boxShadow: selected ? 'inset 0 0 0 1px #0284c7' : undefined,
        borderRadius: 8, overflow: 'hidden', marginBottom: 8,
      }}
    >
      <button
        onClick={onToggleExpand}
        style={{
          width: '100%', background: '#111827', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', textAlign: 'left',
        }}
      >
        <VerdictBadge verdict={v.verdict} />
        <span style={{ color: '#d1d5db', fontSize: 13, fontWeight: 600, flex: 1 }}>
          {v.task_id} — {v.worker_id}
        </span>
        <RiskBadge risk={v.risk} />
        <MergeBadge rec={v.merge_recommendation} />
        <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 4 }}>{date}</span>
        <span style={{ color: '#6b7280', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ background: '#0f172a', padding: '10px 14px' }}>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 2 }}>Branch: <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{v.branch}</span></div>
          {v.issues?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>Issues:</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {v.issues.map((issue, i) => (
                  <li key={i} style={{ color: '#d1d5db', fontSize: 12, marginBottom: 2 }}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {(!v.issues || v.issues.length === 0) && (
            <div style={{ color: '#4b5563', fontSize: 12, marginTop: 6 }}>No issues reported.</div>
          )}
          {canMerge && mergeResult?.status !== 'merged' && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={handleMerge}
                disabled={merging}
                style={{
                  background: '#16a34a', border: 'none',
                  color: '#fff', borderRadius: 5,
                  padding: '5px 14px', fontSize: 12,
                  fontWeight: 600, cursor: merging ? 'default' : 'pointer',
                  opacity: merging ? 0.6 : 1,
                }}
              >{merging ? 'Merging…' : '⤵ Merge into main'}</button>
            </div>
          )}
          {mergeResult && <MergeResultBanner result={mergeResult} />}
        </div>
      )}
    </div>
  )
}

function RequestRow({ req }: { req: ReviewRequest }) {
  const date = (() => {
    try { return new Date(req.requested_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return req.requested_at }
  })()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
      borderBottom: '1px solid #1f2937', fontSize: 13,
    }}>
      <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px' }}>Pending</span>
      <span style={{ color: '#9ca3af', flex: 1 }}>{req.reviewer_id}</span>
      <span style={{ color: '#6b7280', fontSize: 12 }}>{req.task_id}</span>
      <span style={{ color: '#6b7280', fontSize: 12 }}>{date}</span>
    </div>
  )
}

interface VerdictGroup { worker_id: string; verdicts: ReviewVerdict[] }

function groupVerdictsByWorker(verdicts: ReviewVerdict[]): VerdictGroup[] {
  const byWorker = new Map<string, ReviewVerdict[]>()
  for (const v of verdicts) {
    const list = byWorker.get(v.worker_id) ?? []
    list.push(v)
    byWorker.set(v.worker_id, list)
  }
  const groups: VerdictGroup[] = []
  for (const [worker_id, list] of byWorker) {
    list.sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())
    groups.push({ worker_id, verdicts: list })
  }
  groups.sort((a, b) =>
    new Date(b.verdicts[0].reviewed_at).getTime() - new Date(a.verdicts[0].reviewed_at).getTime()
  )
  return groups
}

function WorkerVerdictGroup({ group, selected, onSelect, cardRef, mergeRef, expanded, onToggleExpand }: {
  group: VerdictGroup
  selected?: boolean
  onSelect?: () => void
  cardRef?: (el: HTMLDivElement | null) => void
  mergeRef?: (fn: (() => void) | null) => void
  expanded: boolean
  onToggleExpand: () => void
}) {
  const [showHistory, setShowHistory] = useState(false)
  const [latest, ...earlier] = group.verdicts
  return (
    <div style={{ marginBottom: 8 }}>
      <VerdictCard v={latest} selected={selected} onSelect={onSelect} cardRef={cardRef} mergeRef={mergeRef} expanded={expanded} onToggleExpand={onToggleExpand} />
      {earlier.length > 0 && (
        <div style={{ marginTop: -4, marginLeft: 6, marginBottom: 4 }}>
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#60a5fa', fontSize: 11, fontWeight: 600,
              padding: '4px 6px', letterSpacing: '0.02em',
            }}
          >
            {showHistory ? '▾' : '▸'} {earlier.length} earlier verdict{earlier.length === 1 ? '' : 's'} for {group.worker_id}
          </button>
          {showHistory && (
            <div style={{ marginTop: 4, marginLeft: 10, paddingLeft: 10, borderLeft: '2px solid #1f2937' }}>
              {earlier.map(v => (
                <EarlierVerdictCard key={`${v.reviewer_id}-${v.task_id}-${v.reviewed_at}`} v={v} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EarlierVerdictCard({ v }: { v: ReviewVerdict }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ marginBottom: 6 }}>
      <VerdictCard v={v} expanded={expanded} onToggleExpand={() => setExpanded(e => !e)} />
    </div>
  )
}

const REVIEWPANEL_COLLAPSED_KEY = 'orchestrate.reviewpanel.collapsed'

function loadCollapsed(): boolean {
  try { return localStorage.getItem(REVIEWPANEL_COLLAPSED_KEY) === '1' } catch { return false }
}

export function ReviewPanel({ verdicts, requests, onStartReview }: Props) {
  const [workerID, setWorkerID] = useState('')
  const [taskID, setTaskID] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [cursor, setCursor] = useState<number>(-1)
  const [hovered, setHovered] = useState(false)
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<boolean>(() => loadCollapsed())
  const [workerFilter, setWorkerFilter] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(REVIEWPANEL_COLLAPSED_KEY, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])
  const mergeFns = useRef<Array<(() => void) | null>>([])

  const allGroups = groupVerdictsByWorker(verdicts)
  const groups = workerFilter ? allGroups.filter(g => g.worker_id === workerFilter) : allGroups
  const groupCount = groups.length

  useEffect(() => {
    if (cursor >= groupCount) setCursor(groupCount > 0 ? groupCount - 1 : -1)
  }, [groupCount, cursor])

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
      if (groupCount === 0) return
      if (e.key === 'j') {
        e.preventDefault()
        setCursor(c => Math.min(groupCount - 1, c < 0 ? 0 : c + 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setCursor(c => Math.max(0, c < 0 ? 0 : c - 1))
      } else if (e.key === 'Enter' && cursor >= 0) {
        e.preventDefault()
        const key = groups[cursor].worker_id
        setExpandedSet(prev => {
          const next = new Set(prev)
          if (next.has(key)) next.delete(key)
          else next.add(key)
          return next
        })
      } else if (e.key === 'A' && e.shiftKey && cursor >= 0) {
        e.preventDefault()
        const fn = mergeFns.current[cursor]
        if (fn) fn()
        else toast('info', 'Nothing to accept', 'This verdict is not in a mergeable state.')
      } else if (e.key === 'R' && e.shiftKey && cursor >= 0) {
        e.preventDefault()
        const g = groups[cursor]
        const latest = g.verdicts[0]
        setWorkerID(g.worker_id)
        setTaskID(latest.task_id)
        toast('info', 'Re-review prefilled', `${g.worker_id} · ${latest.task_id}`)
      } else if (e.key === 'Escape' && cursor >= 0) {
        e.preventDefault()
        setCursor(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hovered, groupCount, cursor, groups])

  useEffect(() => {
    if (cursor < 0) return
    const el = cardRefs.current[cursor]
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursor])

  async function handleRequest() {
    if (!workerID.trim() || !taskID.trim()) { setErr('Worker ID and Task ID are required.'); return }
    setLoading(true)
    setErr(null)
    try {
      await onStartReview(workerID.trim(), taskID.trim())
      setWorkerID('')
      setTaskID('')
    } catch (e) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setCursor(-1) }}
      style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}
    >
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: '10px 16px', borderBottom: collapsed ? 'none' : '1px solid #374151',
          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ display: 'inline-block', width: 10, color: '#9ca3af', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 120ms ease' }}>▾</span>
        <span style={{ color: '#f9fafb', fontWeight: 700, fontSize: 14 }}>Code Reviews</span>
        {verdicts.length > 0 && (
          <span style={{ background: '#374151', color: '#9ca3af', borderRadius: 10, padding: '1px 8px', fontSize: 12 }}>
            {verdicts.length}
          </span>
        )}
        {pendingRequests.length > 0 && (
          <span style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 10, padding: '1px 8px', fontSize: 12 }}>
            {pendingRequests.length} pending
          </span>
        )}
      </div>
      {collapsed ? null : (<>

      {/* Request review form */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #374151', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>Worker ID</div>
          <input
            value={workerID}
            onChange={e => setWorkerID(e.target.value)}
            placeholder="agent-worker-01"
            style={{
              background: '#111827', border: '1px solid #374151', borderRadius: 5,
              color: '#d1d5db', fontSize: 12, padding: '5px 10px', fontFamily: 'monospace', width: 160,
            }}
          />
        </div>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>Task ID</div>
          <input
            value={taskID}
            onChange={e => setTaskID(e.target.value)}
            placeholder="TASK-001"
            style={{
              background: '#111827', border: '1px solid #374151', borderRadius: 5,
              color: '#d1d5db', fontSize: 12, padding: '5px 10px', fontFamily: 'monospace', width: 120,
            }}
          />
        </div>
        <button
          onClick={handleRequest}
          disabled={loading}
          style={{
            background: '#7c3aed', color: '#fff', border: 'none',
            borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
            fontWeight: 600, fontSize: 12, opacity: loading ? 0.6 : 1,
          }}
        >{loading ? 'Starting…' : 'Request Review'}</button>
        {err && <span style={{ color: '#ef4444', fontSize: 12 }}>{err}</span>}
      </div>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div>
          {pendingRequests.map(r => <RequestRow key={r.reviewer_id} req={r} />)}
        </div>
      )}

      {/* Worker filter chips */}
      {allGroups.length > 1 && (
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid #1f2937',
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        }}>
          <span style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Filter:
          </span>
          {allGroups.map(g => {
            const active = workerFilter === g.worker_id
            return (
              <button
                key={g.worker_id}
                onClick={() => setWorkerFilter(active ? null : g.worker_id)}
                style={{
                  background: active ? '#0c4a6e' : '#0f172a',
                  color: active ? '#e0f2fe' : '#94a3b8',
                  border: `1px solid ${active ? '#38bdf8' : '#334155'}`,
                  borderRadius: 12, padding: '2px 9px',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
                title={active ? 'Click to clear filter' : `Filter to ${g.worker_id}`}
              >{g.worker_id} · {g.verdicts.length}</button>
            )
          })}
          {workerFilter && (
            <button
              onClick={() => setWorkerFilter(null)}
              style={{
                background: 'none', border: 'none', color: '#6b7280',
                fontSize: 11, cursor: 'pointer', padding: '2px 4px',
              }}
            >clear ×</button>
          )}
        </div>
      )}

      {/* Verdicts */}
      {verdicts.length > 0 ? (
        <div style={{ padding: 12 }}>
          {groups.map((group, i) => (
            <WorkerVerdictGroup
              key={group.worker_id}
              group={group}
              selected={cursor === i}
              onSelect={() => setCursor(i)}
              cardRef={(el) => { cardRefs.current[i] = el }}
              mergeRef={(fn) => { mergeFns.current[i] = fn }}
              expanded={expandedSet.has(group.worker_id)}
              onToggleExpand={() => setExpandedSet(prev => {
                const next = new Set(prev)
                if (next.has(group.worker_id)) next.delete(group.worker_id)
                else next.add(group.worker_id)
                return next
              })}
            />
          ))}
          {hovered && groupCount > 0 && (
            <div style={{ color: '#475569', fontSize: 10, textAlign: 'right', marginTop: 4, fontStyle: 'italic' }}>
              j/k · Enter · Shift+A merge · Shift+R re-review
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: 20, color: '#6b7280', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Glyph name="reviews" size={22} /></div>
          No reviews yet. Request a review by spawning a reviewer for a worker
          whose branch you want evaluated — verdicts will appear here.
        </div>
      )}
      </>)}
    </div>
  )
}
