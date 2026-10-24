import { cn } from '../../lib/cn'

/** Opacity-only pulse: cheap on the compositor, no moving gradients. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-noir-graphite/70', className)} />
}
