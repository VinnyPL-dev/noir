import { useLayoutEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { EASE } from '../../lib/motion'

interface AnimatedNumberProps {
  value: number
  decimals?: number
  suffix?: string
  className?: string
}

/**
 * Tweens between values by writing straight to the DOM node, so a live
 * statistic updating every second causes zero React re-renders in its subtree.
 */
export function AnimatedNumber({ value, decimals = 0, suffix = '', className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(value)
  const reduced = useReducedMotion()

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const write = (v: number) => {
      node.textContent = `${v.toFixed(decimals)}${suffix}`
    }
    if (reduced) {
      shown.current = value
      write(value)
      return
    }
    const controls = animate(shown.current, value, {
      duration: 0.45,
      ease: EASE,
      onUpdate: (v) => {
        shown.current = v
        write(v)
      },
    })
    return () => controls.stop()
  }, [value, decimals, suffix, reduced])

  return <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }} />
}
