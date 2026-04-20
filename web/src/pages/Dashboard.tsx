import { useEffect, useState } from 'react'
import type React from 'react'
import { AgentCard }        from '../components/AgentCard'
import { AgentGraph }       from '../components/AgentGraph'
import { ApprovalQueue }    from '../components/ApprovalQueue'
import { CheckpointPanel }  from '../components/CheckpointPanel'
import { CommFeed }         from '../components/CommFeed'
import { RepoHeader }       from '../components/RepoHeader'
import { ReviewPanel }      from '../components/ReviewPanel'
import { RunHistory }       from '../components/RunHistory'
import { StartRunModal }    from '../components/StartRunModal'
import { TaskBoard }        from '../components/TaskBoard'
import type { AgentMessage, AgentStatus, Approval, Checkpoint, OrchestratorEvent, ReviewRequest, ReviewVerdict, RunRecord, Task } from '../types'

interface Props {
  agents:                AgentStatus[]
  events:                OrchestratorEvent[]
  approvals:             Approval[]
  tasks:                 Task[]
  messages:              AgentMessage[]
  checkpoints:           Checkpoint[]
  runs:                  RunRecord[]
  verdicts:              ReviewVerdict[]
  reviewRequests:        ReviewRequest[]
  repoPath?:             string
  onChangeRepo?:         (path: string) => Promise<void>
  onApprovalResolved:    () => void
  onCheckpointResolved:  () => void
  onStartRun:            (tasks: string, workerCount: number) => Promise<void>
  onStopRun:             () => Promise<void>
  onStartReview:         (workerId: string, taskId: string) => Promise<void>
  onRespawn:             () => void
  onTaskCreated:         () => void
}

export function Dashboard({ agents, events, approvals, tasks, messages, checkpoints, runs, verdicts, reviewRequests, repoPath, onChangeRepo, onApprovalResolved, onCheckpointResolved, onStartRun, onStopRun, onStartReview, onRespawn, onTaskCreated }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])

  const pending = approvals.filter(a => a.status === 'pending')
  const pendingCheckpoints = checkpoints.filter(c => c.status === 'pending')

  const ACTIVE_EVENT_TYPES = new Set(['file_edit', 'test_run', 'commit', 'task_started', 'approval_requested', 'approval_received', 'message_sent', 'message_received'])
  const recentAction = new Map<string, boolean>()
  for (const e of events) {
    if (!ACTIVE_EVENT_TYPES.has(e.type)) continue
    const age = now - new Date(e.timestamp).getTime()
    if (age < 3000) recentAction.set(e.agent, true)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      {showModal && <StartRunModal onStart={onStartRun} onClose={() => setShowModal(false)} />}

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: '#f9fafb', fontSize: 18, fontWeight: 700 }}>
          Local Agent Orchestrator
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Pill label="Agents"      count={agents.length}            color="#3b82f6" />
          <Pill label="Pending"     count={pending.length}           color={pending.length > 0 ? '#eab308' : '#374151'} />
          <Pill label="Checkpoints" count={pendingCheckpoints.length} color={pendingCheckpoints.length > 0 ? '#ef4444' : '#374151'} />
          <Pill label="Tasks"       count={tasks.length}             color="#374151" />
          {agents.length > 0 && (
            <button
              onClick={onStopRun}
              style={{
                background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b',
                borderRadius: 6, padding: '7px 14px', cursor: 'pointer',
                fontWeight: 600, fontSize: 13,
              }}
            >Stop Run</button>
          )}
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: 6, padding: '7px 18px', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
            }}
          >+ Start Run</button>
        </div>
      </div>

      {/* Repo header */}
      <RepoHeader agents={agents} tasks={tasks} repoPath={repoPath} onChangeRepo={onChangeRepo} />

      {/* Checkpoint gate — shown above everything when paused */}
      <CheckpointPanel checkpoints={checkpoints} onResolved={onCheckpointResolved} />

      {/* Row 1: Agents + Approvals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Section title={`Agents (${agents.length})`}>
          {agents.length === 0
            ? <Empty text="No agents running. Click + Start Run to begin." />
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {agents.map(a => <AgentCard key={a.agent} agent={a} onRespawn={onRespawn} recentAction={recentAction.get(a.agent)} />)}
              </div>
          }
        </Section>

        <Section title={`Approvals${pending.length > 0 ? ` — ${pending.length} pending` : ''}`}>
          <ApprovalQueue approvals={approvals} onResolved={onApprovalResolved} />
        </Section>
      </div>

      {/* Row 2: Tasks (full width) */}
      <Section title={`Tasks (${tasks.length})`} style={{ marginBottom: 20 }}>
        {tasks.length === 0
          ? <Empty text="No tasks.md loaded yet. Start a run to load tasks." />
          : <TaskBoard tasks={tasks} onTaskCreated={onTaskCreated} />
        }
      </Section>

      {/* Row 3: Comms feed (full width) */}
      <Section title={`Communications (${events.length + messages.length})`} style={{ marginBottom: 20 }}>
        <CommFeed events={events} messages={messages} />
      </Section>

      {/* Row 4: Reviews */}
      <div style={{ marginBottom: 20 }}>
        <ReviewPanel verdicts={verdicts} requests={reviewRequests} onStartReview={onStartReview} />
      </div>

      {/* Row 5: Orchestration graph (live) */}
      <Section title={`Orchestration Graph (${agents.length})`} style={{ marginBottom: 20 }}>
        <AgentGraph agents={agents} events={events} messages={messages} reviewRequests={reviewRequests} />
      </Section>

      {/* Row 6: Run history */}
      <RunHistory runs={runs} />
    </div>
  )
}

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 10, padding: 16, ...style }}>
      <h2 style={{ margin: '0 0 12px', color: '#9ca3af', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
      {children}
    </div>
  )
}

function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#9ca3af' }}>
      <span style={{ background: color, color: '#fff', borderRadius: 12, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>{count}</span>
      {label}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: '#4b5563', fontSize: 13, padding: 4 }}>{text}</div>
}
