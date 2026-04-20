import type React from 'react'

type GlyphName = 'agents' | 'tasks' | 'runs' | 'comms' | 'approvals' | 'reviews'

const PATHS: Record<GlyphName, React.ReactNode> = {
  agents: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.6 3.2-6 7-6s7 2.4 7 6" />
    </>
  ),
  tasks: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  runs: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 8l5 4-5 4V8z" fill="currentColor" stroke="none" />
    </>
  ),
  comms: (
    <>
      <path d="M4 6h16v10H9l-5 4V6z" />
    </>
  ),
  approvals: (
    <>
      <path d="M5 12l4 4 10-10" />
    </>
  ),
  reviews: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </>
  ),
}

export function Glyph({ name, size = 22, color = '#6b7280' }: { name: GlyphName; size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
