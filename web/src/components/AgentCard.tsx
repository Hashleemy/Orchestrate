import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { CopyId } from './CopyId'
import { toast } from './Toast'
import { staleSec } from '../settings'
import type { AgentPushResult, AgentStatus, DiffSummary, OrchestratorEvent } from '../types'

const STATE_COLOR: Record<string, string> = {
  idle: '#6b7280',
  planning: '#3b82f6',
  coding: '#22c55e',
  testing: '#06b6d4',
  blocked: '#f97316',
  awaiting_approval: '#eab308',
  complete: '#15803d',
  stopped: '#7f1d1d',
}

const KIND_COLOR: Record<string, string> = {
  minor:   '#22c55e',
  major:   '#f97316',
  blocked: '#ef4444',
}

function heartbeatAge(ts: string): { label: string; secs: number; stale: boolean; threshold: number } {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  const threshold = staleSec()
  const stale = secs > threshold
  const label = secs < 60
    ? `${secs}s ago`
    : secs < 3600
      ? `${Math.floor(secs / 60)}m ago`
      : `${Math.floor(secs / 3600)}h ago`
  return { label, secs, stale, threshold }
}

function persistedBool(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage?.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch { /* localStorage unavailable */ }
  return fallback
}

function persistBool(key: string, value: boolean) {
  try { window.localStorage?.setItem(key, value ? '1' : '0') }
  catch { /* ignore */ }
}

