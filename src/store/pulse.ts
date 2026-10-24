import { create } from 'zustand'
import { call, isTauri } from '../lib/tauri'
import type { PulseSnapshot } from '../lib/types'

/** Samples are 2 s apart, so 60 samples = the last two minutes. */
export const PULSE_HISTORY = 60
const INTERVAL_MS = 2000

interface PulseState {
  data: PulseSnapshot | null
  error: string | null
  gpuHistory: number[]
  diskReadHistory: number[]
  diskWriteHistory: number[]
  /**
   * Starts polling while at least one consumer is mounted. `full` consumers
   * (the Pulse page) also get the process list; light ones (the Home widget)
   * only need GPU data, so the costly process scan is skipped. Returns a release function.
   */
  acquire: (full: boolean) => () => void
}

const push = (arr: number[], value: number): number[] =>
  arr.length >= PULSE_HISTORY ? [...arr.slice(arr.length - PULSE_HISTORY + 1), value] : [...arr, value]

export const usePulse = create<PulseState>((set) => {
  let full = 0
  let light = 0
  let timer: number | undefined
  let inflight = false

  const tick = async () => {
    if (inflight || document.hidden || full + light === 0) return
    inflight = true
    try {
      const data = await call<PulseSnapshot>('get_pulse', { includeProcesses: full > 0 })
      const gpuLoad = data.gpu.gpus.reduce<number | null>(
        (max, g) => (g.usage === null ? max : max === null ? g.usage : Math.max(max, g.usage)),
        null,
      )
      set((s) => ({
        data,
        error: null,
        // Only real samples are charted; a missing reading adds nothing.
        gpuHistory: gpuLoad === null ? s.gpuHistory : push(s.gpuHistory, gpuLoad),
        diskReadHistory: data.diskReadPerSec === null ? s.diskReadHistory : push(s.diskReadHistory, data.diskReadPerSec),
        diskWriteHistory: data.diskWritePerSec === null ? s.diskWriteHistory : push(s.diskWriteHistory, data.diskWritePerSec),
      }))
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      inflight = false
    }
  }

  const ensureTimer = () => {
    if (timer === undefined && full + light > 0) {
      void tick()
      timer = window.setInterval(() => void tick(), INTERVAL_MS)
    } else if (timer !== undefined && full + light === 0) {
      window.clearInterval(timer)
      timer = undefined
    }
  }

  return {
    data: null,
    error: null,
    gpuHistory: [],
    diskReadHistory: [],
    diskWriteHistory: [],
    acquire: (isFull) => {
      if (!isTauri()) return () => undefined
      if (isFull) full += 1
      else light += 1
      ensureTimer()
      let released = false
      return () => {
        if (released) return
        released = true
        if (isFull) full -= 1
        else light -= 1
        ensureTimer()
      }
    },
  }
})
