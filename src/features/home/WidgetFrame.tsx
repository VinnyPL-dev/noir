import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useContextMenu, type MenuItem } from '../../components/ui/Menu'
import { Tabs } from '../../components/ui/Tabs'
import { Tooltip } from '../../components/ui/Tooltip'
import { cn } from '../../lib/cn'
import { DUR, SPRING, tween } from '../../lib/motion'
import { SIZE_LABEL, type LayoutItem, type WidgetSize } from './layout'
import type { WidgetMeta } from './registry'

const SIZE_SHORT: Record<WidgetSize, string> = { sm: 'S', md: 'M', lg: 'L', full: 'XL' }

interface WidgetFrameProps {
  item: LayoutItem
  meta: WidgetMeta
  span: number
  index: number
  count: number
  editing: boolean
  onMove: (delta: -1 | 1) => void
  onResize: (size: WidgetSize) => void
  onRemove: () => void
  onCustomize: () => void
  children: ReactNode
}

export function WidgetFrame({
  item,
  meta,
  span,
  index,
  count,
  editing,
  onMove,
  onResize,
  onRemove,
  onCustomize,
  children,
}: WidgetFrameProps) {
  const menuItems: MenuItem[] = [
    ...(!editing ? [{ id: 'customize', label: 'Customize dashboard', onSelect: onCustomize }] : []),
    ...meta.sizes.map((size, i) => ({
      id: `size-${size}`,
      label: SIZE_LABEL[size],
      active: item.size === size,
      separatorBefore: i === 0 && !editing,
      onSelect: () => onResize(size),
    })),
    { id: 'left', label: 'Move earlier', icon: <ChevronLeft className="size-4" />, disabled: index === 0, separatorBefore: true, onSelect: () => onMove(-1) },
    { id: 'right', label: 'Move later', icon: <ChevronRight className="size-4" />, disabled: index === count - 1, onSelect: () => onMove(1) },
    { id: 'remove', label: 'Remove widget', icon: <Trash2 className="size-4" />, separatorBefore: true, onSelect: onRemove },
  ]
  const { onContextMenu, menu } = useContextMenu(menuItems)

  return (
    <motion.section
      layout
      transition={SPRING}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1, transition: tween(DUR.slow) }}
      exit={{ opacity: 0, scale: 0.97, transition: tween(DUR.fast) }}
      aria-label={meta.title}
      onContextMenu={onContextMenu}
      // borderRadius lives in `style` so motion can correct it during layout animations.
      style={{ gridColumn: `span ${span} / span ${span}`, borderRadius: 14 }}
      className={cn(
        'nis-card relative min-w-0 transition-colors duration-base ease-noir',
        editing ? 'border-dashed !border-noir-ash/60' : 'hover:border-[#3d3d3d]',
      )}
    >
      {children}

      {editing && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, transition: tween(DUR.base) }}
          className="absolute -top-4 right-3 z-10 flex items-center gap-0.5 rounded-ctl border border-noir-line bg-noir-graphite p-0.5 shadow-float"
        >
          <Tooltip content="Move earlier" side="bottom">
            <Button variant="ghost" size="sm" iconOnly aria-label={`Move ${meta.title} earlier`} disabled={index === 0} onClick={() => onMove(-1)} icon={<ChevronLeft className="size-4" />} className="!size-7" />
          </Tooltip>
          <Tooltip content="Move later" side="bottom">
            <Button variant="ghost" size="sm" iconOnly aria-label={`Move ${meta.title} later`} disabled={index === count - 1} onClick={() => onMove(1)} icon={<ChevronRight className="size-4" />} className="!size-7" />
          </Tooltip>
          <span className="mx-0.5 h-4 w-px bg-noir-line" />
          <Tabs
            mode="radio"
            size="sm"
            label={`${meta.title} size`}
            value={item.size}
            onChange={onResize}
            options={meta.sizes.map((s) => ({ value: s, label: SIZE_SHORT[s], ariaLabel: SIZE_LABEL[s] }))}
            className="!border-0 !bg-transparent !p-0"
          />
          <span className="mx-0.5 h-4 w-px bg-noir-line" />
          <Tooltip content="Remove widget" side="bottom">
            <Button variant="ghost" size="sm" iconOnly aria-label={`Remove ${meta.title}`} onClick={onRemove} icon={<X className="size-4" />} className="!size-7" />
          </Tooltip>
        </motion.div>
      )}
      {menu}
    </motion.section>
  )
}
