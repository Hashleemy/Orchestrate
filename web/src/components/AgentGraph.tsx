import { useEffect, useState } from 'react'
import { staleSec } from '../settings'
import type { AgentMessage, AgentStatus, OrchestratorEvent, ReviewRequest } from '../types'

const ROLE_COLORS: Record<string, string> = {
  coordinator: '#a855f7',
  reviewer:    '#eab308',
  backend:     '#3b82f6',
  frontend:    '#22c55e',
  worker:      '#3b82f6',
  default:     '#6b7280',
}

const STATE_COLORS: Record<string, string> = {
  idle:              '#6b7280',
  planning:          '#3b82f6',
  coding:            '#22c55e',
  testing:           '#06b6d4',
  blocked:           '#f97316',
  awaiting_approval: '#eab308',
  complete:          '#15803d',
  stopped:           '#7f1d1d',
}

const ACTION_EVENTS = new Set([
  'file_edit', 'test_run', 'commit', 'task_started',
  'approval_requested', 'approval_received', 'message_sent', 'message_received',
])

const ACTIVE_WINDOW_MS = 3000

function isStale(a: AgentStatus, now: number): boolean {
  if (a.stale) return true
  if (a.state === 'complete' || a.state === 'stopped') return false
  const ts = new Date(a.timestamp).getTime()
  if (!ts) return false
  return (now - ts) > staleSec() * 1000
}

function roleOf(agentId: string): string {
  const parts = agentId.split('-')
  if (parts.length >= 3) return parts[1]
  return 'default'
}

interface Props {
  agents:         AgentStatus[]
  events:         OrchestratorEvent[]
  messages?:      AgentMessage[]
  reviewRequests?: ReviewRequest[]
  onSelectAgent?: (agentId: string) => void
  selectedAgent?: string | null
  onSelectTask?: (taskId: string) => void
  selectedTask?: string | null
}

export function AgentGraph({ agents, events, messages = [], reviewRequests = [], onSelectAgent, selectedAgent, onSelectTask, selectedTask }: Props) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  if (agents.length === 0) {
    return (
      <div style={{
        height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#4b5563', fontSize: 13, fontStyle: 'italic',
      }}>
        No agents yet — start a run to populate the graph.
      </div>
    )
  }

  const lastActionAt = new Map<string, number>()
  for (const e of events) {
    if (!ACTION_EVENTS.has(e.type)) continue
    const t = new Date(e.timestamp).getTime()
    const prev = lastActionAt.get(e.agent) ?? 0
    if (t > prev) lastActionAt.set(e.agent, t)
  }

  const coord = agents.find(a => roleOf(a.agent) === 'coordinator')
  const workers = agents.filter(a => roleOf(a.agent) !== 'coordinator')

  const W = 960, H = 360
  const coordX = W / 2, coordY = 80
  const workerY = 260
  const margin = 90
  const workerXs = workers.map((_, i) => {
    if (workers.length === 1) return W / 2
    return margin + (i * (W - 2 * margin)) / (workers.length - 1)
  })

  const isActive = (agentId: string) => {
    const last = lastActionAt.get(agentId)
    return last !== undefined && (now - last) < ACTIVE_WINDOW_MS
  }

  // Position map for all agents (coordinator + workers)
  const positions = new Map<string, { x: number; y: number }>()
  if (coord) positions.set(coord.agent, { x: coordX, y: coordY })
  workers.forEach((w, i) => positions.set(w.agent, { x: workerXs[i], y: workerY }))

  // Recent messages (for flow pulses) — last 2 seconds, sender+receiver both on graph
  const MSG_WINDOW_MS = 2000
  const recentMessages = messages.filter(m => {
    const age = now - new Date(m.timestamp).getTime()
    return age >= 0 && age < MSG_WINDOW_MS
      && positions.has(m.from) && positions.has(m.to)
      && m.from !== m.to
  })

  // Reviewer → worker edges from review requests (pending or recent)
  const reviewerEdges: Array<{ from: string; to: string }> = []
  for (const r of reviewRequests) {
    if (positions.has(r.reviewer_id) && positions.has(r.worker_id)) {
      reviewerEdges.push({ from: r.reviewer_id, to: r.worker_id })
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: 420, display: 'block' }}>
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#1e3a8a" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#bgGlow)" />

      {coord && workers.map((w, i) => {
        const active = isActive(w.agent) || isActive(coord.agent)
        return (
          <g key={`edge-${w.agent}`}>
            <line
              x1={coordX} y1={coordY} x2={workerXs[i]} y2={workerY}
              stroke={active ? '#60a5fa' : '#334155'}
              strokeWidth={active ? 2 : 1.25}
              strokeDasharray="5 4"
              opacity={active ? 0.9 : 0.55}
            >
              {active && (
                <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.9s" repeatCount="indefinite" />
              )}
            </line>
          </g>
        )
      })}

      {!coord && workers.map((w, i) => i > 0 && (
        <line key={`peer-edge-${w.agent}`}
          x1={workerXs[i - 1]} y1={workerY} x2={workerXs[i]} y2={workerY}
          stroke="#334155" strokeWidth={1} strokeDasharray="3 4" opacity={0.3} />
      ))}

      {/* Reviewer → worker edges (yellow dashed) */}
      {reviewerEdges.map(({ from, to }, i) => {
        const a = positions.get(from)!
        const b = positions.get(to)!
        return (
          <line
            key={`review-${from}-${to}-${i}`}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#eab308" strokeWidth={1.5} strokeDasharray="3 5" opacity={0.55}
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1.1s" repeatCount="indefinite" />
          </line>
        )
      })}

      {/* Message flow pulses */}
      {recentMessages.map((m, i) => {
        const a = positions.get(m.from)!
        const b = positions.get(m.to)!
        const pulseColor = m.type === 'block' ? '#ef4444'
          : m.type === 'broadcast' ? '#a78bfa'
          : '#60a5fa'
        const ageMs = now - new Date(m.timestamp).getTime()
        const progress = Math.min(ageMs / MSG_WINDOW_MS, 1)
        const x = a.x + (b.x - a.x) * progress
        const y = a.y + (b.y - a.y) * progress
        const opacity = 1 - progress
        return (
          <g key={`msg-${m.timestamp}-${i}`}>
            <circle cx={x} cy={y} r={6} fill={pulseColor} opacity={opacity}
              style={{ filter: `drop-shadow(0 0 8px ${pulseColor})` }} />
            <circle cx={x} cy={y} r={3} fill="#fff" opacity={opacity * 0.8} />
          </g>
        )
      })}

      {coord && <AgentNode agent={coord} x={coordX} y={coordY} active={isActive(coord.agent)} big
        stale={isStale(coord, now)}
        selected={selectedAgent === coord.agent}
        taskSelected={!!coord.task_id && selectedTask === coord.task_id}
        onClick={onSelectAgent ? () => onSelectAgent(coord.agent) : undefined}
        onTaskClick={onSelectTask} />}

      {workers.map((w, i) => (
        <AgentNode key={w.agent} agent={w} x={workerXs[i]} y={workerY} active={isActive(w.agent)}
          stale={isStale(w, now)}
          selected={selectedAgent === w.agent}
          taskSelected={!!w.task_id && selectedTask === w.task_id}
          onClick={onSelectAgent ? () => onSelectAgent(w.agent) : undefined}
          onTaskClick={onSelectTask} />
      ))}

      <Legend x={20} y={H - 24} />
    </svg>
  )
}

