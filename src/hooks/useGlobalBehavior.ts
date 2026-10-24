import { useEffect } from 'react'
import { NAV } from '../lib/nav'
import { useNav } from '../store/nav'
import { useCommand } from '../store/command'
import { usePrefs, type MotionPref } from '../store/prefs'
import { useSpaces } from '../store/spaces'

/** Window-level keyboard shortcuts. Ignored while typing in a field. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Alt + 1…9 switches Space, even from a text field (Alt+digit types nothing on Windows).
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) {
        const space = useSpaces.getState().spaces?.[Number(e.code.slice(5)) - 1]
        if (space) {
          e.preventDefault()
          void useSpaces.getState().switchTo(space.id)
        }
        return
      }

      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
      const target = e.target as HTMLElement | null
      const typing = !!target && (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)

      if (e.key === 'b' || e.key === 'k') {
        // These two work while typing, like most apps' sidebar and palette shortcuts.
        e.preventDefault()
        if (e.key === 'b') usePrefs.getState().toggleSidebar()
        else useCommand.getState().toggle()
        return
      }
      if (typing) return

      if (e.key === ',') {
        e.preventDefault()
        useNav.getState().go('settings')
      } else if (/^[1-8]$/.test(e.key)) {
        const item = NAV[Number(e.key) - 1]
        if (item) {
          e.preventDefault()
          useNav.getState().go(item.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** True when animations should be removed, from the user's choice or the OS. */
export function useReducedMotionFlag(pref: MotionPref): boolean {
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      const reduce = pref === 'reduce' || (pref === 'system' && query.matches)
      document.documentElement.dataset.motion = reduce ? 'reduce' : 'full'
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [pref])

  return pref === 'reduce'
}

/** In production builds, suppress the browser's native context menu (except in text fields). */
export function useNativeContextMenuGuard() {
  useEffect(() => {
    if (!import.meta.env.PROD) return
    const onContext = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null
      if (!el?.closest('input, textarea, .selectable')) e.preventDefault()
    }
    window.addEventListener('contextmenu', onContext)
    return () => window.removeEventListener('contextmenu', onContext)
  }, [])
}