export function AgentCard({ agent, onRespawn, recentAction, recentEvents, onFilterAgent }: { agent: AgentStatus; onRespawn?: () => void; recentAction?: boolean; recentEvents?: OrchestratorEvent[]; onFilterAgent?: (agentId: string) => void }) {
  const [diff, setDiff]         = useState<DiffSummary | null>(null)
  const [diffErr, setDiffErr]   = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [pushing,     setPushing]     = useState(false)
  const [pushResult,  setPushResult]  = useState<AgentPushResult | null>(null)
  const [respawning,  setRespawning]  = useState(false)
  const [respawnErr,  setRespawnErr]  = useState<string | null>(null)
  const logsKey = `orchestrate.logs.${agent.agent}`
  const [showLogs,    setShowLogs]    = useState<boolean>(() => persistedBool(logsKey, false))
  const [logLines,    setLogLines]    = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { persistBool(logsKey, showLogs) }, [showLogs, logsKey])

  useEffect(() => {
    if (!showLogs) return
    setLogLines([])
    const es = new EventSource(`/api/agents/${encodeURIComponent(agent.agent)}/logs`)
    es.onmessage = (e: MessageEvent) => {
      setLogLines(prev => {
        const next = [...prev, e.data as string]
        return next.length > 500 ? next.slice(-500) : next
      })
    }
    return () => es.close()
  }, [showLogs, agent.agent])

  useEffect(() => {
    if (showLogs) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logLines, showLogs])

  const dead = agent.alive === false && agent.state !== 'complete'
  const color = dead ? '#7f1d1d' : (STATE_COLOR[agent.state] ?? '#6b7280')
  const { label, secs: hbSecs, stale: clientStale, threshold: hbThreshold } = heartbeatAge(agent.timestamp)
  const stale = agent.stale ?? clientStale

  async function toggleDiff() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    if (diff || diffErr) return
    try {
      setDiff(await api.agentDiff(agent.agent))
    } catch (e) {
      setDiffErr(String(e))
    }
  }

  async function handleRespawn() {
    setRespawning(true)
    setRespawnErr(null)
    try {
      await api.respawn(agent.agent)
      toast('success', `${agent.agent} restarted`)
      onRespawn?.()
    } catch (e) {
      const msg = String(e).replace(/^Error: /, '')
      setRespawnErr(msg)
      toast('error', 'Respawn failed', msg)
    } finally {
      setRespawning(false)
    }
  }

  async function handlePush(force = false) {
    setPushing(true)
    setPushResult(null)
    try {
      const result = await api.pushBranch(agent.agent, force)
      setPushResult(result)
      if (result.status === 'pushed') {
        toast('success', `Pushed ${result.branch}`, force ? 'Force pushed' : undefined)
      } else if (result.status === 'approval_required') {
        toast('warning', 'Approval required', result.decision?.reasons?.join('\n'))
      } else if (result.status === 'blocked') {
        toast('error', 'Push blocked', result.decision?.reasons?.join('\n'))
      } else {
        toast('error', 'Push error', result.output)
      }
    } catch (e) {
      const msg = String(e)
      setPushResult({ agent_id: agent.agent, branch: agent.branch, status: 'error', output: msg })
      toast('error', 'Push error', msg)
    } finally {
      setPushing(false)
    }
  }

  return (
    <div style={{
      border: `2px solid ${dead ? '#7f1d1d' : stale ? '#ef4444' : recentAction ? color : '#374151'}`,
      borderRadius: 8,
      padding: '12px 16px',
      background: dead ? '#1a0a0a' : '#1f2937',
      minWidth: 240,
      maxWidth: 340,
      opacity: dead ? 0.75 : 1,
      boxShadow: recentAction && !dead ? `0 0 16px ${color}55, 0 0 32px ${color}22` : undefined,
      transition: 'box-shadow 300ms ease, border-color 300ms ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: '#f9fafb', fontSize: 13 }}>{agent.agent}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {dead && (
            <span style={{ fontSize: 10, color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase' }}>DEAD</span>
          )}
          {!dead && stale && (
            <span
              title={`No heartbeat in ${hbSecs}s (threshold ${hbThreshold}s)`}
              style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}
            >STALE · {hbSecs}s</span>
          )}
          <span style={{
            background: color, color: '#fff',
            borderRadius: 4, padding: '1px 8px',
            fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>{agent.state}</span>
        </div>
      </div>

      <Row label="Task"   value={agent.task_id    || '—'} copyable={!!agent.task_id} />
      <Row label="Branch" value={agent.branch     || '—'} copyable={!!agent.branch} />
      <Row label="Action" value={agent.last_action || '—'} muted />

      {recentEvents && recentEvents.length > 0 && (
        <MiniTimeline events={recentEvents} agent={agent.agent} onFilterAgent={onFilterAgent} />
      )}

      {(dead || stale) && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRespawn}
            disabled={respawning}
            style={{
              background: '#1f2937', border: '1px solid #4b5563',
              color: '#e5e7eb', borderRadius: 4,
              padding: '3px 10px', fontSize: 11, cursor: respawning ? 'default' : 'pointer',
              opacity: respawning ? 0.6 : 1,
            }}
          >{respawning ? 'Restarting…' : '↺ Restart'}</button>
          {respawnErr && (
            <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 8 }}>{respawnErr}</span>
          )}
        </div>
      )}

      {!dead && agent.state !== 'complete' && agent.state !== 'stopped' && (
        <div style={{ marginTop: 6 }}>
          <button
            disabled
            title="Pause/resume not wired in backend yet"
            style={{
              background: '#1f2937', border: '1px dashed #4b5563',
              color: '#6b7280', borderRadius: 4,
              padding: '3px 10px', fontSize: 11, cursor: 'not-allowed',
            }}
          >⏸ Pause (soon)</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div
          title={`Heartbeat: ${agent.timestamp}`}
          style={{ fontSize: 11, color: stale ? '#ef4444' : '#6b7280', cursor: 'help' }}
        >♥ {label}</div>
        {diff && !expanded && (
          <span style={{
            background: KIND_COLOR[diff.kind] ?? '#6b7280',
            color: '#fff', borderRadius: 3,
            padding: '0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          }}>{diff.kind}</span>
        )}
        <button
          onClick={toggleDiff}
          style={{
            background: 'none', border: '1px solid #374151',
            color: '#9ca3af', borderRadius: 4,
            padding: '2px 8px', fontSize: 11, cursor: 'pointer',
          }}
        >{expanded ? 'Hide diff' : 'Diff ▾'}</button>
        <button
          onClick={() => setShowLogs(s => !s)}
          style={{
            background: showLogs ? '#1e3a5f' : 'none',
            border: '1px solid #374151',
            color: showLogs ? '#60a5fa' : '#9ca3af',
            borderRadius: 4, padding: '2px 8px',
            fontSize: 11, cursor: 'pointer',
          }}
        >{showLogs ? 'Hide logs' : 'Logs ▾'}</button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid #374151', paddingTop: 10 }}>
          {diffErr && <div style={{ color: '#ef4444', fontSize: 11 }}>{diffErr}</div>}
          {!diff && !diffErr && <div style={{ color: '#6b7280', fontSize: 11 }}>Loading…</div>}
          {diff && <DiffPanel diff={diff} />}
        </div>
      )}

      {showLogs && (
        <div style={{ marginTop: 8, borderTop: '1px solid #374151', paddingTop: 8 }}>
          <div style={{
            background: '#0a0f1a', borderRadius: 5, border: '1px solid #1e3a5f',
            maxHeight: 200, overflowY: 'auto', padding: '6px 8px',
            fontFamily: 'monospace', fontSize: 10,
          }}>
            {logLines.length === 0
              ? <span style={{ color: '#374151' }}>Waiting for log events…</span>
              : logLines.map((line, i) => <LogLine key={i} raw={line} />)
            }
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {agent.branch && (
        <div style={{ marginTop: 8, borderTop: '1px solid #374151', paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handlePush(false)}
              disabled={pushing}
              style={{
                background: '#1d4ed8', border: 'none',
                color: '#fff', borderRadius: 4,
                padding: '3px 10px', fontSize: 11, cursor: pushing ? 'default' : 'pointer',
                opacity: pushing ? 0.6 : 1,
              }}
            >{pushing ? 'Pushing…' : 'Push'}</button>
            {pushResult?.status === 'approval_required' && (
              <button
                onClick={() => handlePush(true)}
                disabled={pushing}
                style={{
                  background: '#92400e', border: 'none',
                  color: '#fff', borderRadius: 4,
                  padding: '3px 10px', fontSize: 11, cursor: pushing ? 'default' : 'pointer',
                  opacity: pushing ? 0.6 : 1,
                }}
              >Force push</button>
            )}
          </div>
          {pushResult && <PushResultBadge result={pushResult} />}
        </div>
      )}
    </div>
  )
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  task_started:       '#3b82f6',
  file_edit:          '#22c55e',
  test_run:           '#06b6d4',
  commit:             '#a78bfa',
  blocked:            '#f97316',
  unblocked:          '#22c55e',
  approval_requested: '#eab308',
  approval_received:  '#22c55e',
  completed:          '#15803d',
  error:              '#ef4444',
}

function LogLine({ raw }: { raw: string }) {
  try {
    const ev = JSON.parse(raw) as { timestamp?: string; type?: string; detail?: string }
    const time = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
    const color = EVENT_TYPE_COLOR[ev.type ?? ''] ?? '#6b7280'
    return (
      <div style={{ marginBottom: 2, lineHeight: 1.5 }}>
        <span style={{ color: '#374151', marginRight: 6 }}>{time}</span>
        <span style={{ color, marginRight: 6, fontWeight: 700 }}>[{ev.type ?? '?'}]</span>
        <span style={{ color: '#9ca3af' }}>{ev.detail ?? raw}</span>
      </div>
    )
  } catch {
    return <div style={{ color: '#6b7280', marginBottom: 2 }}>{raw}</div>
  }
}

const PUSH_STATUS_COLOR: Record<string, string> = {
  pushed:            '#15803d',
  approval_required: '#b45309',
  blocked:           '#b91c1c',
  error:             '#7f1d1d',
}

function PushResultBadge({ result }: { result: AgentPushResult }) {
  const color = PUSH_STATUS_COLOR[result.status] ?? '#6b7280'
  const label: Record<string, string> = {
    pushed:            'Pushed',
    approval_required: 'Approval required',
    blocked:           'Blocked',
    error:             'Error',
  }
  return (
    <div style={{ marginTop: 6 }}>
      <span style={{
        background: color, color: '#fff',
        borderRadius: 3, padding: '1px 8px',
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      }}>{label[result.status] ?? result.status}</span>
      {result.decision?.reasons && result.decision.reasons.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {result.decision.reasons.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: '#fbbf24' }}>⚠ {r}</div>
          ))}
        </div>
      )}
      {result.output && (
        <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', marginTop: 4, whiteSpace: 'pre-wrap' }}>
          {result.output}
        </div>
      )}
    </div>
  )
}

