import { useEffect } from 'react'
import type { Task } from '../types'
import { PriorityChip, RiskChip, StatusChip } from './chips'
import { CopyId } from './CopyId'

interface Props {
  task: Task | null
  onClose: () => void
}

export function TaskDrawer({ task, onClose }: Props) {
  useEffect(() => {
    if (!task) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task, onClose])

  if (!task) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 460, maxWidth: '100vw', height: '100%',
          background: '#111827', borderLeft: '1px solid #374151',
          padding: '22px 26px', overflowY: 'auto',
          boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#93c5fd', marginBottom: 4, fontFamily: 'monospace' }}>
              <CopyId value={task.id} color="#93c5fd" />
            </div>
            <h2 style={{ margin: 0, color: '#f9fafb', fontSize: 17, fontWeight: 700, lineHeight: 1.35 }}>
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #374151',
              color: '#9ca3af', borderRadius: 4,
              padding: '2px 10px', fontSize: 11, cursor: 'pointer',
            }}
          >Esc</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <StatusChip status={task.status} />
          <PriorityChip priority={task.priority} />
          <RiskChip risk={task.risk} />
        </div>

        <DetailRow label="Owner"    value={task.owner || '—'} />
        <DetailRow label="Branch"   value={task.branch || '—'} mono />
        <DetailRow label="Depends on"
          value={task.depends_on?.length ? task.depends_on.join(', ') : '—'} mono />
        <DetailRow label="Blocked by"
          value={task.blocked_by?.length ? task.blocked_by.join(', ') : '—'} mono />

        <div style={{ marginTop: 'auto', color: '#4b5563', fontSize: 11, paddingTop: 20 }}>
          Click outside or press Esc to close.
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{
        color: '#6b7280', fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
      }}>{label}</div>
      <div style={{
        color: '#e5e7eb', fontSize: 13,
        fontFamily: mono ? 'monospace' : undefined,
        wordBreak: 'break-word',
      }}>{value}</div>
    </div>
  )
}
