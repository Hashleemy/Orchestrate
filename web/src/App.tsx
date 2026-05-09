import { useEffect, useRef, useState } from 'react'
import { api, openStream } from './api/client'
import { Dashboard } from './pages/Dashboard'
import { ShortcutOverlay } from './components/Shortcuts'
import { ToastHost, toast } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { AgentMessage, AgentStatus, Approval, Checkpoint, OrchestratorEvent, ReviewRequest, ReviewVerdict, RunRecord, Task } from './types'

export function App() {
  const [agents,      setAgents]      = useState<AgentStatus[]>([])
  const [events,      setEvents]      = useState<OrchestratorEvent[]>([])
  const [approvals,   setApprovals]   = useState<Approval[]>([])
  const [tasks,       setTasks]       = useState<Task[]>([])
  const [messages,    setMessages]    = useState<AgentMessage[]>([])
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [runs,        setRuns]        = useState<RunRecord[]>([])
  const [verdicts,    setVerdicts]    = useState<ReviewVerdict[]>([])
  const [reviewReqs,  setReviewReqs]  = useState<ReviewRequest[]>([])
  const [repoPath,    setRepoPath]    = useState<string | undefined>(undefined)
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const [stopSummary, setStopSummary] = useState<{ path: string } | null>(null)

  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    Promise.all([
      api.agents(),
      api.events(),
      api.approvals(),
      api.tasks(),
      api.messages(),
      api.checkpoints(),
      api.status(),
      api.runs(),
      api.reviews(),
    ]).then(([a, e, ap, t, m, cp, status, r, rev]) => {
      setAgents(a ?? [])
      setEvents(e ?? [])
      setApprovals(ap ?? [])
      setTasks(t ?? [])
      setMessages(m ?? [])
      setCheckpoints(cp ?? [])
      setRepoPath(status.repo_path || undefined)
      setRuns(r ?? [])
      setVerdicts(rev.verdicts ?? [])
      setReviewReqs(rev.requests ?? [])
    }).catch(err => setError(String(err))).finally(() => setLoading(false))

    return openStream(payload => {
      setLastEventAt(Date.now())
      if (payload.type === 'agents')      setAgents(payload.data ?? [])
      if (payload.type === 'events')      setEvents(payload.data ?? [])
      if (payload.type === 'approvals')   setApprovals(payload.data ?? [])
      if (payload.type === 'tasks')       setTasks(payload.data ?? [])
      if (payload.type === 'messages')    setMessages(payload.data ?? [])
      if (payload.type === 'checkpoints') setCheckpoints(payload.data ?? [])
      if (payload.type === 'reviews') {
        setVerdicts(payload.data.verdicts ?? [])
        setReviewReqs(payload.data.requests ?? [])
      }
    })
  }, [])

  useEffect(() => {
    const pending = approvals.filter(a => a.status === 'pending').length
    document.title = pending > 0 ? `(${pending}) Local Agent Orchestrator` : 'Local Agent Orchestrator'
  }, [approvals])

  function handleRespawn() {
    api.agents().then(setAgents).catch(() => {})
  }

  function handleTaskCreated() {
    api.tasks().then(setTasks).catch(() => {})
  }

  async function handleChangeRepo(path: string) {
    const result = await api.openRepo(path)
    setRepoPath(result.path)
  }

  async function handleStartReview(workerId: string, taskId: string) {
    await api.startReview(workerId, taskId)
    api.reviews().then(r => { setVerdicts(r.verdicts ?? []); setReviewReqs(r.requests ?? []) }).catch(() => {})
  }

  async function handleStartRun(description: string, workerCount: number, repoUrl: string, repoPath: string) {
    const result = await api.startRun(description, workerCount, repoUrl, repoPath)
    if (result.repo_path) setRepoPath(result.repo_path)
    api.tasks().then(setTasks).catch(() => {})
    api.agents().then(setAgents).catch(() => {})
  }

  async function handleStopRun() {
    const result = await api.stopRun()
    api.agents().then(setAgents).catch(() => {})
    api.runs().then(setRuns).catch(() => {})
    if (result.session_summary_path) {
      setStopSummary({ path: result.session_summary_path })
    } else {
      toast('success', 'Run stopped.')
    }
  }

  function refreshAll() {
    Promise.all([api.approvals(), api.checkpoints(), api.tasks()])
      .then(([ap, cp, t]) => { setApprovals(ap); setCheckpoints(cp); setTasks(t) })
      .catch(() => {})
  }

  if (loading && !error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f172a', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid #1e3a5f', borderTopColor: '#3b82f6',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ color: '#475569', fontSize: 13 }}>Connecting to server…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: 40, fontFamily: 'monospace',
        display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start',
      }}>
        <div style={{ color: '#ef4444', fontSize: 14 }}>Failed to connect: {error}</div>
        <div style={{ color: '#6b7280', fontSize: 12 }}>Is the Go server running on port 8080?</div>
        <button
          onClick={() => { setError(null); loaded.current = false; window.location.reload() }}
          style={{
            background: '#1d4ed8', color: '#fff', border: 'none',
            borderRadius: 6, padding: '7px 16px', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
          }}
        >Retry</button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ToastHost />
      <ShortcutOverlay />
      {stopSummary && (
        <StopConfirmation path={stopSummary.path} onDismiss={() => setStopSummary(null)} />
      )}
      <Dashboard
        agents={agents}
        events={events}
        approvals={approvals}
        tasks={tasks}
        messages={messages}
        checkpoints={checkpoints}
        runs={runs}
        verdicts={verdicts}
        reviewRequests={reviewReqs}
        repoPath={repoPath}
        lastEventAt={lastEventAt}
        onChangeRepo={handleChangeRepo}
        onRespawn={handleRespawn}
        onTaskCreated={handleTaskCreated}
        onStartReview={handleStartReview}
        onApprovalResolved={refreshAll}
        onCheckpointResolved={refreshAll}
        onStartRun={handleStartRun}
        onStopRun={handleStopRun}
      />
    </ErrorBoundary>
  )
}

function StopConfirmation({ path, onDismiss }: { path: string; onDismiss: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        background: '#1f2937', border: '1px solid #374151',
        borderRadius: 12, padding: 32, maxWidth: 520, width: '90vw',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h2 style={{ margin: '0 0 8px', color: '#f9fafb', fontSize: 18, fontWeight: 700 }}>
          Run Stopped
        </h2>
        <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
          A session summary has been saved with all tasks completed, in-progress work, and resumption instructions.
        </p>
        <div style={{
          background: '#111827', border: '1px solid #374151',
          borderRadius: 6, padding: '10px 16px',
          fontFamily: 'monospace', fontSize: 12, color: '#93c5fd',
          wordBreak: 'break-all', marginBottom: 20, textAlign: 'left',
        }}>
          {path}
        </div>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 24px' }}>
          You can safely shut down the server. To resume, start a new run and paste this session summary as the project description.
        </p>
        <button
          onClick={onDismiss}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            borderRadius: 6, padding: '10px 32px', cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
          }}
        >
          OK, got it
        </button>
      </div>
    </div>
  )
}
