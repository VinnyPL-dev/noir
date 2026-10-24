import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { DUR, tween } from '../../lib/motion'

type Side = 'top' | 'bottom' | 'right'

interface TooltipProps {
  content: ReactNode
  side?: Side
  delay?: number
  disabled?: boolean
  /** Stretch the wrapper to its container's full width (for list/nav rows). */
  block?: boolean
  children: ReactNode
}

const TRANSLATE: Record<Side, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  right: 'translate(0, -50%)',
}

/** Portal-based so it is never clipped by overflow-hidden ancestors. */
export function Tooltip({ content, side = 'top', delay = 400, disabled, block, children }: TooltipProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const show = () => {
    if (disabled) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      if (side === 'right') setPos({ x: r.right + 10, y: r.top + r.height / 2 })
      else if (side === 'bottom') setPos({ x: r.left + r.width / 2, y: r.bottom + 8 })
      else setPos({ x: r.left + r.width / 2, y: r.top - 8 })
    }, delay)
  }

  const hide = () => {
    window.clearTimeout(timer.current)
    setPos(null)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <span
      ref={ref}
      className={block ? 'flex w-full' : 'inline-flex'}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={hide}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {pos && !disabled && (
            <div
              className="pointer-events-none fixed z-[90]"
              style={{ left: pos.x, top: pos.y, transform: TRANSLATE[side] }}
            >
              <motion.div
                role="tooltip"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1, transition: tween(DUR.fast) }}
                exit={{ opacity: 0, transition: tween(DUR.fast) }}
                className="whitespace-nowrap rounded-md border border-noir-line bg-noir-graphite px-2 py-1 text-[11.5px] font-medium text-noir-paper shadow-float"
              >
                {content}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  )
}
