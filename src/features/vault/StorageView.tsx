import { useCallback, useEffect, useState } from 'react'
import { ArrowUp, ChartBar, ExternalLink, File, Folder, TriangleAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/cn'
import { formatBytes, percent } from '../../lib/format'
import { call } from '../../lib/tauri'
import type { Breakdown } from '../../lib/types'
import { useVault } from '../../store/vault'
import { ScopePicker } from './ScopePicker'
import { useVaultUi } from './ui'

/** Parent of a Windows/POSIX path, or null at a root. */
function parentOf(path: string): string | null {
  const trimmed = path.replace(/[\\/]+$/, '')
  const i = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'))
  if (i <= 0) return null
  const parent = trimmed.slice(0, i)
  return /^[A-Za-z]:$/.test(parent) ? `${parent}\\` : parent
}

export function StorageView() {
  const path = useVaultUi((s) => s.storagePath)
  const roots = useVault((s) => s.roots)
  const set = (p: string) => useVaultUi.setState({ storagePath: p })

  const [data, setData] = useState<Breakdown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async (target: string) => {
    setLoading(true)
    setError(null)
    setData(null)
    try {
      setData(await call<Breakdown>('vault_breakdown', { path: target }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not measure this folder')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (path) void run(path)
  }, [path, run])

  // Default to the first location so the tab is useful on first visit.
  useEffect(() => {
    if (!path && roots[0]) set(roots[0].path)
  }, [path, roots])

  const parent = path ? parentOf(path) : null
  const largest = data?.items[0]?.size ?? 0

  return (
    <Card className="p-5">
      <CardHeader icon={ChartBar} title="Storage breakdown" />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ScopePicker label="Folder to analyze" value={path} onChange={set} />
        <Button variant="outline" icon={<ArrowUp className="size-4" />} disabled={!parent || loading} onClick={() => parent && set(parent)}>
          Up
        </Button>
        <Button variant="outline" loading={loading} disabled={!path} onClick={() => path && void run(path)}>
          Re-scan
        </Button>
        {path && (
          <Button variant="ghost" icon={<ExternalLink className="size-4" />} onClick={() => void useVault.getState().open(path)}>
            Open in Explorer
          </Button>
        )}
      </div>
      {path && <p className="selectable mt-3 truncate font-mono text-[11px] text-noir-silver">{path}</p>}

      <div className="mt-5">
        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Measuring">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
            <p className="pt-1 text-[12px] text-noir-silver">Measuring real file sizes. Big folders can take up to 25 seconds.</p>
          </div>
        ) : error ? (
          <div role="alert" className="flex items-start gap-3 rounded-ctl border border-noir-line px-3.5 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-noir-mist" aria-hidden />
            <p className="min-w-0 flex-1 text-[12px] text-noir-silver">{error}</p>
          </div>
        ) : !data ? (
          <EmptyState compact icon={ChartBar} title="Choose a folder" description="See what is taking up space, largest first." />
        ) : data.items.length === 0 ? (
          <EmptyState compact icon={Folder} title="Nothing here" description="This folder is empty." />
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[22px] font-semibold tracking-tight text-noir-white">{formatBytes(data.total)}</p>
              <p className="text-[12px] text-noir-silver">{data.items.length} items</p>
            </div>
            {!data.complete && (
              <p role="status" className="mb-3 rounded-ctl border border-noir-line px-3 py-2 text-[12px] text-noir-silver">
                The scan hit its time limit, so sizes marked “at least” are partial. Drill into a folder for exact numbers.
              </p>
            )}
            <ul>
              {data.items.slice(0, 40).map((item, i) => {
                const Icon = item.isDir ? Folder : File
                const share = percent(item.size, data.total)
                const body = (
                  <>
                    <Icon className="size-4 shrink-0 text-noir-mist" strokeWidth={1.6} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13px] text-noir-paper">{item.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-noir-mist">
                          {item.partial ? 'at least ' : ''}
                          {formatBytes(item.size)} · {share < 0.1 ? '<0.1' : share.toFixed(1)}%
                        </span>
                      </span>
                      <span className="mt-1.5 block h-[5px] overflow-hidden rounded-full bg-noir-graphite">
                        <span
                          className={cn('block h-full rounded-full', item.partial ? 'bg-[repeating-linear-gradient(45deg,#b5b5b5_0_3px,#555_3px_6px)]' : i === 0 ? 'bg-noir-white' : 'bg-noir-mist')}
                          style={{ width: `${largest > 0 ? Math.max(1, (item.size / largest) * 100) : 0}%`, opacity: i === 0 ? 1 : Math.max(0.35, 1 - i * 0.05) }}
                        />
                      </span>
                    </span>
                  </>
                )
                return (
                  <li key={item.path}>
                    {item.isDir ? (
                      <button type="button" onClick={() => set(item.path)} className="flex w-full items-center gap-3 rounded-ctl px-2.5 py-2.5 text-left transition-colors duration-fast ease-noir hover:bg-white/[0.05]" aria-label={`Analyze ${item.name}`}>
                        {body}
                      </button>
                    ) : (
                      <div className="flex w-full items-center gap-3 px-2.5 py-2.5">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            {data.items.length > 40 && <p className="mt-2 px-2.5 text-[12px] text-noir-silver">Showing the 40 largest of {data.items.length}.</p>}
          </>
        )}
      </div>
    </Card>
  )
}
