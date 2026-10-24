import { call, isTauri } from './tauri'

/**
 * Persistence gateway. In the desktop app everything goes to SQLite through
 * Rust commands. In a plain browser tab (UI-only development) it falls back to
 * localStorage so the interface still works — this is never used in the app.
 */
const LS_KEY = 'noir:settings'

function readLocal(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export const settingsApi = {
  async getAll(): Promise<Record<string, string>> {
    if (isTauri()) return call<Record<string, string>>('settings_get_all')
    return readLocal()
  },

  async set(key: string, value: string): Promise<void> {
    if (isTauri()) return call<void>('settings_set', { key, value })
    localStorage.setItem(LS_KEY, JSON.stringify({ ...readLocal(), [key]: value }))
  },

  async remove(key: string): Promise<void> {
    if (isTauri()) return call<void>('settings_delete', { key })
    const all = readLocal()
    delete all[key]
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  },
}

export const SETTING_KEYS = {
  displayName: 'profile.displayName',
  sidebarCollapsed: 'ui.sidebarCollapsed',
  motion: 'ui.motion',
  dashboardLayout: 'dashboard.layout.v1',
} as const
