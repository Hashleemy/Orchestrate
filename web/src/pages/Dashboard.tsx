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
import { Glyph }            from '../components/Glyph'
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
  lastEventAt?:          number | null
  onChangeRepo?:         (path: string) => Promise<void>
  onApprovalResolved:    () => void
  onCheckpointResolved:  () => void
  onStartRun:            (tasks: string, workerCount: number) => Promise<void>
  onStopRun:             () => Promise<void>
  onStartReview:         (workerId: string, taskId: string) => Promise<void>
  onRespawn:             () => void
  onTaskCreated:         () => void
}

export function Dashboard({ agents, events, approvals, tasks, messages, checkpoints, runs, verdicts, reviewRequests, repoPath, lastEventAt, onChangeRepo, onApprovalResolved, onCheckpointResolved, onStartRun, onStopRun, onStartReview, onRespawn, onTaskCreated }: Props) {
  const [showModal,   setShowModal]   = useState(false)
  const [agentQuery,  setAgentQuery]  = useState('')
  const [stateFilter, setStateFilter] = useState<string | null>(null)
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

      {/* Top bar — sticky */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '10px 12px',
        marginLeft: -12,
        marginRight: -12,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid #1f2937',
      }}>
        <h1 style={{ margin: 0, color: '#f9fafb', fontSize: 18, fontWeight: 700 }}>
          Local Agent Orchestrator
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <LiveIndicator lastEventAt={lastEventAt} now={now} />
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
            ? <Empty glyph="agents" text="No agents running. Click + Start Run to spawn a coordinator and workers." />
            : (() => {
                const q = agentQuery.trim().toLowerCase()
                const filtered = agents.filter(a => {
                  if (stateFilter && a.state !== stateFilter) return false
                  if (q && !a.agent.toLowerCase().includes(q) && !a.branch.toLowerCase().includes(q)) return false
                  return true
                })
                const stateCounts: Record<string, number> = {}
                for (const a of agents) stateCounts[a.state] = (stateCounts[a.state] ?? 0) + 1
                const active = agentQuery || stateFilter
                return (
                  <>
                    <AgentFilterBar
                      query={agentQuery}
                      onQueryChange={setAgentQuery}
                      stateFilter={stateFilter}
                      onStateFilterChange={setStateFilter}
                      stateCounts={stateCounts}
                      onClear={() => { setAgentQuery(''); setStateFilter(null) }}
                      active={!!active}
                      matchCount={filtered.length}
                      total={agents.length}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {filtered.length === 0
                        ? <div style={{ color: '#6b7280', fontSize: 12, padding: 8 }}>No agents match the current filter.</div>
                        : filtered.map(a => <AgentCard key={a.agent} agent={a} onRespawn={onRespawn} recentAction={recentAction.get(a.agent)} />)
                      }
                    </div>
                  </>
                )
              })()
          }
        </Section>

        <Section title={`Approvals${pending.length > 0 ? ` — ${pending.length} pending` : ''}`}>
          <ApprovalQueue approvals={approvals} onResolved={onApprovalResolved} />
        </Section>
      </div>

      {/* Row 2: Tasks (full width) */}
      <Section title={`Tasks (${tasks.length})`} style={{ marginBottom: 20 }}>
        {tasks.length === 0
          ? <Empty glyph="tasks" text="No tasks loaded. Add examples/tasks.md to the target repo, or press N to add one from the UI." />
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

function LiveIndicator({ lastEventAt, now }: { lastEventAt: number | null | undefined; now: number }) {
  const ageSec = lastEventAt ? Math.floor((now - lastEventAt) / 1000) : null
  const live = ageSec !== null && ageSec < 10
  const color = live ? '#16a34a' : ageSec === null ? '#6b7280' : '#ef4444'
  const label = live ? 'LIVE' : ageSec === null ? 'IDLE' : 'STALE'
  const tooltip = ageSec === null ? 'Waiting for first SSE event' : `${ageSec}s since last event`
  return (
    <div title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9ca3af', cursor: 'help' }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: color,
        boxShadow: live ? `0 0 6px ${color}` : undefined,
      }} />
      <span style={{ fontWeight: 700, letterSpacing: '0.05em' }}>{label}</span>
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

function Empty({ text, icon, glyph }: { text: string; icon?: string; glyph?: 'agents' | 'tasks' | 'runs' | 'comms' | 'approvals' | 'reviews' }) {
  return (
    <div style={{ color: '#6b7280', fontSize: 13, padding: '14px 6px', lineHeight: 1.6 }}>
      {glyph && <div style={{ marginBottom: 8 }}><Glyph name={glyph} size={24} /></div>}
      {icon && !glyph && <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>}
      {text}
    </div>
  )
}

const STATE_CHIP_COLORS: Record<string, string> = {
  idle: '#6b7280', planning: '#3b82f6', coding: '#22c55e', testing: '#06b6d4',
  blocked: '#f97316', awaiting_approval: '#eab308', complete: '#15803d', stopped: '#7f1d1d',
}

function AgentFilterBar({
  query, onQueryChange, stateFilter, onStateFilterChange, stateCounts, onClear, active, matchCount, total,
}: {
  query: string
  onQueryChange: (s: string) => void
  stateFilter: string | null
  onStateFilterChange: (s: string | null) => void
  stateCounts: Record<string, number>
  onClear: () => void
  active: boolean
  matchCount: number
  total: number
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
      <input
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder="Filter by id or branch…"
        style={{
          background: '#0f172a', border: '1px solid #334155',
          color: '#e2e8f0', borderRadius: 4,
          padding: '4px 10px', fontSize: 12, fontFamily: 'monospace',
          width: 200, outline: 'none',
        }}
      />
      {Object.entries(stateCounts).map(([state, count]) => (
        <button
          key={state}
          onClick={() => onStateFilterChange(stateFilter === state ? null : state)}
          style={{
            background: stateFilter === state ? STATE_CHIP_COLORS[state] ?? '#374151' : 'transparent',
            color: stateFilter === state ? '#fff' : STATE_CHIP_COLORS[state] ?? '#9ca3af',
            border: `1px solid ${STATE_CHIP_COLORS[state] ?? '#374151'}`,
            borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.03em', cursor: 'pointer',
          }}
        >{state} {count}</button>
      ))}
      {active && (
        <>
          <span style={{ color: '#6b7280', fontSize: 11 }}>{matchCount}/{total}</span>
          <button
            onClick={onClear}
            style={{
              background: 'none', border: '1px solid #374151',
              color: '#9ca3af', borderRadius: 4,
              padding: '2px 8px', fontSize: 11, cursor: 'pointer',
            }}
          >Clear</button>
        </>
      )}
    </div>
  )
}
