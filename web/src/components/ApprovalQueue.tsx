import { useEffect, useState } from 'react'
import { ApprovalCard } from './ApprovalCard'
import { Glyph } from './Glyph'
import { api } from '../api/client'
import { toast } from './Toast'
import type { Approval } from '../types'

interface Props {
  approvals:  Approval[]
  onResolved: () => void
}

const DIFF_TRIGGERS = new Set(['protected_merge', 'major_change', 'lockfile_change'])

export function ApprovalQueue({ approvals, onResolved }: Props) {
  const pending  = approvals.filter(a => a.status === 'pending')
  const resolved = approvals.filter(a => a.status !== 'pending')

  const [minorIds, setMinorIds] = useState<Set<string>>(new Set())
  const [bulking,  setBulking]  = useState(false)

  useEffect(() => {
    let cancelled = false
    const checkable = pending.filter(a => DIFF_TRIGGERS.has(a.trigger))
    if (checkable.length === 0) { setMinorIds(new Set()); return }

    Promise.all(checkable.map(a =>
      api.agentDiff(a.agent).then(d => d.kind === 'minor' ? a.id : null).catch(() => null)
    )).then(results => {
      if (cancelled) return
      const next = new Set<string>()
      for (const id of results) if (id) next.add(id)
      setMinorIds(next)
    })
    return () => { cancelled = true }
  }, [pending.map(p => p.id + ':' + p.agent).join('|')])

  const minorPending = pending.filter(a => minorIds.has(a.id))

  async function handleBulkApprove() {
    if (minorPending.length === 0) return
    if (!window.confirm(`Approve ${minorPending.length} minor changes?`)) return
    setBulking(true)
    let ok = 0, fail = 0
    for (const a of minorPending) {
      try { await api.approve(a.id); ok++ } catch { fail++ }
    }
    setBulking(false)
    if (fail === 0) toast('success', `Approved ${ok} minor changes`)
    else toast('warning', `Approved ${ok}`, `${fail} failed`)
    onResolved()
  }

  if (approvals.length === 0) {
    return (
      <div style={{ color: '#6b7280', fontSize: 13, padding: '12px 4px', lineHeight: 1.6 }}>
        <div style={{ marginBottom: 8 }}><Glyph name="approvals" size={22} color="#16a34a" /></div>
        No approvals pending. Agents will request approval here for things like
        package installs, sensitive-file edits, and merges to main.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {minorPending.length >= 2 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <button
            onClick={handleBulkApprove}
            disabled={bulking}
            style={{
              background: '#15803d', border: 'none', color: '#fff',
              borderRadius: 5, padding: '5px 12px', fontSize: 12, fontWeight: 600,
              cursor: bulking ? 'default' : 'pointer', opacity: bulking ? 0.6 : 1,
            }}
          >{bulking ? `Approving ${minorPending.length}…` : `Approve all minor (${minorPending.length})`}</button>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Only changes tagged MINOR by the diff check</span>
        </div>
      )}
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
