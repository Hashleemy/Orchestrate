import { useState } from 'react'
import { toast } from './Toast'

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch { /* fall through */ }
  try {
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.position = 'absolute'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export function CopyId({ value, label, color, monospace = true }: { value: string; label?: string; color?: string; monospace?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const display = label ?? value
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      <span style={{
        fontFamily: monospace ? 'monospace' : undefined,
        color: color ?? '#93c5fd',
        fontSize: 'inherit',
      }}>{display}</span>
      <button
        onClick={async (e) => {
          e.stopPropagation()
          const ok = await copyText(value)
          toast(ok ? 'success' : 'error', ok ? 'Copied' : 'Copy failed', ok ? value : undefined, 2000)
        }}
        title={`Copy ${value}`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6b7280', fontSize: 10,
          padding: 0, opacity: hovered ? 1 : 0.25,
          transition: 'opacity 0.15s',
          lineHeight: 1,
        }}
      >⎘</button>
    </span>
  )
}
