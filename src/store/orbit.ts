import { create } from 'zustand'
import { toast } from '../components/ui/Toast'
import { call, isTauri } from '../lib/tauri'
import type { AppCategory, AppRecord } from '../lib/types'

const message = (e: unknown): string => (e instanceof Error ? e.message : 'Unknown error')

interface OrbitState {
  /** `null` until the first load finishes. */
  apps: AppRecord[] | null
  scanning: boolean
  error: string | null

  /** Loads the saved app index. With `autoScan`, scans Windows once if the index is empty. */
  ensureLoaded: (autoScan?: boolean) => Promise<void>
  scan: () => Promise<void>
  launch: (app: AppRecord) => Promise<void>
  setFavorite: (id: string, favorite: boolean) => Promise<void>
  setHidden: (id: string, hidden: boolean) => Promise<void>
  setCategory: (id: string, category: AppCategory) => Promise<void>
  setIcon: (id: string, icon: string | null) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  addCustom: (path: string, name: string | undefined, category: AppCategory) => Promise<boolean>
  remove: (id: string) => Promise<void>
}

const byName = (a: AppRecord, b: AppRecord) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

let loading: Promise<void> | null = null

export const useOrbit = create<OrbitState>((set, get) => {
  /** Optimistic local change; returns a function that restores the previous state. */
  const patch = (id: string, change: Partial<AppRecord>): (() => void) => {
    const before = get().apps
    set((s) => ({ apps: s.apps?.map((a) => (a.id === id ? { ...a, ...change } : a)) ?? null }))
    return () => set({ apps: before })
  }

  const mutate = async (id: string, change: Partial<AppRecord>, command: string, args: Record<string, unknown>) => {
    const undo = patch(id, change)
    try {
      await call<void>(command, { id, ...args })
    } catch (e) {
      undo()
      toast.error('Could not save that change', message(e))
    }
  }

  return {
    apps: null,
    scanning: false,
    error: null,

    ensureLoaded: async (autoScan = false) => {
      if (!isTauri()) return
      if (get().apps === null) {
        loading ??= (async () => {
          try {
            set({ apps: await call<AppRecord[]>('orbit_list'), error: null })
          } catch (e) {
            set({ apps: [], error: message(e) })
          } finally {
            loading = null
          }
        })()
        await loading
      }
      if (autoScan && get().apps?.length === 0 && !get().scanning && !get().error) await get().scan()
    },

    scan: async () => {
      if (get().scanning) return
      set({ scanning: true, error: null })
      try {
        const apps = await call<AppRecord[]>('orbit_scan')
        set({ apps, scanning: false })
      } catch (e) {
        set({ scanning: false, error: message(e), apps: get().apps ?? [] })
      }
    },

    launch: async (app) => {
      try {
        await call<void>('orbit_launch', { id: app.id })
        patch(app.id, { launchCount: app.launchCount + 1, lastLaunched: Date.now() })
        toast.show(`Launching ${app.name}`)
      } catch (e) {
        toast.error(`Could not launch ${app.name}`, message(e))
      }
    },

    setFavorite: (id, favorite) => mutate(id, { favorite }, 'orbit_set_favorite', { favorite }),
    setHidden: (id, hidden) => mutate(id, { hidden }, 'orbit_set_hidden', { hidden }),
    setCategory: (id, category) => mutate(id, { category, categoryLocked: true }, 'orbit_set_category', { category }),
    setIcon: (id, icon) => mutate(id, { icon }, 'orbit_set_icon', { icon }),
    rename: (id, name) => mutate(id, { name: name.trim() }, 'orbit_rename', { name }),

    addCustom: async (path, name, category) => {
      try {
        const app = await call<AppRecord>('orbit_add_custom', { path, name: name?.trim() || null, category })
        set((s) => ({ apps: [...(s.apps ?? []), app].sort(byName) }))
        toast.success(`${app.name} added to Orbit`)
        return true
      } catch (e) {
        toast.error('Could not add that program', message(e))
        return false
      }
    },

    remove: async (id) => {
      const before = get().apps
      set({ apps: before?.filter((a) => a.id !== id) ?? null })
      try {
        await call<void>('orbit_remove', { id })
      } catch (e) {
        set({ apps: before })
        toast.error('Could not remove that app', message(e))
      }
    },
  }
})
