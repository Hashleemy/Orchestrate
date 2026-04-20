import { useEffect, useState } from 'react'

type Shortcut = { keys: string[]; description: string }

const SHORTCUTS: Shortcut[] = [
  { keys: ['N'],       description: 'Add a new task' },
  { keys: ['/'],       description: 'Focus feed search when hovered, otherwise the agent filter' },
  { keys: ['G'],       description: 'Jump to the orchestration graph' },
  { keys: ['S'],       description: 'Open the global search palette' },
  { keys: ['C'],       description: 'Toggle compact mode' },
  { keys: ['Ctrl+K'],  description: 'Open the global search palette (works from inputs too)' },
  { keys: ['J', 'K'],  description: 'Move cursor down / up in the hovered section (feed, tasks, reviews, runs)' },
  { keys: ['Enter'],   description: 'Feed: filter to task · Tasks: open drawer · Reviews: expand' },
  { keys: ['Shift+A'], description: 'Reviews: merge focused verdict when mergeable' },
  { keys: ['Shift+R'], description: 'Reviews: prefill re-review form with focused worker/task' },
  { keys: ['?'],       description: 'Show this cheat sheet' },
  { keys: ['Esc'],     description: 'Close modal/form, clear filter, or dismiss newest toast' },
]

export function ShortcutOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable
      if (e.key === 'Escape' && open) {
        setOpen(false)
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '?') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111827',
          border: '1px solid #374151',
          borderRadius: 10,
          padding: '22px 28px',
          minWidth: 360, maxWidth: 520,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, color: '#f9fafb', fontSize: 16, fontWeight: 700 }}>Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            style={{
              marginLeft: 'auto',
              background: 'none', border: '1px solid #374151',
              color: '#9ca3af', borderRadius: 4,
              padding: '2px 9px', fontSize: 11, cursor: 'pointer',
            }}
          >Esc</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SHORTCUTS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', gap: 4, minWidth: 90 }}>
                {s.keys.map(k => (
                  <kbd
                    key={k}
                    style={{
                      fontFamily: 'monospace', fontSize: 11, color: '#d1d5db',
                      border: '1px solid #374151', borderRadius: 4,
                      padding: '2px 8px', background: '#0f172a', fontWeight: 700,
                    }}
                  >{k}</kbd>
                ))}
              </div>
              <span style={{ color: '#9ca3af', fontSize: 13 }}>{s.description}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, color: '#4b5563', fontSize: 11 }}>
          Click outside or press Esc to close.
        </div>
      </div>
    </div>
  )
}
