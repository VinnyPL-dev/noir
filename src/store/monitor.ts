import { create } from 'zustand'
import { call, isTauri } from '../lib/tauri'
import type { DiskInfo, SessionInfo, Snapshot, SystemInfo } from '../lib/types'
import { percent } from '../lib/format'

/** 60 samples at 1 Hz = the last minute. */
export const HISTORY = 60

export type MonitorStatus = 'starting' | 'live' | 'error' | 'unavailable'

interface MonitorState {
  status: MonitorStatus
  error: string | null
  info: SystemInfo | null
  session: SessionInfo | null
  snapshot: Snapshot | null
  storage: DiskInfo[] | null
  cpuHistory: number[]
  memHistory: number[]
  rxHistory: number[]
  txHistory: number[]

  /** Begins polling the native layer. Returns a cleanup function. */
  start: () => () => void
  retry: () => void
}

const push = (arr: number[], value: number): number[] =>
  arr.length >= HISTORY ? [...arr.slice(arr.length - HISTORY + 1), value] : [...arr, value]

const message = (e: unknown): string => (e instanceof Error ? e.message : 'Unknown error')

export const useMonitor = create<MonitorState>((set, get) => {
  let stop: (() => void) | null = null

  return {
    status: 'starting',
    error: null,
    info: null,
    session: null,
    snapshot: null,
    storage: null,
    cpuHistory: [],
    memHistory: [],
    rxHistory: [],
    txHistory: [],

    start: () => {
      stop?.()

      if (!isTauri()) {
        set({ status: 'unavailable' })
        stop = null
        return () => undefined
      }

      let alive = true
      let inflight = false

      const tick = async () => {
        if (!alive || inflight || document.hidden) return
        inflight = true
        try {
          const s = await call<Snapshot>('get_snapshot')
          if (!alive) return
          set((st) => ({
            snapshot: s,
            status: 'live',
            error: null,
            cpuHistory: push(st.cpuHistory, s.cpuUsage),
            memHistory: push(st.memHistory, percent(s.memoryUsed, s.memoryTotal)),
            rxHistory: push(st.rxHistory, s.rxPerSec),
            txHistory: push(st.txHistory, s.txPerSec),
          }))
        } catch (e) {
          if (alive) set({ status: 'error', error: message(e) })
        } finally {
          inflight = false
        }
      }

      const loadStorage = async () => {
        try {
          const disks = await call<DiskInfo[]>('get_storage')
          if (alive) set({ storage: disks })
        } catch (e) {
          if (alive && get().storage === null) set({ storage: [], error: message(e) })
        }
      }

      void (async () => {
        const [info, session] = await Promise.allSettled([
          call<SystemInfo>('get_system_info'),
          call<SessionInfo>('get_session_info'),
        ])
        if (!alive) return
        set({
          info: info.status === 'fulfilled' ? info.value : null,
          session: session.status === 'fulfilled' ? session.value : null,
        })
      })()

      void tick()
      void loadStorage()
      const fast = window.setInterval(() => void tick(), 1000)
      const slow = window.setInterval(() => void loadStorage(), 30_000)
      const onVisible = () => {
        if (!document.hidden) void tick()
      }
      document.addEventListener('visibilitychange', onVisible)

      stop = () => {
        alive = false
        window.clearInterval(fast)
        window.clearInterval(slow)
        document.removeEventListener('visibilitychange', onVisible)
      }
      return stop
    },

    retry: () => {
      set({ status: 'starting', error: null })
      get().start()
    },
  }
})
