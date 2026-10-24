import { useEffect, useMemo } from 'react'
import { AppWindow, Orbit, Star } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { CardHeader } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { formatAgo } from '../../../lib/format'
import type { AppRecord } from '../../../lib/types'
import { iconFor } from '../../orbit/icons'
import { useMonitor } from '../../../store/monitor'
import { useNav } from '../../../store/nav'
import { useOrbit } from '../../../store/orbit'

function useApps() {
  const status = useMonitor((s) => s.status)
  const apps = useOrbit((s) => s.apps)
  useEffect(() => {
    void useOrbit.getState().ensureLoaded(false)
  }, [])
  return { apps, unavailable: status === 'unavailable' }
}

const OpenOrbit = () => (
  <Button size="sm" variant="outline" icon={<Orbit className="size-3.5" />} onClick={() => useNav.getState().go('orbit')}>
    Open Orbit
  </Button>
)

function AppRow({ app, detail }: { app: AppRecord; detail?: string }) {
  const Icon = iconFor(app.icon, app.category)
  return (
    <li>
      <button
        type="button"
        onClick={() => void useOrbit.getState().launch(app)}
        className="flex h-11 w-full items-center gap-3 rounded-ctl px-2.5 text-left transition-colors duration-fast ease-noir hover:bg-white/[0.05] active:bg-white/[0.08]"
        aria-label={`Launch ${app.name}`}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-noir-graphite text-noir-paper">
          <Icon className="size-3.5" strokeWidth={1.6} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-noir-paper">{app.name}</span>
        {detail && <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-noir-silver">{detail}</span>}
      </button>
    </li>
  )
}

function ListSkeleton() {
  return (
    <div className="mt-4 space-y-2.5">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}

export function RecentApps() {
  const { apps, unavailable } = useApps()
  const recent = useMemo(
    () =>
      (apps ?? [])
        .filter((a) => a.lastLaunched !== null && !a.hidden)
        .sort((a, b) => (b.lastLaunched ?? 0) - (a.lastLaunched ?? 0))
        .slice(0, 5),
    [apps],
  )

  return (
    <div className="flex h-full flex-col p-5">
      <CardHeader icon={AppWindow} title="Recently launched" />
      {unavailable ? (
        <EmptyState compact icon={AppWindow} title="Native runtime not detected" description="Launch history lives in the NOIR desktop app." className="flex-1" />
      ) : apps === null ? (
        <ListSkeleton />
      ) : recent.length === 0 ? (
        <EmptyState
          compact
          icon={AppWindow}
          title="Nothing launched yet"
          description="Apps you open through Orbit will appear here."
          action={<OpenOrbit />}
          className="flex-1"
        />
      ) : (
        <ul className="-mx-2 mt-3">
          {recent.map((a) => (
            <AppRow key={a.id} app={a} detail={formatAgo(a.lastLaunched as number)} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function Favorites() {
  const { apps, unavailable } = useApps()
  const favorites = useMemo(() => (apps ?? []).filter((a) => a.favorite && !a.hidden).slice(0, 6), [apps])

  return (
    <div className="flex h-full flex-col p-5">
      <CardHeader icon={Star} title="Favorites" />
      {unavailable ? (
        <EmptyState compact icon={Star} title="Native runtime not detected" description="Favorites live in the NOIR desktop app." className="flex-1" />
      ) : apps === null ? (
        <ListSkeleton />
      ) : favorites.length === 0 ? (
        <EmptyState
          compact
          icon={Star}
          title="No favorites yet"
          description="Star an app in Orbit for one-click access here."
          action={<OpenOrbit />}
          className="flex-1"
        />
      ) : (
        <ul className="-mx-2 mt-3">
          {favorites.map((a) => (
            <AppRow key={a.id} app={a} />
          ))}
        </ul>
      )}
    </div>
  )
}
