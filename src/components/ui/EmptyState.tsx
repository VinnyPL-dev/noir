import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge } from './Card'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /** e.g. "Phase 3" — marks functionality that is intentionally not built yet. */
  badge?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({ icon: Icon, title, description, badge, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2.5 py-6' : 'gap-4 py-16',
        className,
      )}
    >
      <div
        className={cn(
          'grid place-items-center rounded-ctl border border-dashed border-noir-line text-noir-silver',
          compact ? 'size-10' : 'size-14',
        )}
      >
        <Icon className={compact ? 'size-4' : 'size-6'} strokeWidth={1.5} aria-hidden />
      </div>
      <div className="max-w-[340px] space-y-1">
        <div className="flex items-center justify-center gap-2">
          <p className="text-[13px] font-medium text-noir-paper">{title}</p>
          {badge && <Badge>{badge}</Badge>}
        </div>
        <p className="text-[12px] leading-[18px] text-noir-silver">{description}</p>
      </div>
      {action}
    </div>
  )
}
