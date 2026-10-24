import { create } from 'zustand'
import { toast } from '../components/ui/Toast'
import { DEFAULT_LAYOUT, parseLayout, type LayoutItem } from '../features/home/layout'
import { DEFAULT_SPACE_PREFS, parseSpacePrefs } from '../features/spaces/model'
import { SETTING_KEYS, settingsApi } from '../lib/settings'
import { call, isTauri } from '../lib/tauri'
import type { RunReport, Shortcut, Space, SpaceIcon, SpacePrefs } from '../lib/types'

const message = (e: unknown): string => (e instanceof Error ? e.message : 'Unknown error')
const ACTIVE_KEY = 'spaces.active'

/** Used only in a plain browser tab, where there is no database. */
const LOCAL_SPACE: Space = {
  id: 'local',
  name: 'Everyday',
  icon: 'home',
  position: 0,
  layout: null,
  prefs: '{}',
  shortcuts: [],
  createdAt: 0,
}

interface SpacesState {
  spaces: Space[] | null
  activeId: string | null
  error: string | null
  /** Parsed once per change so selectors return stable references. */
  layouts: Record<string, LayoutItem[]>
  prefsById: Record<string, SpacePrefs>
  legacyLayout: string | undefined

  ensureLoaded: () => Promise<void>
  switchTo: (id: string) => Promise<void>
  create: (name: string, icon: SpaceIcon, shortcuts?: Shortcut[]) => Promise<Space | null>
  update: (id: string, name: string, icon: SpaceIcon) => Promise<boolean>
  remove: (id: string) => Promise<void>
  setShortcuts: (id: string, shortcuts: Shortcut[]) => Promise<void>
  setPrefs: (id: string, prefs: SpacePrefs) => void
  setLayout: (id: string, layout: LayoutItem[] | null) => void
}

function derive(spaces: Space[], legacy: string | undefined) {
  const layouts: Record<string, LayoutItem[]> = {}
  const prefsById: Record<string, SpacePrefs> = {}
  spaces.forEach((s, i) => {
    // The first space adopts the dashboard layout saved before Spaces existed.
    const parsed = parseLayout(s.layout ?? undefined) ?? (i === 0 ? parseLayout(legacy) : null)
    if (parsed) layouts[s.id] = parsed
    prefsById[s.id] = parseSpacePrefs(s.prefs)
  })
  return { layouts, prefsById }
}

const timers = new Map<string, number>()
let loading: Promise<void> | null = null

