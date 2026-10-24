import { create } from 'zustand'
import { toast } from '../components/ui/Toast'
import { settingsApi } from '../lib/settings'
import { useFlow } from './flow'

const KEY = 'flow.timer.v1'

export interface ActiveTimer {
  mode: 'stopwatch' | 'countdown'
  startedAt: number
  /** Countdown length in seconds (ignored for stopwatch). */
  totalSecs: number
  label: string
  projectId: string | null
}

interface TimerState {
  active: ActiveTimer | null
  restored: boolean
  restore: () => Promise<void>
  start: (t: Omit<ActiveTimer, 'startedAt'>) => void
  /** Ends the timer and saves the session (when it lasted at least a second). */
  stop: () => Promise<void>
  discard: () => void
}

const isTimer = (v: unknown): v is ActiveTimer => {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Record<string, unknown>
  return (
    (t.mode === 'stopwatch' || t.mode === 'countdown') &&
    typeof t.startedAt === 'number' &&
    typeof t.totalSecs === 'number' &&
    typeof t.label === 'string' &&
    (t.projectId === null || typeof t.projectId === 'string')
  )
}

const persist = (t: ActiveTimer | null) => {
  const op = t ? settingsApi.set(KEY, JSON.stringify(t)) : settingsApi.remove(KEY)
  op.catch(() => undefined) // a lost timer record is not worth interrupting the user
}

export const elapsedSecs = (t: ActiveTimer, now: number): number => Math.max(0, Math.floor((now - t.startedAt) / 1000))

export const remainingSecs = (t: ActiveTimer, now: number): number => Math.max(0, t.totalSecs - elapsedSecs(t, now))

export const useTimer = create<TimerState>((set, get) => ({
  active: null,
  restored: false,

  restore: async () => {
    if (get().restored) return
    set({ restored: true })
    try {
      const raw = (await settingsApi.getAll())[KEY]
      if (!raw) return
      const parsed: unknown = JSON.parse(raw)
      if (!isTimer(parsed)) return settingsApi.remove(KEY)
      set({ active: parsed })
      // A countdown that ran out while NOIR was closed is recorded as completed.
      if (parsed.mode === 'countdown' && remainingSecs(parsed, Date.now()) === 0) {
        toast.show('Your timer finished while NOIR was closed', parsed.label || undefined)
        await get().stop()
      }
    } catch {
      /* corrupt record: ignore */
    }
  },

  start: (t) => {
    if (get().active) return
    const active: ActiveTimer = { ...t, startedAt: Date.now() }
    set({ active })
    persist(active)
  },

  stop: async () => {
    const t = get().active
    if (!t) return
    set({ active: null })
    persist(null)
    const wall = elapsedSecs(t, Date.now())
    const durationSecs = t.mode === 'countdown' ? Math.min(wall, t.totalSecs) : wall
    if (durationSecs < 1) return
    const saved = await useFlow.getState().addSession({
      label: t.label,
      projectId: t.projectId,
      startedAt: t.startedAt,
      durationSecs,
      kind: t.mode,
    })
    if (saved) toast.success('Session saved', `${Math.max(1, Math.round(durationSecs / 60))} min${t.label ? ` · ${t.label}` : ''}`)
  },

  discard: () => {
    set({ active: null })
    persist(null)
  },
}))
