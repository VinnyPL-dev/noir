import { create } from 'zustand'
import { toast } from '../components/ui/Toast'
import { DEFAULT_LAYOUT, parseLayout, type LayoutItem } from '../features/home/layout'
import { SETTING_KEYS, settingsApi } from '../lib/settings'

export type MotionPref = 'system' | 'reduce' | 'full'

interface PrefsState {
  ready: boolean
  displayName: string
  sidebarCollapsed: boolean
  motionPref: MotionPref
  /** `null` = never customised, fall back to DEFAULT_LAYOUT. */
  layout: LayoutItem[] | null

  hydrate: () => Promise<void>
  setDisplayName: (name: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setMotionPref: (pref: MotionPref) => void
  setLayout: (layout: LayoutItem[]) => void
  resetLayout: () => void
}

function persist(key: string, value: string) {
  settingsApi.set(key, value).catch((error: unknown) => {
    toast.error('Could not save your settings', error instanceof Error ? error.message : undefined)
  })
}

let layoutTimer: number | undefined

export const usePrefs = create<PrefsState>((set, get) => ({
  ready: false,
  displayName: '',
  sidebarCollapsed: false,
  motionPref: 'system',
  layout: null,

  hydrate: async () => {
    try {
      const all = await settingsApi.getAll()
      const motion = all[SETTING_KEYS.motion]
      set({
        displayName: all[SETTING_KEYS.displayName] ?? '',
        sidebarCollapsed: all[SETTING_KEYS.sidebarCollapsed] === '1',
        motionPref: motion === 'reduce' || motion === 'full' ? motion : 'system',
        layout: parseLayout(all[SETTING_KEYS.dashboardLayout]),
        ready: true,
      })
    } catch (error) {
      // Never block the app on a storage failure: start with defaults and say so.
      set({ ready: true })
      toast.error(
        'Settings could not be loaded',
        error instanceof Error ? error.message : 'Using defaults for this session.',
      )
    }
  },

  setDisplayName: (name) => {
    const clean = name.trim().slice(0, 40)
    set({ displayName: clean })
    persist(SETTING_KEYS.displayName, clean)
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed })
    persist(SETTING_KEYS.sidebarCollapsed, collapsed ? '1' : '0')
  },

  toggleSidebar: () => get().setSidebarCollapsed(!get().sidebarCollapsed),

  setMotionPref: (pref) => {
    set({ motionPref: pref })
    persist(SETTING_KEYS.motion, pref)
  },

  setLayout: (layout) => {
    set({ layout })
    // Debounced: dragging through several sizes should write once.
    window.clearTimeout(layoutTimer)
    layoutTimer = window.setTimeout(
      () => persist(SETTING_KEYS.dashboardLayout, JSON.stringify(layout)),
      300,
    )
  },

  resetLayout: () => {
    window.clearTimeout(layoutTimer)
    set({ layout: null })
    settingsApi.remove(SETTING_KEYS.dashboardLayout).catch((error: unknown) => {
      toast.error('Could not reset the layout', error instanceof Error ? error.message : undefined)
    })
  },
}))

/** Returns a stable reference (never a new array), which zustand requires for selectors. */
export const selectLayout = (s: PrefsState): LayoutItem[] => s.layout ?? DEFAULT_LAYOUT
