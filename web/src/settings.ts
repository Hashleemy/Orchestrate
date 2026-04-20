import { useEffect, useState } from 'react'

export const SETTING_KEYS = {
  staleSec:    'orchestrate.setting.stale_sec',
  liveSec:     'orchestrate.setting.live_sec',
  dimTerminal: 'orchestrate.setting.dim_terminal',
  compact:     'orchestrate.setting.compact',
} as const

export const DEFAULTS = {
  staleSec: 90,
  liveSec:  10,
}

export function getIntSetting(key: string, fallback: number): number {
  try {
    const raw = window.localStorage?.getItem(key)
    if (!raw) return fallback
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}

export function setIntSetting(key: string, value: number) {
  try { window.localStorage?.setItem(key, String(value)) } catch { /* ignore */ }
}

export function staleSec(): number { return getIntSetting(SETTING_KEYS.staleSec, DEFAULTS.staleSec) }
export function liveSec():  number { return getIntSetting(SETTING_KEYS.liveSec,  DEFAULTS.liveSec) }

export function getBoolSetting(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage?.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
    return fallback
  } catch {
    return fallback
  }
}

export function setBoolSetting(key: string, value: boolean) {
  try { window.localStorage?.setItem(key, value ? '1' : '0') } catch { /* ignore */ }
}

export function dimTerminalAgents(): boolean { return getBoolSetting(SETTING_KEYS.dimTerminal, true) }
export function compactMode():      boolean { return getBoolSetting(SETTING_KEYS.compact,     false) }

export function useSetting<T>(read: () => T): T {
  const [value, setValue] = useState<T>(read)
  useEffect(() => {
    function onChange() { setValue(read()) }
    window.addEventListener('orchestrate-settings-changed', onChange)
    return () => window.removeEventListener('orchestrate-settings-changed', onChange)
  }, [read])
  return value
}
