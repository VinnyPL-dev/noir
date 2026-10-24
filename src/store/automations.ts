import { create } from 'zustand'
import { toast } from '../components/ui/Toast'
import { settingsApi } from '../lib/settings'
import { call, isTauri } from '../lib/tauri'
import type { Automation, AutomationAction, AutomationLogEntry, AutomationPermissions, RunReport } from '../lib/types'

const message = (e: unknown): string => (e instanceof Error ? e.message : 'Unknown error')

export const PERMISSION_KEYS = {
  master: 'automations.enabled',
  apps: 'automations.allowApps',
  folders: 'automations.allowFolders',
  urls: 'automations.allowUrls',
} as const

const OFF: AutomationPermissions = { master: false, apps: false, folders: false, urls: false }

interface AutomationsState {
  loaded: boolean
  automations: Automation[]
  permissions: AutomationPermissions
  log: AutomationLogEntry[]

  load: (force?: boolean) => Promise<void>
  setPermission: (key: keyof AutomationPermissions, value: boolean) => Promise<void>
  create: (name: string, spaceId: string, actions: AutomationAction[]) => Promise<boolean>
  update: (id: string, name: string, spaceId: string, actions: AutomationAction[]) => Promise<boolean>
  setEnabled: (id: string, enabled: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
  runNow: (id: string) => Promise<RunReport | null>
  refreshLog: () => Promise<void>
  clearLog: () => Promise<void>
}

let loading: Promise<void> | null = null

export const useAutomations = create<AutomationsState>((set, get) => ({
  loaded: false,
  automations: [],
  permissions: OFF,
  log: [],

  load: async (force = false) => {
    if (!isTauri()) return
    if (get().loaded && !force) return
    loading ??= (async () => {
      try {
        const [automations, permissions, log] = await Promise.all([
          call<Automation[]>('automation_list'),
          call<AutomationPermissions>('automation_permissions'),
          call<AutomationLogEntry[]>('automation_log', { limit: 50 }),
        ])
        set({ automations, permissions, log, loaded: true })
      } catch (e) {
        set({ loaded: true })
        toast.error('Could not load automations', message(e))
      } finally {
        loading = null
      }
    })()
    await loading
  },

  setPermission: async (key, value) => {
    const before = get().permissions
    set({ permissions: { ...before, [key]: value } })
    try {
      await settingsApi.set(PERMISSION_KEYS[key], value ? '1' : '0')
    } catch (e) {
      set({ permissions: before })
      toast.error('Could not save that permission', message(e))
    }
  },

  create: async (name, spaceId, actions) => {
    try {
      const a = await call<Automation>('automation_create', { name, spaceId, actions })
      set((s) => ({ automations: [...s.automations, a] }))
      return true
    } catch (e) {
      toast.error('Could not create the automation', message(e))
      return false
    }
  },

  update: async (id, name, spaceId, actions) => {
    try {
      const a = await call<Automation>('automation_update', { id, name, spaceId, actions })
      set((s) => ({ automations: s.automations.map((x) => (x.id === id ? a : x)) }))
      return true
    } catch (e) {
      toast.error('Could not save the automation', message(e))
      return false
    }
  },

  setEnabled: async (id, enabled) => {
    const before = get().automations
    set({ automations: before.map((a) => (a.id === id ? { ...a, enabled } : a)) })
    try {
      await call<void>('automation_set_enabled', { id, enabled })
    } catch (e) {
      set({ automations: before })
      toast.error('Could not change that automation', message(e))
    }
  },

  remove: async (id) => {
    const before = get().automations
    set({ automations: before.filter((a) => a.id !== id) })
    try {
      await call<void>('automation_delete', { id })
    } catch (e) {
      set({ automations: before })
      toast.error('Could not delete the automation', message(e))
    }
  },

  runNow: async (id) => {
    try {
      const report = await call<RunReport>('automation_run', { id })
      set((s) => ({ automations: s.automations.map((a) => (a.id === id ? { ...a, lastRun: Date.now() } : a)) }))
      void get().refreshLog()
      return report
    } catch (e) {
      toast.error('Could not run the automation', message(e))
      return null
    }
  },

  refreshLog: async () => {
    try {
      set({ log: await call<AutomationLogEntry[]>('automation_log', { limit: 50 }) })
    } catch {
      /* keep the previous log */
    }
  },

  clearLog: async () => {
    const before = get().log
    set({ log: [] })
    try {
      await call<void>('automation_log_clear')
    } catch (e) {
      set({ log: before })
      toast.error('Could not clear the log', message(e))
    }
  },
}))
