import { useState } from 'react'
import { api } from '../api/client'
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

function VerdictCard({ v }: { v: ReviewVerdict }) {
  const [expanded,    setExpanded]    = useState(false)
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
    } catch {
      setMergeResult({ agent_id: v.worker_id, branch: v.branch, into_branch: 'main', status: 'error', conflicts: false })
    } finally {
      setMerging(false)
    }
  }

  return (
    <div style={{ border: '1px solid #374151', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      <button
        onClick={() => setExpanded(e => !e)}
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

export function ReviewPanel({ verdicts, requests, onStartReview }: Props) {
  const [workerID, setWorkerID] = useState('')
  const [taskID, setTaskID] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

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
    <div style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {/* Verdicts */}
      {verdicts.length > 0 ? (
        <div style={{ padding: 12 }}>
          {verdicts.map(v => <VerdictCard key={`${v.reviewer_id}-${v.task_id}-${v.reviewed_at}`} v={v} />)}
        </div>
      ) : (
        <div style={{ padding: 16, color: '#4b5563', fontSize: 13, textAlign: 'center' }}>
          No review verdicts yet.
        </div>
      )}
    </div>
  )
}
