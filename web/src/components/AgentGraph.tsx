import { useEffect, useState } from 'react'
import type { AgentStatus, OrchestratorEvent } from '../types'

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

function roleOf(agentId: string): string {
  const parts = agentId.split('-')
  if (parts.length >= 3) return parts[1]
  return 'default'
}

interface Props {
  agents: AgentStatus[]
  events: OrchestratorEvent[]
}

export function AgentGraph({ agents, events }: Props) {
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

      {coord && <AgentNode agent={coord} x={coordX} y={coordY} active={isActive(coord.agent)} big />}

      {workers.map((w, i) => (
        <AgentNode key={w.agent} agent={w} x={workerXs[i]} y={workerY} active={isActive(w.agent)} />
      ))}

      <Legend x={20} y={H - 24} />
    </svg>
  )
}

function AgentNode({ agent, x, y, active, big }: { agent: AgentStatus; x: number; y: number; active: boolean; big?: boolean }) {
  const role = roleOf(agent.agent)
  const fill = ROLE_COLORS[role] ?? ROLE_COLORS.default
  const dead = agent.alive === false && agent.state !== 'complete'
  const stroke = dead ? '#7f1d1d' : (STATE_COLORS[agent.state] ?? '#374151')
  const baseR = big ? 34 : 28
  const tag = role.substring(0, 4).toUpperCase()

  return (
    <g transform={`translate(${x},${y})`} opacity={dead ? 0.55 : 1}>
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
        <text x={0} y={baseR + 44} textAnchor="middle" fill="#6b7280" fontSize={9}>
          {agent.task_id}
        </text>
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