function DiffPanel({ diff }: { diff: DiffSummary }) {
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{
          background: KIND_COLOR[diff.kind] ?? '#6b7280',
          color: '#fff', borderRadius: 3,
          padding: '1px 8px', fontWeight: 700, textTransform: 'uppercase',
        }}>{diff.kind}</span>
        <span style={{ color: '#9ca3af' }}>{diff.base_ref}..{diff.branch}</span>
      </div>

      <div style={{ color: '#6b7280', marginBottom: 4 }}>
        {diff.file_count} file{diff.file_count !== 1 ? 's' : ''}&nbsp;
        <span style={{ color: '#22c55e' }}>+{diff.insertions}</span>&nbsp;
        <span style={{ color: '#ef4444' }}>−{diff.deletions}</span>
      </div>

      {diff.reasons.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {diff.reasons.map((r, i) => (
            <div key={i} style={{ color: '#fbbf24', marginBottom: 2 }}>⚠ {r}</div>
          ))}
        </div>
      )}

      {diff.files.length > 0 && (
        <div style={{ maxHeight: 120, overflowY: 'auto' }}>
          {diff.files.slice(0, 30).map((f, i) => (
            <div key={i} style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{f}</div>
          ))}
          {diff.files.length > 30 && (
            <div style={{ color: '#6b7280' }}>…and {diff.files.length - 30} more</div>
          )}
        </div>
      )}
    </div>
  )
}

