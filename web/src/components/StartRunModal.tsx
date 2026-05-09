import { useState } from 'react'
import { api } from '../api/client'

interface Props {
  onStart: (description: string, workerCount: number, repoUrl: string, repoPath: string) => Promise<void>
  onClose: () => void
  currentRepoPath?: string
  initialDescription?: string
  initialWorkerCount?: number
}

const DESCRIPTION_PLACEHOLDER = `Describe what you want to build. The more detail you provide, the better the agents can execute.

Example:
Build a REST API using Go with the following features:
- User authentication (JWT-based)
- CRUD endpoints for a "projects" resource
- PostgreSQL database with migrations
- OpenAPI docs auto-generated
- Docker Compose setup for local dev
- Unit tests with ≥80% coverage

Be as specific as possible: stack, features, acceptance criteria, non-goals, etc.`

const RECENT_PATHS_KEY = 'orchestrate.startrun.recentpaths'

function loadRecentPaths(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PATHS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string').slice(0, 5) : []
  } catch { return [] }
}

function saveRecentPath(path: string) {
  const cur = loadRecentPaths()
  const next = [path, ...cur.filter(p => p !== path)].slice(0, 5)
  try { localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
}

export function StartRunModal({ onStart, onClose, currentRepoPath, initialDescription, initialWorkerCount }: Props) {
  const [description,  setDescription]  = useState(initialDescription ?? '')
  const [repoUrl,      setRepoUrl]      = useState('')
  const [repoPath,     setRepoPath]     = useState(currentRepoPath ?? '')
  const [workerCount,  setWorkerCount]  = useState(initialWorkerCount && initialWorkerCount > 0 ? Math.min(5, initialWorkerCount) : 1)
  const [loading,      setLoading]      = useState(false)
  const [browsing,     setBrowsing]     = useState(false)
  const [err,          setErr]          = useState<string | null>(null)
  const [recentPaths]                   = useState<string[]>(() => loadRecentPaths())

  async function browse() {
    setBrowsing(true)
    setErr(null)
    try {
      const { path } = await api.pickRepo()
      if (path) setRepoPath(path)
    } catch (e) {
      setErr(String(e))
    } finally {
      setBrowsing(false)
    }
  }

  async function submit() {
    if (!description.trim()) { setErr('Describe the project first.'); return }
    if (!repoPath.trim())    { setErr('Select a project folder first.'); return }
    setLoading(true)
    setErr(null)
    try {
      if (repoPath) saveRecentPath(repoPath)
      await onStart(description.trim(), workerCount, repoUrl.trim(), repoPath.trim())
      onClose()
    } catch (e) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }

  const label = loading ? 'Starting…' : `Start Run (${workerCount} worker${workerCount === 1 ? '' : 's'} + coordinator)`

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#1f2937', border: '1px solid #374151',
        borderRadius: 12, padding: 28, width: 680, maxWidth: '95vw',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#f9fafb', fontSize: 16, fontWeight: 700 }}>Start a New Run</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Project Folder */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Project Folder
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={repoPath}
              onChange={e => setRepoPath(e.target.value)}
              placeholder="C:\Users\you\dev\my-project"
              style={{
                flex: 1, background: '#111827', border: '1px solid #374151',
                borderRadius: 6, color: '#d1d5db', fontSize: 13,
                fontFamily: 'monospace', padding: '8px 12px', outline: 'none',
              }}
            />
            <button
              onClick={browse}
              disabled={browsing}
              style={{
                background: '#374151', color: '#d1d5db', border: '1px solid #4b5563',
                borderRadius: 6, padding: '8px 14px', cursor: browsing ? 'default' : 'pointer',
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                opacity: browsing ? 0.6 : 1,
              }}
            >{browsing ? '…' : 'Browse'}</button>
          </div>
          {recentPaths.filter(p => p !== repoPath).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: '#4b5563', alignSelf: 'center' }}>recent:</span>
              {recentPaths.filter(p => p !== repoPath).slice(0, 3).map(p => (
                <button
                  key={p}
                  onClick={() => setRepoPath(p)}
                  title={p}
                  style={{
                    background: '#0b1220', border: '1px solid #1e3a5f',
                    color: '#93c5fd', borderRadius: 4,
                    padding: '2px 8px', fontSize: 11, fontFamily: 'monospace',
                    cursor: 'pointer', maxWidth: 200,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >{p.length > 30 ? '…' + p.slice(-28) : p}</button>
              ))}
            </div>
          )}
        </div>

        {/* GitHub URL */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            GitHub Repository <span style={{ color: '#4b5563', fontWeight: 400, textTransform: 'none' }}>(SSH URL — optional, clones into folder above)</span>
          </label>
          <input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="git@github.com:your-org/your-repo.git"
            style={{
              width: '100%', background: '#111827', border: '1px solid #374151',
              borderRadius: 6, color: '#d1d5db', fontSize: 13,
              fontFamily: 'monospace', padding: '8px 12px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
            Leave blank if the folder is already a git repo. Requires SSH keys configured on this machine.
          </div>
        </div>

        {/* Worker count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <label style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            Worker Agents:
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setWorkerCount(n)}
                style={{
                  width: 36, height: 32, border: '1px solid',
                  borderColor: workerCount === n ? '#2563eb' : '#374151',
                  borderRadius: 6,
                  background: workerCount === n ? '#2563eb' : '#111827',
                  color: workerCount === n ? '#fff' : '#9ca3af',
                  cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}
              >{n}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            + 1 coordinator (always)
          </span>
        </div>

        {/* Project Description */}
        <div style={{ marginBottom: 4 }}>
          <label style={{ display: 'block', color: '#9ca3af', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Project Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !loading) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={DESCRIPTION_PLACEHOLDER}
            rows={14}
            style={{
              width: '100%', background: '#111827',
              border: '1px solid #374151', borderRadius: 6,
              color: '#d1d5db', fontSize: 13,
              padding: 12, resize: 'vertical', outline: 'none',
              boxSizing: 'border-box', lineHeight: 1.5,
            }}
          />
          <div style={{ color: '#4b5563', fontSize: 11, marginTop: 4 }}>
            The coordinator converts this description into tasks. More detail = better results. Ctrl+Enter starts the run.
          </div>
        </div>

        {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: '#374151', color: '#d1d5db', border: 'none',
              borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontWeight: 600,
            }}
          >Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: 6, padding: '8px 24px', cursor: loading ? 'default' : 'pointer',
              fontWeight: 600, opacity: loading ? 0.6 : 1,
            }}
          >{label}</button>
        </div>
      </div>
    </div>
  )
}
