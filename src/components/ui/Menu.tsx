import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { popVariants } from '../../lib/motion'
import { Kbd } from './Card'

export interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  shortcut?: string
  disabled?: boolean
  /** Shows a check mark (for choosing one of several values). */
  active?: boolean
  separatorBefore?: boolean
  onSelect: () => void
}

interface Point {
  x: number
  y: number
}

interface FloatingMenuProps {
  items: readonly MenuItem[]
  point: Point
  /** Align the menu's right edge to `point.x` instead of its left edge. */
  alignRight?: boolean
  onClose: () => void
}

function FloatingMenu({ items, point, alignRight, onClose }: FloatingMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Measure with offset sizes (unaffected by the entrance scale) and keep on-screen.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { offsetWidth: w, offsetHeight: h } = el
    let left = alignRight ? point.x - w : point.x
    let top = point.y
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8)
    setPos({ left, top })
  }, [point, alignRight])

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        buttons[(index + 1) % buttons.length]?.focus()
        break
      case 'ArrowUp':
        e.preventDefault()
        buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
        break
      case 'Home':
        e.preventDefault()
        buttons[0]?.focus()
        break
      case 'End':
        e.preventDefault()
        buttons[buttons.length - 1]?.focus()
        break
      case 'Escape':
      case 'Tab':
        e.preventDefault()
        e.stopPropagation()
        onClose()
        break
    }
  }

  return createPortal(
    <motion.div
      ref={ref}
      role="menu"
      variants={popVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: pos?.left ?? point.x,
        top: pos?.top ?? point.y,
        visibility: pos ? 'visible' : 'hidden',
        transformOrigin: alignRight ? 'top right' : 'top left',
      }}
      className="z-[85] min-w-[200px] rounded-ctl border border-noir-line bg-noir-graphite p-1 shadow-float"
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore && <div role="separator" className="my-1 h-px bg-noir-line" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
            className={cn(
              'flex h-8 w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[12.5px] text-noir-paper',
              'transition-colors duration-fast ease-noir hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none',
              'disabled:pointer-events-none disabled:text-noir-ash',
            )}
          >
            <span className="grid size-4 shrink-0 place-items-center text-noir-mist">{item.icon}</span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.active && <Check className="size-3.5 text-noir-white" aria-hidden />}
            {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
          </button>
        </div>
      ))}
    </motion.div>,
    document.body,
  )
}

/** Right-click menu. Render `menu` inside the component that owns the target. */
export function useContextMenu(items: readonly MenuItem[]) {
  const [point, setPoint] = useState<Point | null>(null)
  const close = useCallback(() => setPoint(null), [])
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPoint({ x: e.clientX, y: e.clientY })
  }, [])

  const menu = (
    <AnimatePresence>
      {point && <FloatingMenu items={items} point={point} onClose={close} />}
    </AnimatePresence>
  )
  return { onContextMenu, menu }
}

interface DropdownProps {
  items: readonly MenuItem[]
  align?: 'start' | 'end'
  trigger: (api: {
    open: boolean
    toggle: () => void
    ref: RefObject<HTMLButtonElement>
  }) => ReactNode
}

export function Dropdown({ items, align = 'start', trigger }: DropdownProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [point, setPoint] = useState<Point | null>(null)
  const close = useCallback(() => setPoint(null), [])

  const toggle = () => {
    if (point) return close()
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPoint({ x: align === 'end' ? r.right : r.left, y: r.bottom + 6 })
  }

  return (
    <>
      {trigger({ open: point !== null, toggle, ref })}
      <AnimatePresence>
        {point && <FloatingMenu items={items} point={point} alignRight={align === 'end'} onClose={close} />}
      </AnimatePresence>
    </>
  )
}
