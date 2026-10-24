import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { DUR, tween } from '../../lib/motion'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  width?: number
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, description, children, footer, width = 440 }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  // Focus management: move focus in on open, restore it on close.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const id = window.requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        panel.current?.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    })
    return () => {
      window.cancelAnimationFrame(id)
      previous?.focus?.()
    }
  }, [open])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-6" onKeyDown={onKeyDown}>
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: tween(DUR.base) }}
            exit={{ opacity: 0, transition: tween(DUR.fast) }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: tween(DUR.slow) }}
            exit={{ opacity: 0, y: 4, scale: 0.99, transition: tween(DUR.fast) }}
            style={{ width }}
            className="relative max-w-full rounded-card border border-noir-line bg-noir-charcoal shadow-float"
          >
            <div className="flex items-start justify-between gap-4 p-5 pb-0">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[15px] font-semibold tracking-tight text-noir-white">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1.5 text-[13px] leading-5 text-noir-mist">
                    {description}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" iconOnly aria-label="Close dialog" onClick={onClose} icon={<X className="size-4" />} />
            </div>
            {children && <div className="px-5 pt-4">{children}</div>}
            {footer && <div className="flex justify-end gap-2 p-5">{footer}</div>}
            {!footer && <div className="h-5" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
