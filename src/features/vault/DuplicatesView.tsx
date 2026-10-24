import { useMemo, useState } from 'react'
import { Copy, FolderOpen, Search, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/cn'
import { formatBytes } from '../../lib/format'
import { folderName } from '../../lib/launch'
import { call } from '../../lib/tauri'
import type { DupOutcome } from '../../lib/types'
import { useVault } from '../../store/vault'
import { formatModified } from './fileKind'
import { ScopePicker } from './ScopePicker'
import { TrashDialog, type TrashTarget } from './TrashDialog'
import { useVaultUi } from './ui'

const MB = 1024 * 1024
const MIN_SIZES = [
  { value: String(64 * 1024), label: 'Larger than 64 KB' },
  { value: String(MB), label: 'Larger than 1 MB' },
  { value: String(10 * MB), label: 'Larger than 10 MB' },
  { value: String(100 * MB), label: 'Larger than 100 MB' },
] as const

export function DuplicatesView() {
  const path = useVaultUi((s) => s.dupPath)
  const [minSize, setMinSize] = useState(String(MB))
  const [outcome, setOutcome] = useState<DupOutcome | null>(null)
  const [scannedPath, setScannedPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [trash, setTrash] = useState<TrashTarget[] | null>(null)

  const scan = async () => {
    if (!path) return
    setLoading(true)
    setError(null)
    setOutcome(null)
    setMarked(new Set())
    try {
      setOutcome(await call<DupOutcome>('vault_duplicates', { root: path, minSize: Number(minSize) }))
      setScannedPath(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The scan could not finish')
    } finally {
      setLoading(false)
    }
  }

  const sizeByPath = useMemo(() => {
    const m = new Map<string, number>()
    outcome?.groups.forEach((g) => g.files.forEach((f) => m.set(f.path, g.size)))
    return m
  }, [outcome])

  const totalWasted = outcome?.groups.reduce((n, g) => n + g.wasted, 0) ?? 0
  const markedBytes = [...marked].reduce((n, p) => n + (sizeByPath.get(p) ?? 0), 0)

  /** At least one copy in every group always stays unmarked, so a whole set can never be selected. */
  const toggle = (groupPaths: string[], p: string) =>
    setMarked((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else if (groupPaths.filter((x) => !next.has(x)).length > 1) next.add(p)
      return next
    })

  return (
    <Card className="p-5">
      <CardHeader icon={Copy} title="Duplicate files" />
      <p className="mt-3 max-w-[64ch] text-[12px] leading-[18px] text-noir-silver">
        Files count as duplicates only when their contents are byte-for-byte identical, not just similar names or sizes. NOIR keeps at least one copy in every group, and nothing is
        deleted without your confirmation (it goes to the Recycle Bin).
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ScopePicker label="Folder to scan" value={path} onChange={(p) => useVaultUi.setState({ dupPath: p })} />
        <Select aria-label="Minimum file size" value={minSize} onChange={(e) => setMinSize(e.target.value)} className="w-[190px]">
          {MIN_SIZES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button variant="primary" icon={<Search className="size-4" />} loading={loading} disabled={!path} onClick={() => void scan()}>
          Scan for duplicates
        </Button>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Scanning">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <p className="pt-1 text-[12px] text-noir-silver">Comparing file contents. This can take up to a minute on large folders.</p>
          </div>
        ) : error ? (
          <div role="alert" className="flex items-start gap-3 rounded-ctl border border-noir-line px-3.5 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-noir-mist" aria-hidden />
            <p className="min-w-0 flex-1 text-[12px] text-noir-silver">{error}</p>
          </div>
        ) : !outcome ? (
          <EmptyState compact icon={Copy} title="Nothing scanned yet" description="Choose a folder and scan. Results come from real file contents." />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[13px] text-noir-paper">
                {outcome.groups.length === 0 ? 'No duplicates found' : `${outcome.groups.length} ${outcome.groups.length === 1 ? 'group' : 'groups'} · ${formatBytes(totalWasted)} could be reclaimed`}
              </p>
              <p className="font-mono text-[11px] text-noir-silver">
                {outcome.scanned.toLocaleString()} files checked in {scannedPath ? folderName(scannedPath) : ''}
              </p>
            </div>
            {outcome.truncated && (
              <p role="status" className="mb-3 rounded-ctl border border-noir-line px-3 py-2 text-[12px] text-noir-silver">
                The scan stopped at its limit, so there may be more duplicates. Try a smaller folder or a larger minimum size.
              </p>
            )}
            {outcome.groups.length === 0 ? (
              <EmptyState compact icon={Copy} title="All clean" description="No identical files at this size in that folder." />
            ) : (
              <ul className="space-y-3">
                {outcome.groups.slice(0, 60).map((g, gi) => {
                  const paths = g.files.map((f) => f.path)
                  return (
                    <li key={`${gi}-${g.size}-${paths[0]}`} className="rounded-ctl border border-noir-line">
                      <div className="flex items-center justify-between border-b border-noir-line/60 px-3.5 py-2">
                        <span className="font-mono text-[11px] text-noir-mist">
                          {g.files.length} copies · {formatBytes(g.size)} each
                        </span>
                        <span className="font-mono text-[11px] text-noir-silver">{formatBytes(g.wasted)} reclaimable</span>
                      </div>
                      <ul>
                        {g.files.map((f) => {
                          const on = marked.has(f.path)
                          const isLast = !on && paths.filter((p) => !marked.has(p)).length <= 1
                          return (
                            <li key={f.path} className="flex items-center gap-3 border-b border-noir-line/40 px-3.5 py-2 last:border-0">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={isLast}
                                onChange={() => toggle(paths, f.path)}
                                aria-label={`Select ${folderName(f.path)} for the Recycle Bin`}
                                title={isLast ? 'At least one copy is always kept' : undefined}
                                className="size-4 shrink-0 accent-white disabled:opacity-40"
                              />
                              <span className="min-w-0 flex-1">
                                <span className={cn('block truncate text-[13px]', on ? 'text-noir-silver line-through' : 'text-noir-paper')}>{folderName(f.path)}</span>
                                <span className="selectable block truncate font-mono text-[10.5px] text-noir-silver" title={f.path}>
                                  {f.path}
                                </span>
                              </span>
                              <span className="shrink-0 font-mono text-[10.5px] text-noir-silver">{formatModified(f.modified)}</span>
                              <Button size="sm" variant="ghost" iconOnly aria-label="Show in Explorer" icon={<FolderOpen className="size-3.5" />} onClick={() => void useVault.getState().reveal(f.path)} />
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
            {outcome.groups.length > 60 && <p className="mt-3 text-[12px] text-noir-silver">Showing the first 60 groups.</p>}
          </>
        )}
      </div>

      {marked.size > 0 && (
        <div className="sticky bottom-3 mt-4 flex items-center justify-between gap-4 rounded-ctl border border-noir-mist bg-noir-graphite px-4 py-3 shadow-float">
          <p className="text-[13px] text-noir-paper">
            {marked.size} {marked.size === 1 ? 'file' : 'files'} selected · <span className="font-mono text-[12px] text-noir-mist">{formatBytes(markedBytes)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setMarked(new Set())}>
              Clear
            </Button>
            <Button variant="primary" icon={<Trash2 className="size-4" />} onClick={() => setTrash([...marked].map((p) => ({ path: p, isDir: false, size: sizeByPath.get(p) ?? 0 })))}>
              Move to Recycle Bin…
            </Button>
          </div>
        </div>
      )}

      <TrashDialog targets={trash} onClose={() => setTrash(null)} onDone={(all) => all && void scan()} />
    </Card>
  )
}
