import { useState } from 'react'
import { api } from '../api/client'
import { approvalKindColor, approvalKindIcon } from './approvalKind'
import type { Checkpoint } from '../types'

interface Props {
  checkpoints: Checkpoint[]
  onResolved:  () => void
}

export function CheckpointPanel({ checkpoints, onResolved }: Props) {
  const pending = checkpoints.filter(c => c.status === 'pending')

  if (pending.length === 0) return null

  return (
    <div style={{
      background: '#1c0a00',
      border: '2px solid #f97316',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>🛑</span>
        <h2 style={{ margin: 0, color: '#fb923c', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Orchestration Paused — {pending.length} Checkpoint{pending.length !== 1 ? 's' : ''} Require Your Attention
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pending.map(cp => (
          <CheckpointCard key={cp.id} checkpoint={cp} onResolved={onResolved} />
        ))}
      </div>
    </div>
  )
}

function CheckpointCard({ checkpoint: cp, onResolved }: { checkpoint: Checkpoint; onResolved: () => void }) {
  const [loading, setLoading] = useState(false)
  const [chosen,  setChosen]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const color = approvalKindColor(cp.kind)
  const icon  = approvalKindIcon(cp.kind)
  const age   = formatAge(cp.created_at)

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
        </div>
      </div>

      {/* Detail */}
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#d1d5db', lineHeight: 1.5 }}>
        {cp.detail}
      </p>

      {/* Next steps */}
      {cp.next_steps?.length > 0 && (
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

function formatAge(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}
