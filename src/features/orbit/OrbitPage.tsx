import { useEffect, useMemo, useRef, useState } from 'react'
import { AppWindow, MonitorOff, Orbit, Plus, RefreshCw, SearchX, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { PageContainer, PageHeader } from '../../components/shell/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, Kbd } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchField } from '../../components/ui/Input'
import { Dropdown, type MenuItem } from '../../components/ui/Menu'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs } from '../../components/ui/Tabs'
import { cn } from '../../lib/cn'
import type { AppRecord } from '../../lib/types'
import { useMonitor } from '../../store/monitor'
import { useOrbit } from '../../store/orbit'
import { AddAppModal, EditAppModal } from './AppDialogs'
import { AppTile } from './AppTile'
import { CATEGORIES } from './icons'

type Sort = 'name' | 'used' | 'recent'
const SORT_LABEL: Record<Sort, string> = { name: 'Name', used: 'Most used', recent: 'Recently opened' }

function compare(sort: Sort) {
  return (a: AppRecord, b: AppRecord): number => {
    if (sort === 'used') return b.launchCount - a.launchCount || a.name.localeCompare(b.name)
    if (sort === 'recent') return (b.lastLaunched ?? 0) - (a.lastLaunched ?? 0) || a.name.localeCompare(b.name)
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  }
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3" aria-busy="true" aria-label="Loading applications">
      {Array.from({ length: 12 }, (_, i) => (
        <Skeleton key={i} className="h-[68px] w-full rounded-card" />
      ))}
    </div>
  )
}

export function OrbitPage() {
  const status = useMonitor((s) => s.status)
  const apps = useOrbit((s) => s.apps)
  const scanning = useOrbit((s) => s.scanning)
  const error = useOrbit((s) => s.error)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('name')
  const [showHidden, setShowHidden] = useState(false)
  const [editing, setEditing] = useState<AppRecord | null>(null)
  const [adding, setAdding] = useState(false)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void useOrbit.getState().ensureLoaded(true)
  }, [])

  // "/" jumps to search, like most launchers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && t && !['INPUT', 'TEXTAREA'].includes(t.tagName)) {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visible = useMemo(() => (apps ?? []).filter((a) => showHidden || !a.hidden), [apps, showHidden])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of visible) map.set(a.category, (map.get(a.category) ?? 0) + 1)
    return map
  }, [visible])
  const favoriteCount = useMemo(() => visible.filter((a) => a.favorite).length, [visible])

  // Only offer filters that have something in them.
  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...(favoriteCount > 0 ? [{ value: 'favorites', label: 'Favorites' }] : []),
      ...CATEGORIES.filter((c) => counts.has(c)).map((c) => ({ value: c, label: c })),
    ],
    [counts, favoriteCount],
  )
  const activeFilter = tabs.some((t) => t.value === filter) ? filter : 'all'

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visible
      .filter((a) => (activeFilter === 'all' ? true : activeFilter === 'favorites' ? a.favorite : a.category === activeFilter))
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || compare(sort)(a, b))
  }, [visible, activeFilter, query, sort])

  const viewItems: MenuItem[] = [
    ...(Object.keys(SORT_LABEL) as Sort[]).map((s) => ({
      id: `sort-${s}`,
      label: `Sort: ${SORT_LABEL[s]}`,
      active: sort === s,
      onSelect: () => setSort(s),
    })),
    { id: 'hidden', label: 'Show hidden apps', active: showHidden, separatorBefore: true, onSelect: () => setShowHidden((v) => !v) },
  ]

  const actions = (
    <>
      <Button variant="outline" icon={<RefreshCw className={cn('size-4', scanning && 'animate-spin')} />} onClick={() => void useOrbit.getState().scan()} disabled={scanning}>
        {scanning ? 'Scanning…' : 'Rescan'}
      </Button>
      <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
        Add program
      </Button>
    </>
  )

  if (status === 'unavailable') {
    return (
      <PageContainer>
        <PageHeader route="orbit" description="Every app on this PC, one search away." />
        <Card>
          <EmptyState
            icon={MonitorOff}
            title="Native runtime not detected"
            description="Orbit reads your installed apps through the NOIR desktop app. Start it with npm run tauri dev."
          />
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader route="orbit" description="Every app on this PC, one search away. Launch, favorite and organize them here." actions={actions} />

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-ctl border border-noir-line px-3.5 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-noir-mist" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-noir-paper">Couldn't read your installed apps</p>
            <p className="mt-0.5 text-[12px] leading-[18px] text-noir-silver">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void useOrbit.getState().scan()}>
            Try again
          </Button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <SearchField
            ref={search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search applications"
            aria-label="Search applications"
            hint={<Kbd>/</Kbd>}
          />
        </div>
        <Dropdown
          align="end"
          items={viewItems}
          trigger={({ toggle, ref, open }) => (
            <Button ref={ref} variant="outline" icon={<SlidersHorizontal className="size-4" />} onClick={toggle} aria-expanded={open}>
              View
            </Button>
          )}
        />
      </div>

      {tabs.length > 1 && (
        <div className="-mx-1 mb-5 overflow-x-auto px-1 pb-1">
          <Tabs label="Filter by category" size="sm" value={activeFilter} onChange={setFilter} options={tabs} />
        </div>
      )}

      {apps === null || (scanning && apps.length === 0) ? (
        <GridSkeleton />
      ) : apps.length === 0 ? (
        <Card>
          <EmptyState
            icon={Orbit}
            title="No apps found yet"
            description={error ? 'Fix the problem above, or add a program yourself.' : 'Scan Windows for installed apps, or add a program by hand.'}
            action={
              <div className="flex gap-2">
                <Button variant="primary" icon={<RefreshCw className="size-4" />} onClick={() => void useOrbit.getState().scan()}>
                  Scan this PC
                </Button>
                <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
                  Add program
                </Button>
              </div>
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title={query ? `Nothing matches “${query.trim()}”` : 'Nothing here yet'}
            description={query ? 'Check the spelling, or clear the filter.' : 'Favorite an app to see it here.'}
            action={
              query || activeFilter !== 'all' ? (
                <Button variant="outline" onClick={() => { setQuery(''); setFilter('all') }}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {shown.map((app) => (
              <AppTile key={app.id} app={app} onEdit={setEditing} />
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-noir-ash">
            <AppWindow className="size-3" aria-hidden />
            {shown.length} {shown.length === 1 ? 'app' : 'apps'}
            {scanning && ' · updating…'}
          </p>
        </>
      )}

      <EditAppModal app={editing} onClose={() => setEditing(null)} />
      <AddAppModal open={adding} onClose={() => setAdding(false)} />
    </PageContainer>
  )
}
