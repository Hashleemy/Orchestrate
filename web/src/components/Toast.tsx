import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'warning' | 'error' | 'info'

export interface Toast {
  id:      number
  kind:    ToastKind
  title:   string
  body?:   string
  ttlMs:   number
}

type Listener = (t: Toast) => void
const listeners = new Set<Listener>()
let nextId = 1

export function toast(kind: ToastKind, title: string, body?: string, ttlMs = 4000) {
  const t: Toast = { id: nextId++, kind, title, body, ttlMs }
  listeners.forEach(fn => fn(t))
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([])

  useEffect(() => {
    const listener: Listener = t => {
      setItems(prev => [...prev, t])
      if (t.ttlMs > 0) {
        setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), t.ttlMs)
      }
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  function dismiss(id: number) {
    setItems(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 360, pointerEvents: 'none',
    }}>
      {items.map(t => <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
    </div>
  )
}

const COLORS: Record<ToastKind, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: '#052e16', border: '#15803d', icon: '#22c55e', text: '#bbf7d0' },
  warning: { bg: '#451a03', border: '#b45309', icon: '#eab308', text: '#fde68a' },
  error:   { bg: '#450a0a', border: '#991b1b', icon: '#ef4444', text: '#fecaca' },
  info:    { bg: '#0c2a4a', border: '#1d4ed8', icon: '#60a5fa', text: '#bfdbfe' },
}

const ICONS: Record<ToastKind, string> = {
  success: '✓',
  warning: '⚠',
  error:   '✕',
  info:    'ℹ',
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const c = COLORS[toast.kind]
  return (
    <div
      onClick={onDismiss}
      style={{
        background: c.bg, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.icon}`,
        borderRadius: 6, padding: '10px 14px',
        color: c.text, fontSize: 13,
        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        cursor: 'pointer', pointerEvents: 'auto',
        animation: 'toast-slide-in 200ms ease-out',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}
    >
      <span style={{ color: c.icon, fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{ICONS[toast.kind]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: toast.body ? 3 : 0 }}>{toast.title}</div>
        {toast.body && <div style={{ color: c.text, whiteSpace: 'pre-wrap' }}>{toast.body}</div>}
      </div>
    </div>
  )
}