export const useSpaces = create<SpacesState>((set, get) => {
  const apply = (spaces: Space[], activeId?: string | null) => {
    const active = activeId ?? get().activeId
    set({
      spaces,
      activeId: spaces.some((s) => s.id === active) ? active : (spaces[0]?.id ?? null),
      ...derive(spaces, get().legacyLayout),
    })
  }
  const patch = (id: string, change: Partial<Space>) =>
    apply((get().spaces ?? []).map((s) => (s.id === id ? { ...s, ...change } : s)))

  return {
    spaces: null,
    activeId: null,
    error: null,
    layouts: {},
    prefsById: {},
    legacyLayout: undefined,

    ensureLoaded: async () => {
      if (get().spaces !== null) return
      loading ??= (async () => {
        try {
          const all = await settingsApi.getAll()
          set({ legacyLayout: all[SETTING_KEYS.dashboardLayout] })
          const spaces = isTauri() ? await call<Space[]>('spaces_list') : [LOCAL_SPACE]
          apply(spaces, all[ACTIVE_KEY] ?? null)
        } catch (e) {
          set({ error: message(e) })
          apply([LOCAL_SPACE])
        } finally {
          loading = null
        }
      })()
      await loading
    },

    switchTo: async (id) => {
      const { activeId, spaces } = get()
      if (id === activeId || !spaces?.some((s) => s.id === id)) return
      set({ activeId: id })
      settingsApi.set(ACTIVE_KEY, id).catch(() => undefined)
      if (!isTauri()) return
      try {
        const reports = await call<RunReport[]>('automation_run_for_space', { spaceId: id })
        for (const r of reports) {
          const failed = r.results.filter((x) => !x.ok)
          if (failed.length === 0) toast.success(`${r.name} ran`, `${r.results.length} ${r.results.length === 1 ? 'action' : 'actions'} completed`)
          else toast.error(`${r.name}: ${failed.length} of ${r.results.length} actions failed`, failed[0]?.detail ?? undefined)
        }
      } catch (e) {
        toast.error('Automations could not run', message(e))
      }
    },

    create: async (name, icon, shortcuts = []) => {
      try {
        const space = isTauri()
          ? await call<Space>('space_create', { name, icon, shortcuts })
          : { ...LOCAL_SPACE, id: `local-${Date.now()}`, name: name.trim(), icon, position: (get().spaces?.length ?? 0), shortcuts }
        apply([...(get().spaces ?? []), space], space.id)
        settingsApi.set(ACTIVE_KEY, space.id).catch(() => undefined)
        return space
      } catch (e) {
        toast.error('Could not create the space', message(e))
        return null
      }
    },

    update: async (id, name, icon) => {
      try {
        const space = isTauri() ? await call<Space>('space_update', { id, name, icon }) : { ...(get().spaces ?? []).find((s) => s.id === id)!, name: name.trim(), icon }
        patch(id, { name: space.name, icon: space.icon })
        return true
      } catch (e) {
        toast.error('Could not rename the space', message(e))
        return false
      }
    },

    remove: async (id) => {
      const before = get().spaces ?? []
      try {
        if (isTauri()) await call<void>('space_delete', { id })
        else if (before.length <= 1) throw new Error('Keep at least one space.')
        const next = before.filter((s) => s.id !== id)
        const fallback = get().activeId === id ? (next[0]?.id ?? null) : get().activeId
        apply(next, fallback)
        if (fallback && fallback !== get().activeId) settingsApi.set(ACTIVE_KEY, fallback).catch(() => undefined)
      } catch (e) {
        toast.error('Could not delete the space', message(e))
      }
    },

    setShortcuts: async (id, shortcuts) => {
      const before = (get().spaces ?? []).find((s) => s.id === id)?.shortcuts ?? []
      patch(id, { shortcuts })
      try {
        if (isTauri()) await call<void>('space_set_shortcuts', { id, shortcuts })
      } catch (e) {
        patch(id, { shortcuts: before })
        toast.error('Could not save shortcuts', message(e))
      }
    },

    setPrefs: (id, prefs) => {
      const json = JSON.stringify(prefs)
      patch(id, { prefs: json })
      if (isTauri()) {
        call<void>('space_set_prefs', { id, prefs: json }).catch((e: unknown) => toast.error('Could not save preferences', message(e)))
      }
    },

    setLayout: (id, layout) => {
      const json = layout ? JSON.stringify(layout) : null
      // Reset must also beat the legacy layout, so an explicit "null" is remembered as an empty override.
      if (layout === null && get().spaces?.[0]?.id === id) set({ legacyLayout: undefined })
      patch(id, { layout: json })
      window.clearTimeout(timers.get(id))
      timers.set(
        id,
        window.setTimeout(() => {
          const save = isTauri()
            ? call<void>('space_set_layout', { id, layout: json })
            : json
              ? settingsApi.set(SETTING_KEYS.dashboardLayout, json)
              : settingsApi.remove(SETTING_KEYS.dashboardLayout)
          save.catch((e: unknown) => toast.error('Could not save the layout', message(e)))
        }, 300),
      )
    },
  }
})

export const selectActiveSpace = (s: SpacesState): Space | null =>
  s.spaces?.find((x) => x.id === s.activeId) ?? null

export const selectLayout = (s: SpacesState): LayoutItem[] =>
  (s.activeId ? s.layouts[s.activeId] : undefined) ?? DEFAULT_LAYOUT

export const selectSpacePrefs = (s: SpacesState): SpacePrefs =>
  (s.activeId ? s.prefsById[s.activeId] : undefined) ?? DEFAULT_SPACE_PREFS
