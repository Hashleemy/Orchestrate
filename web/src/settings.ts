export const SETTING_KEYS = {
  staleSec: 'orchestrate.setting.stale_sec',
  liveSec:  'orchestrate.setting.live_sec',
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
