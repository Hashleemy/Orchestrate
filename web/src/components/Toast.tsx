import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'warning' | 'error' | 'info'

export interface ToastAction {
  label:   string
  onClick: () => void
}

export interface Toast {
  id:      number
  kind:    ToastKind
  title:   string
  body?:   string
  ttlMs:   number
  action?: ToastAction
}

export interface ToastOptions {
  body?:   string
  ttlMs?:  number
  action?: ToastAction
}

type Listener = (t: Toast) => void
const listeners = new Set<Listener>()
let nextId = 1

export function toast(kind: ToastKind, title: string, body?: string, ttlMs?: number): void
export function toast(kind: ToastKind, title: string, opts: ToastOptions): void
export function toast(kind: ToastKind, title: string, bodyOrOpts?: string | ToastOptions, ttlMs = 4000) {
  let opts: ToastOptions = {}
  if (typeof bodyOrOpts === 'string' || bodyOrOpts === undefined) {
    opts = { body: bodyOrOpts as string | undefined, ttlMs }
  } else {
    opts = bodyOrOpts
  }
  const t: Toast = {
    id: nextId++,
    kind,
    title,
    body: opts.body,
    ttlMs: opts.ttlMs ?? 4000,
    action: opts.action,
  }
  listeners.forEach(fn => fn(t))
}

type Item = Toast & { leaving?: boolean }

const LEAVE_MS = 250

export function ToastHost() {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    const listener: Listener = t => {
      setItems(prev => [...prev, { ...t }])
      if (t.ttlMs > 0) {
        setTimeout(() => beginLeave(t.id), t.ttlMs)
      }
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const el = document.activeElement as HTMLElement | null
      if (el) {
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
      }
      setItems(prev => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const it = prev[i]
          if (!it.leaving) {
            setTimeout(() => beginLeave(it.id), 0)
            break
          }
        }
        return prev
      })
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [])

  function beginLeave(id: number) {
    setItems(prev => prev.map(x => x.id === id ? { ...x, leaving: true } : x))
    setTimeout(() => {
      setItems(prev => prev.filter(x => x.id !== id))
    }, LEAVE_MS)
  }

  function dismissAll() {
    setItems(prev => prev.map(x => x.leaving ? x : { ...x, leaving: true }))
    setTimeout(() => setItems([]), LEAVE_MS)
  }

  const activeCount = items.filter(i => !i.leaving).length

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column-reverse', gap: 8,
      maxWidth: 360, pointerEvents: 'none',
    }}>
      {items.map((t, i) => (
        <ToastCard
          key={t.id}
          toast={t}
          leaving={t.leaving}
          onDismiss={() => beginLeave(t.id)}
          stackCount={i === items.length - 1 && activeCount > 1 ? activeCount : undefined}
          onDismissAll={dismissAll}
        />
      ))}
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

function ToastCard({ toast, onDismiss, leaving, stackCount, onDismissAll }: { toast: Toast; onDismiss: () => void; leaving?: boolean; stackCount?: number; onDismissAll?: () => void }) {
  const c = COLORS[toast.kind]
  return (
    <div
      style={{
        background: c.bg, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.icon}`,
        borderRadius: 6, padding: '10px 14px',
        color: c.text, fontSize: 13,
        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        pointerEvents: 'auto',
        position: 'relative',
        animation: leaving
          ? `toast-fade-out ${LEAVE_MS}ms ease-in forwards`
          : 'toast-slide-in 220ms ease-out',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}
    >
      {stackCount !== undefined && stackCount > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismissAll?.() }}
          title={`Dismiss all ${stackCount} notifications`}
          style={{
            position: 'absolute', top: -8, left: -8,
            background: c.icon, color: '#0b1220',
            border: 'none', borderRadius: 10,
            minWidth: 20, height: 20, padding: '0 6px',
            fontSize: 11, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×{stackCount}</button>
      )}
      <span style={{ color: c.icon, fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{ICONS[toast.kind]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: toast.body ? 3 : 0 }}>{toast.title}</div>
        {toast.body && <div style={{ color: c.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{toast.body}</div>}
        {toast.action && (
          <div style={{ marginTop: 6 }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                try { toast.action!.onClick() } finally { onDismiss() }
              }}
              style={{
                background: 'transparent',
                border: `1px solid ${c.border}`,
                color: c.icon,
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>
      <button
        aria-label="Dismiss notification"
        title="Dismiss"
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        style={{
          background: 'transparent', border: 'none', color: c.text,
          cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
          opacity: 0.65,
          marginLeft: 2,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.65' }}
      >
        ×
      </button>
    </div>
  )
}
