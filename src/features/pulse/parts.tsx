import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardHeader } from '../../components/ui/Card'
import { cn } from '../../lib/cn'

/** Headline metric tile: label, big value, one line of context, optional sparkline. */
export function StatTile({
  icon,
  label,
  value,
  unit,
  detail,
  chart,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  unit?: string
  detail: string
  chart?: ReactNode
}) {
  return (
    <Card className="flex min-w-0 flex-col p-5">
      <CardHeader icon={icon} title={label} />
      <p className="mt-4 text-[30px] font-semibold leading-8 tracking-tight text-noir-white">
        {value}
        {unit && <span className="ml-0.5 text-[15px] font-medium text-noir-silver">{unit}</span>}
      </p>
      <p className="mt-2 line-clamp-2 min-h-[36px] text-[12px] leading-[18px] text-noir-silver">{detail}</p>
      <div className="mt-3 h-10">{chart}</div>
    </Card>
  )
}

export function Section({
  icon,
  title,
  right,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  right?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('min-w-0 p-5', className)}>
      <CardHeader icon={icon} title={title} right={right} />
      <div className="mt-5">{children}</div>
    </Card>
  )
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[12px] text-noir-silver">{label}</dt>
      <dd className="truncate font-mono text-[12px] text-noir-paper">{value}</dd>
    </div>
  )
}
