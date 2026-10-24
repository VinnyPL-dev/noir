import { useEffect } from 'react'
import { toast } from '../../components/ui/Toast'
import { isTauri } from '../../lib/tauri'
import { remainingSecs, useTimer } from '../../store/timer'
import { useFlow } from '../../store/flow'

/**
 * Mounted once for the whole app. Restores a timer that was running when NOIR
 * closed, and finishes countdowns even while another page is open.
 */
export function TimerWatcher() {
  const active = useTimer((s) => s.active)

  useEffect(() => {
    if (!isTauri()) return
    void useFlow.getState().load().then(() => useTimer.getState().restore())
  }, [])

  useEffect(() => {
    if (!active || active.mode !== 'countdown') return
    const check = () => {
      if (remainingSecs(active, Date.now()) === 0) {
        toast.success('Timer finished', active.label || `${Math.round(active.totalSecs / 60)} minutes`)
        void useTimer.getState().stop()
      }
    }
    check()
    const id = window.setInterval(check, 1000)
    return () => window.clearInterval(id)
  }, [active])

  return null
}