const MINI_TYPE_GLYPH: Record<string, string> = {
  task_started:       '▶',
  task_claimed:       '◎',
  file_edit:          '✎',
  test_run:           '⟳',
  test_pass:          '✓',
  test_fail:          '✗',
  commit:             '⎙',
  push:               '⇪',
  merged:             '⤵',
  blocked:            '⛔',
  unblocked:          '✓',
  approval_requested: '⏳',
  approval_received:  '✓',
  message_sent:       '→',
  message_received:   '←',
  completed:          '●',
  error:              '!',
}

function timeAgo(ts: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
  if (secs < 60)    return `${secs}s`
  if (secs < 3600)  return `${Math.floor(secs / 60)}m`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`
  return `${Math.floor(secs / 86400)}d`
}

function MiniTimeline({ events, agent, onFilterAgent }: { events: OrchestratorEvent[]; agent: string; onFilterAgent?: (agent: string) => void }) {
  const latest3 = events.slice(0, 3)
  return (
    <div style={{
      marginTop: 8, paddingTop: 6,
      borderTop: '1px dashed #374151',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      {latest3.map((e, i) => {
        const color = EVENT_TYPE_COLOR[e.type] ?? '#6b7280'
        const glyph = MINI_TYPE_GLYPH[e.type] ?? '·'
        return (
          <div
            key={`${e.timestamp}-${i}`}
            title={`${e.type} — ${e.detail ?? ''}\nClick to filter feed to ${agent}`}
            onClick={() => onFilterAgent?.(agent)}
            style={{
              display: 'flex', gap: 6, alignItems: 'center',
              fontSize: 10, color: '#9ca3af',
              cursor: onFilterAgent ? 'pointer' : 'default',
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color, fontWeight: 700, width: 10, textAlign: 'center' }}>{glyph}</span>
            <span style={{ color: '#6b7280', minWidth: 20 }}>{timeAgo(e.timestamp)}</span>
            <span style={{ color, textTransform: 'uppercase', fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>
              {e.type.replace(/_/g, ' ')}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {e.detail ?? ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Row({ label, value, muted, copyable }: { label: string; value: string; muted?: boolean; copyable?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 12, marginBottom: 2 }}>
      <span style={{ color: '#6b7280', minWidth: 48 }}>{label}</span>
      <span style={{
        color: muted ? '#9ca3af' : '#d1d5db',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {copyable ? <CopyId value={value} color={muted ? '#9ca3af' : '#d1d5db'} monospace={false} /> : value}
      </span>
    </div>
  )
}
