import { useMemo, useState } from 'react'
import { ListTree, SearchX } from 'lucide-react'
import { Badge } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchField } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs } from '../../components/ui/Tabs'
import { formatBytes } from '../../lib/format'
import type { ProcessGroup } from '../../lib/types'
import { usePulse } from '../../store/pulse'
import { Section } from './parts'

type SortKey = 'cpu' | 'memory'
const COLLAPSED = 12

export function ProcessTable() {
  const processes = usePulse((s) => s.data?.processes ?? null)
  const count = usePulse((s) => s.data?.processCount ?? 0)
  const [sort, setSort] = useState<SortKey>('cpu')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)

  const rows: ProcessGroup[] = useMemo(() => {
    if (!processes) return []
    const q = query.trim().toLowerCase()
    const filtered = q ? processes.filter((p) => p.name.toLowerCase().includes(q)) : processes
    return [...filtered].sort((a, b) => (sort === 'cpu' ? b.cpu - a.cpu || b.memory - a.memory : b.memory - a.memory))
  }, [processes, query, sort])

  const shown = expanded || query ? rows : rows.slice(0, COLLAPSED)
  const maxMem = rows.reduce((m, p) => Math.max(m, p.memory), 1)

  return (
    <Section
      icon={ListTree}
      title="Running processes"
      right={<Badge>{processes ? `${count} running` : '—'}</Badge>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter processes"
            aria-label="Filter processes"
          />
        </div>
        <Tabs
          label="Sort processes by"
          mode="radio"
          size="sm"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'cpu', label: 'CPU' },
            { value: 'memory', label: 'Memory' },
          ]}
        />
      </div>

      {processes === null ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState compact icon={SearchX} title="No matching processes" description="Try a different name." />
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_72px_132px] gap-x-4 border-b border-noir-line/60 pb-2">
            <span className="nis-label">Name</span>
            <span className="nis-label text-right">CPU</span>
            <span className="nis-label text-right">Memory</span>
          </div>
          <ul>
            {shown.map((p) => (
              <li
                key={p.name.toLowerCase()}
                className="grid grid-cols-[minmax(0,1fr)_72px_132px] items-center gap-x-4 border-b border-noir-line/30 py-2 last:border-0"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] text-noir-paper">{p.name}</span>
                  {p.count > 1 && <span className="shrink-0 font-mono text-[10px] text-noir-ash">×{p.count}</span>}
                </span>
                <span className="text-right font-mono text-[12px] text-noir-mist">{p.cpu.toFixed(1)}%</span>
                <span className="flex items-center justify-end gap-2.5">
                  <span className="h-[3px] w-12 overflow-hidden rounded-full bg-noir-graphite" aria-hidden>
                    <span
                      className="block h-full origin-left rounded-full bg-noir-mist"
                      style={{ transform: `scaleX(${Math.min(1, p.memory / maxMem)})` }}
                    />
                  </span>
                  <span className="w-[64px] text-right font-mono text-[12px] text-noir-mist">{formatBytes(p.memory)}</span>
                </span>
              </li>
            ))}
          </ul>
          {!query && rows.length > COLLAPSED && (
            <div className="mt-3 flex justify-center">
              <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Show fewer' : `Show ${rows.length - COLLAPSED} more`}
              </Button>
            </div>
          )}
        </>
      )}
    </Section>
  )
}
