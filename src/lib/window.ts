import { useCallback, useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from './tauri'

/** Controls for the frameless window. All no-ops outside the desktop runtime. */
export function useWindowControls() {
  const available = isTauri()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!available) return
    const win = getCurrentWindow()
    let alive = true
    let unlisten: (() => void) | undefined
    let timer: number | undefined

    const sync = () => {
      win
        .isMaximized()
        .then((m) => alive && setMaximized(m))
        .catch(() => undefined)
    }
    sync()

    // onResized fires continuously while dragging; debounce the IPC round-trip.
    win
      .onResized(() => {
        window.clearTimeout(timer)
        timer = window.setTimeout(sync, 80)
      })
      .then((fn) => {
        if (alive) unlisten = fn
        else fn()
      })
      .catch(() => undefined)

    return () => {
      alive = false
      window.clearTimeout(timer)
      unlisten?.()
    }
  }, [available])

  const minimize = useCallback(() => void getCurrentWindow().minimize().catch(console.error), [])
  const toggleMaximize = useCallback(() => void getCurrentWindow().toggleMaximize().catch(console.error), [])
  const close = useCallback(() => void getCurrentWindow().close().catch(console.error), [])

  return { available, maximized, minimize, toggleMaximize, close }
}
