import { ApprovalCard } from './ApprovalCard'
import type { Approval } from '../types'

interface Props {
  approvals:  Approval[]
  onResolved: () => void
}

export function ApprovalQueue({ approvals, onResolved }: Props) {
  const pending  = approvals.filter(a => a.status === 'pending')
  const resolved = approvals.filter(a => a.status !== 'pending')

  if (approvals.length === 0) {
    return <div style={{ color: '#4b5563', fontSize: 13, padding: 4 }}>No approval requests.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map(a => (
            <ApprovalCard key={a.id} approval={a} onResolved={onResolved} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          {pending.length > 0 && (
            <div style={{ borderTop: '1px solid #374151', marginTop: 4, paddingTop: 4 }}>
              <span style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resolved ({resolved.length})
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {resolved.slice(0, 10).map(a => (
              <ApprovalCard key={a.id} approval={a} onResolved={onResolved} />
            ))}
            {resolved.length > 10 && (
              <div style={{ fontSize: 11, color: '#4b5563', paddingLeft: 4 }}>
                …and {resolved.length - 10} more resolved
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
