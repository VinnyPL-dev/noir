import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Restrained border-contrast change on hover (for clickable cards). */
  interactive?: boolean
}

export function Card({ interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'nis-card transition-colors duration-base ease-noir',
        interactive && 'hover:border-[#4a4a4a]',
        className,
      )}
      {...rest}
    />
  )
}

interface CardHeaderProps {
  icon?: LucideIcon
  title: string
  right?: ReactNode
  className?: string
}

/** Standard card header: tiny icon + tracked mono label + optional trailing slot. */
export function CardHeader({ icon: Icon, title, right, className }: CardHeaderProps) {
  return (
    <div className={cn('flex h-5 items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2 text-noir-silver">
        {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}
        <h2 className="nis-label truncate">{title}</h2>
      </div>
      {right}
    </div>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center rounded-full border border-noir-line px-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-noir-silver',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-noir-line bg-noir-obsidian px-1 font-mono text-[10px] text-noir-mist">
      {children}
    </kbd>
  )
}
