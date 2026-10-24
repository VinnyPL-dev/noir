import type { ReactNode } from 'react'
import { NAV_BY_ID, indexLabel, type RouteId } from '../../lib/nav'

interface PageHeaderProps {
  route: RouteId
  description?: string
  actions?: ReactNode
}

export function PageHeader({ route, description, actions }: PageHeaderProps) {
  const item = NAV_BY_ID[route]
  return (
    <header className="flex items-end justify-between gap-6 pb-7">
      <div className="min-w-0">
        <p className="nis-label">
          {indexLabel(route)} <span className="mx-1.5 text-noir-ash">—</span> {item.descriptor}
        </p>
        <h1 className="mt-2.5 text-[30px] font-semibold leading-9 tracking-tight text-noir-white">{item.label}</h1>
        {description && <p className="mt-1.5 max-w-[56ch] text-[13px] leading-5 text-noir-silver">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1200px] px-8 pb-10 pt-8">{children}</div>
}