function AgentNode({ agent, x, y, active, big, selected, stale, onClick, onTaskClick, taskSelected }: { agent: AgentStatus; x: number; y: number; active: boolean; big?: boolean; selected?: boolean; stale?: boolean; taskSelected?: boolean; onClick?: () => void; onTaskClick?: (taskId: string) => void }) {
  const role = roleOf(agent.agent)
  const fill = ROLE_COLORS[role] ?? ROLE_COLORS.default
  const dead = agent.alive === false && agent.state !== 'complete'
  const stroke = dead ? '#7f1d1d' : (STATE_COLORS[agent.state] ?? '#374151')
  const baseR = big ? 34 : 28
  const tag = role.substring(0, 4).toUpperCase()

  return (
    <g
      transform={`translate(${x},${y})`}
      opacity={dead ? 0.55 : 1}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {selected && (
        <circle r={baseR + 10} fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 3" opacity={0.9} />
      )}
      {stale && !dead && (
        <circle r={baseR + 6} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="2 3" opacity={0.75}>
          <animate attributeName="opacity" values="0.75;0.35;0.75" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      {active && (
        <>
          <circle r={baseR + 6} fill="none" stroke={fill} strokeWidth={2} opacity={0.7}>
            <animate attributeName="r" values={`${baseR};${baseR + 22};${baseR}`} dur="1.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.85;0;0.85" dur="1.3s" repeatCount="indefinite" />
          </circle>
          <circle r={baseR + 3} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.5}>
            <animate attributeName="r" values={`${baseR};${baseR + 14};${baseR}`} dur="1.3s" begin="0.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0;0.7" dur="1.3s" begin="0.3s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      <circle
        r={baseR}
        fill={fill}
        stroke={stroke}
        strokeWidth={3}
        style={{ filter: active ? `drop-shadow(0 0 10px ${fill})` : `drop-shadow(0 1px 2px #000)` }}
      />
      <text x={0} y={5} textAnchor="middle" fill="#fff" fontSize={big ? 12 : 11} fontWeight={700}>
        {tag}
      </text>
      <text x={0} y={baseR + 16} textAnchor="middle" fill="#e5e7eb" fontSize={11} fontWeight={600}>
        {agent.agent}
      </text>
      <text x={0} y={baseR + 30} textAnchor="middle" fill={STATE_COLORS[agent.state] ?? '#9ca3af'} fontSize={10} fontWeight={700} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {dead ? 'DEAD' : agent.state}
      </text>
      {agent.task_id && (
        <g
          transform={`translate(0, ${baseR + 44})`}
          onClick={onTaskClick ? (e) => { e.stopPropagation(); onTaskClick(agent.task_id!) } : undefined}
          style={onTaskClick ? { cursor: 'pointer' } : undefined}
        >
          <rect
            x={-(agent.task_id.length * 3.3 + 8)}
            y={-8}
            width={agent.task_id.length * 3.3 * 2 + 16}
            height={13}
            rx={6}
            fill={taskSelected ? '#14b8a6' : '#1f2937'}
            stroke={taskSelected ? '#5eead4' : '#374151'}
            strokeWidth={1}
          />
          <text x={0} y={2} textAnchor="middle" fill={taskSelected ? '#f0fdfa' : '#9ca3af'} fontSize={9} fontWeight={600}>
            {agent.task_id}
          </text>
        </g>
      )}
    </g>
  )
}

function Legend({ x, y }: { x: number; y: number }) {
  const items: Array<[string, string]> = [
    ['coordinator', ROLE_COLORS.coordinator],
    ['worker',      ROLE_COLORS.worker],
    ['reviewer',    ROLE_COLORS.reviewer],
  ]
  return (
    <g transform={`translate(${x},${y})`}>
      {items.map(([label, color], i) => (
        <g key={label} transform={`translate(${i * 110},0)`}>
          <circle cx={6} cy={-4} r={5} fill={color} />
          <text x={16} y={0} fill="#6b7280" fontSize={10} fontWeight={600} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </text>
        </g>
      ))}
    </g>
  )
}
