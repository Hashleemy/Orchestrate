import { useEffect, useRef, useState } from 'react'
import { api, openStream } from './api/client'
import { Dashboard } from './pages/Dashboard'
import { ShortcutOverlay } from './components/Shortcuts'
import { ToastHost } from './components/Toast'
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
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)

  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    // Initial fetch
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
    }).catch(err => setError(String(err)))

    // Live SSE stream
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

  async function handleStartRun(tasksContent: string, workerCount: number) {
    await api.startRun(tasksContent, workerCount)
    api.tasks().then(setTasks).catch(() => {})
    api.agents().then(setAgents).catch(() => {})
  }

  async function handleStopRun() {
    await api.stopRun()
    api.agents().then(setAgents).catch(() => {})
    api.runs().then(setRuns).catch(() => {})
  }

  function refreshAll() {
    Promise.all([api.approvals(), api.checkpoints(), api.tasks()])
      .then(([ap, cp, t]) => { setApprovals(ap); setCheckpoints(cp); setTasks(t) })
      .catch(() => {})
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: '#ef4444', fontFamily: 'monospace' }}>
        Failed to connect: {error}
        <br />
        <small style={{ color: '#6b7280' }}>Is the Go server running on port 8080?</small>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <ToastHost />
    <ShortcutOverlay />
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
