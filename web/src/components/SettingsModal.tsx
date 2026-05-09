import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { DEFAULTS, SETTING_KEYS, getBoolSetting, getIntSetting, setBoolSetting, setIntSetting } from '../settings'
import { toast } from './Toast'
import type { HealthInfo } from '../types'

interface Props {
  open:    boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props) {
  const [stale, setStale] = useState(() => getIntSetting(SETTING_KEYS.staleSec, DEFAULTS.staleSec))
  const [live,  setLive]  = useState(() => getIntSetting(SETTING_KEYS.liveSec,  DEFAULTS.liveSec))
  const [dimTerminal, setDimTerminal] = useState(() => getBoolSetting(SETTING_KEYS.dimTerminal, true))
  const [compact,     setCompact]     = useState(() => getBoolSetting(SETTING_KEYS.compact,     false))
  const [health,      setHealth]      = useState<HealthInfo | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [open])

  useEffect(() => {
    if (!open) return
    setStale(getIntSetting(SETTING_KEYS.staleSec, DEFAULTS.staleSec))
    setLive(getIntSetting(SETTING_KEYS.liveSec, DEFAULTS.liveSec))
    setDimTerminal(getBoolSetting(SETTING_KEYS.dimTerminal, true))
    setCompact(getBoolSetting(SETTING_KEYS.compact, false))
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  function save() {
    setIntSetting(SETTING_KEYS.staleSec, stale)
    setIntSetting(SETTING_KEYS.liveSec, live)
    setBoolSetting(SETTING_KEYS.dimTerminal, dimTerminal)
    setBoolSetting(SETTING_KEYS.compact, compact)
    window.dispatchEvent(new Event('orchestrate-settings-changed'))
    onClose()
  }

  function resetDefaults() {
    if (!window.confirm('Reset all dashboard settings to defaults? This affects stale/live thresholds, dim mode, and compact mode.')) return
    setStale(DEFAULTS.staleSec)
    setLive(DEFAULTS.liveSec)
    setDimTerminal(true)
    setCompact(false)
    setIntSetting(SETTING_KEYS.staleSec, DEFAULTS.staleSec)
    setIntSetting(SETTING_KEYS.liveSec, DEFAULTS.liveSec)
    setBoolSetting(SETTING_KEYS.dimTerminal, true)
    setBoolSetting(SETTING_KEYS.compact, false)
    window.dispatchEvent(new Event('orchestrate-settings-changed'))
    toast('success', 'Settings reset', 'Defaults applied')
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111827', border: '1px solid #374151',
          borderRadius: 10, padding: '22px 26px',
          minWidth: 380, maxWidth: 460,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, color: '#f9fafb', fontSize: 16, fontWeight: 700 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none', border: '1px solid #374151',
              color: '#9ca3af', borderRadius: 4,
              padding: '2px 9px', fontSize: 11, cursor: 'pointer',
            }}
          >Esc</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            label="Heartbeat stale threshold"
            help="Agents whose last heartbeat is older than this are flagged STALE."
            suffix="seconds (default 90)"
            value={stale}
            onChange={setStale}
          />
          <Field
            label="SSE LIVE indicator threshold"
            help="The top-bar indicator reads LIVE when an event arrived within this window."
            suffix="seconds (default 10)"
            value={live}
            onChange={setLive}
          />
          <BoolField
            label="Dim completed/stopped agents during active runs"
            help="When on, terminal agents fade so active ones stand out."
            checked={dimTerminal}
            onChange={setDimTerminal}
          />
          <BoolField
            label="Compact mode"
            help="Reduces padding and spacing across the dashboard for denser layout."
            checked={compact}
            onChange={setCompact}
          />
        </div>

        {health && (
          <div style={{
            marginTop: 18, paddingTop: 14, borderTop: '1px solid #1f2937',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px',
          }}>
            <HealthRow label="Version"    value={health.version} />
            <HealthRow label="Go"         value={health.go_version} />
            <HealthRow label="Uptime"     value={formatUptime(health.uptime_sec)} />
            <HealthRow label="Agents live" value={String(health.agents_alive)} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            onClick={save}
            style={{
              background: '#2563eb', border: 'none', color: '#fff',
              borderRadius: 5, padding: '7px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >Save</button>
          <button
            onClick={resetDefaults}
            style={{
              background: 'none', border: '1px solid #374151',
              color: '#9ca3af', borderRadius: 5,
              padding: '7px 12px', fontSize: 13, cursor: 'pointer',
            }}
          >Reset to defaults</button>
        </div>
      </div>
    </div>
  )
}

function BoolField({ label, help, checked, onChange }: {
  label: string; help: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 3, accentColor: '#2563eb' }}
      />
      <div>
        <div style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{help}</div>
      </div>
    </label>
  )
}

function Field({ label, help, suffix, value, onChange }: {
  label: string; help: string; suffix: string
  value: number; onChange: (n: number) => void
}) {
  return (
    <div>
      <div style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 5 }}>{help}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          min={1}
          value={value}
          onChange={e => onChange(Math.max(1, parseInt(e.target.value || '0', 10) || 1))}
          style={{
            background: '#0f172a', border: '1px solid #334155',
            color: '#e2e8f0', borderRadius: 4,
            padding: '4px 9px', fontSize: 13, width: 90,
            fontFamily: 'monospace', outline: 'none',
          }}
        />
        <span style={{ color: '#6b7280', fontSize: 11 }}>{suffix}</span>
      </div>
    </div>
  )
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ color: '#4b5563', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: '#93c5fd', fontFamily: 'monospace', fontSize: 11 }}>{value}</span>
    </div>
  )
}

function formatUptime(sec: number): string {
  if (sec < 60)    return `${sec}s`
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ${sec % 60}s`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h ${m}m`
}
