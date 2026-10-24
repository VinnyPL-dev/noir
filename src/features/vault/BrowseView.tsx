import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { ArrowUp, ChevronRight, Clock, ExternalLink, FolderOpen, FolderPlus, HardDrive, House, Search, Star, StarOff, Trash2, TriangleAlert, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchField } from '../../components/ui/Input'
import { useContextMenu, type MenuItem } from '../../components/ui/Menu'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../lib/cn'
import { formatAgo, formatBytes } from '../../lib/format'
import { call } from '../../lib/tauri'
import type { SearchOutcome, VaultEntry, VaultListing } from '../../lib/types'
import { useVault } from '../../store/vault'
import { crumbsOf, formatModified, iconForEntry } from './fileKind'
import { PreviewPanel } from './PreviewPanel'
import { TrashDialog, type TrashTarget } from './TrashDialog'
import { useVaultUi } from './ui'

function Locations() {
  const roots = useVault((s) => s.roots)
  const favorites = useVault((s) => s.favorites)
  const recents = useVault((s) => s.recents)
  const browse = useVaultUi((s) => s.browse)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <CardHeader icon={HardDrive} title="Locations" />
        <ul className="-mx-2 mt-3">
          {roots.map((r) => (
            <li key={r.path}>
              <button type="button" onClick={() => browse(r.path)} className="flex h-10 w-full items-center gap-3 rounded-ctl px-2.5 text-left text-[13px] text-noir-paper transition-colors duration-fast ease-noir hover:bg-white/[0.05]">
                {r.kind === 'drive' ? <HardDrive className="size-4 shrink-0 text-noir-silver" strokeWidth={1.6} aria-hidden /> : <FolderOpen className="size-4 shrink-0 text-noir-silver" strokeWidth={1.6} aria-hidden />}
                <span className="flex-1 truncate">{r.label}</span>
                <span className="max-w-[50%] truncate font-mono text-[10px] text-noir-silver">{r.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <CardHeader icon={Star} title="Favorite folders" />
          {favorites.length === 0 ? (
            <EmptyState compact icon={Star} title="No favorites yet" description="Open a folder and press the star to keep it here." />
          ) : (
            <ul className="-mx-2 mt-3">
              {favorites.map((f) => (
                <li key={f.path} className="group flex items-center">
                  <button
                    type="button"
                    disabled={!f.exists}
                    onClick={() => browse(f.path)}
                    className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-ctl px-2.5 text-left text-[13px] text-noir-paper transition-colors duration-fast ease-noir hover:bg-white/[0.05] disabled:opacity-50"
                  >
                    <Star className="size-4 shrink-0 text-noir-silver" strokeWidth={1.6} aria-hidden />
                    <span className="flex-1 truncate">{f.label}</span>
                    {!f.exists && <span className="font-mono text-[10px] text-noir-silver">missing</span>}
                  </button>
                  <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${f.label} from favorites`} icon={<X className="size-3.5" />} onClick={() => void useVault.getState().removeFavorite(f.path)} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <CardHeader
            icon={Clock}
            title="Recently opened"
            right={recents.length > 0 ? <Button size="sm" variant="ghost" onClick={() => void useVault.getState().clearRecents()}>Clear</Button> : undefined}
          />
          {recents.length === 0 ? (
            <EmptyState compact icon={Clock} title="Nothing opened yet" description="Files and folders you open from Vault are listed here." />
          ) : (
            <ul className="-mx-2 mt-3">
              {recents.slice(0, 8).map((r) => (
                <li key={r.path}>
                  <button
                    type="button"
                    disabled={!r.exists}
                    onClick={() => void useVault.getState().open(r.path)}
                    className="flex h-10 w-full items-center gap-3 rounded-ctl px-2.5 text-left transition-colors duration-fast ease-noir hover:bg-white/[0.05] disabled:opacity-50"
                    title={r.path}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-noir-paper">{r.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-noir-silver">{r.exists ? formatAgo(r.openedAt) : 'missing'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

interface RowProps {
  entry: VaultEntry
  selected: boolean
  onClick: (e: MouseEvent) => void
  onOpen: () => void
  buildMenu: (entry: VaultEntry) => MenuItem[]
}

function Row({ entry, selected, onClick, onOpen, buildMenu }: RowProps) {
  const Icon = iconForEntry(entry)
  const { onContextMenu, menu } = useContextMenu(buildMenu(entry))
  return (
    <li
      role="option"
      aria-selected={selected}
      data-path={entry.path}
      onClick={onClick}
      onDoubleClick={onOpen}
      onContextMenu={(e) => {
        if (!selected) onClick(e)
        onContextMenu(e)
      }}
      className={cn(
        'grid h-10 cursor-default select-none grid-cols-[1fr_88px_96px] items-center gap-3 rounded-ctl px-3 text-[13px] transition-colors duration-fast ease-noir',
        selected ? 'bg-white/[0.09] text-noir-white' : 'text-noir-paper hover:bg-white/[0.04]',
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="size-4 shrink-0 text-noir-mist" strokeWidth={1.6} aria-hidden />
        <span className="truncate">{entry.name}</span>
      </span>
      <span className="text-right font-mono text-[11px] text-noir-silver">{entry.isDir ? '' : formatBytes(entry.size)}</span>
      <span className="text-right font-mono text-[11px] text-noir-silver">{formatModified(entry.modified)}</span>
      {menu}
    </li>
  )
}

export function BrowseView() {
  const path = useVaultUi((s) => s.browsePath)
  const browse = useVaultUi((s) => s.browse)
  const favorites = useVault((s) => s.favorites)
  const collections = useVault((s) => s.collections)

  const [listing, setListing] = useState<VaultListing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchOutcome | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [anchor, setAnchor] = useState(0)
  const [trash, setTrash] = useState<TrashTarget[] | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const load = useCallback(async (target: string) => {
    setLoading(true)
    setError(null)
    try {
      setListing(await call<VaultListing>('vault_list_dir', { path: target }))
    } catch (e) {
      setListing(null)
      setError(e instanceof Error ? e.message : 'Could not open this folder')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setSelected([])
    setResults(null)
    setQuery('')
    if (path) void load(path)
    else {
      setListing(null)
      setError(null)
    }
  }, [path, load])

  const entries = useMemo(() => results?.hits ?? listing?.entries ?? [], [results, listing])
  const selectedEntries = useMemo(() => entries.filter((e) => selected.includes(e.path)), [entries, selected])
  const single = selectedEntries.length === 1 ? (selectedEntries[0] ?? null) : null
  const isFav = path !== null && favorites.some((f) => f.path.toLowerCase() === path.toLowerCase())

  const runSearch = async () => {
    const q = query.trim()
    if (!path || !q) {
      setResults(null)
      return
    }
    setSearching(true)
    try {
      setResults(await call<SearchOutcome>('vault_search', { root: path, query: q }))
      setSelected([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const open = (e: VaultEntry) => (e.isDir ? browse(e.path) : void useVault.getState().open(e.path))

  const onRowClick = (entry: VaultEntry, index: number) => (ev: MouseEvent) => {
    if (ev.shiftKey && entries[anchor]) {
      const [a, b] = anchor < index ? [anchor, index] : [index, anchor]
      setSelected(entries.slice(a, b + 1).map((x) => x.path))
    } else if (ev.ctrlKey || ev.metaKey) {
      setSelected((s) => (s.includes(entry.path) ? s.filter((p) => p !== entry.path) : [...s, entry.path]))
      setAnchor(index)
    } else {
      setSelected([entry.path])
      setAnchor(index)
    }
  }

  const targetsFor = (entry: VaultEntry): VaultEntry[] => (selected.includes(entry.path) ? selectedEntries : [entry])
  const askTrash = (list: VaultEntry[]) => setTrash(list.map((e) => ({ path: e.path, isDir: e.isDir, size: e.size })))

  const buildMenu = (entry: VaultEntry): MenuItem[] => {
    const targets = targetsFor(entry)
    const items: MenuItem[] = [
      { id: 'open', label: entry.isDir ? 'Open folder' : 'Open', icon: <ExternalLink className="size-4" />, onSelect: () => open(entry) },
      { id: 'reveal', label: 'Show in Explorer', icon: <FolderOpen className="size-4" />, onSelect: () => void useVault.getState().reveal(entry.path) },
    ]
    if (entry.isDir) {
      items.push(
        { id: 'fav', label: 'Add to favorites', icon: <Star className="size-4" />, separatorBefore: true, onSelect: () => void useVault.getState().addFavorite(entry.path) },
        { id: 'analyze', label: 'Analyze storage', icon: <HardDrive className="size-4" />, onSelect: () => useVaultUi.getState().analyze(entry.path) },
        { id: 'dupes', label: 'Find duplicates here', icon: <Search className="size-4" />, onSelect: () => useVaultUi.getState().findDuplicates(entry.path) },
      )
    }
    collections.slice(0, 6).forEach((c, i) =>
      items.push({
        id: `c-${c.id}`,
        label: targets.length > 1 ? `Add ${targets.length} items to “${c.name}”` : `Add to “${c.name}”`,
        icon: <FolderPlus className="size-4" />,
        separatorBefore: i === 0,
        onSelect: () => void useVault.getState().addToCollection(c.id, targets.map((t) => t.path)),
      }),
    )
    items.push({
      id: 'trash',
      label: targets.length > 1 ? `Move ${targets.length} items to Recycle Bin…` : 'Move to Recycle Bin…',
      icon: <Trash2 className="size-4" />,
      separatorBefore: true,
      onSelect: () => askTrash(targets),
    })
    return items
  }

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (entries.length === 0) return
    const current = Math.max(0, entries.findIndex((x) => x.path === selected[selected.length - 1]))
    const move = (to: number) => {
      const next = entries[Math.min(entries.length - 1, Math.max(0, to))]
      if (!next) return
      setSelected([next.path])
      setAnchor(entries.indexOf(next))
      listRef.current?.querySelector(`[data-path="${CSS.escape(next.path)}"]`)?.scrollIntoView({ block: 'nearest' })
    }
    if (e.key === 'ArrowDown') (e.preventDefault(), move(selected.length ? current + 1 : 0))
    else if (e.key === 'ArrowUp') (e.preventDefault(), move(selected.length ? current - 1 : 0))
    else if (e.key === 'Home') (e.preventDefault(), move(0))
    else if (e.key === 'End') (e.preventDefault(), move(entries.length - 1))
    else if (e.key === 'Enter' && single) (e.preventDefault(), open(single))
    else if (e.key === 'Backspace' && listing?.parent) (e.preventDefault(), browse(listing.parent))
    else if (e.key === 'Delete' && selectedEntries.length > 0) (e.preventDefault(), askTrash(selectedEntries))
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') (e.preventDefault(), setSelected(entries.map((x) => x.path)))
  }

  if (path === null) return <Locations />

  const crumbs = crumbsOf(path)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-noir-line/60 p-3">
        <Button size="sm" variant="ghost" iconOnly aria-label="All locations" icon={<House className="size-4" />} onClick={() => browse(null)} />
        <Button size="sm" variant="ghost" iconOnly aria-label="Up one folder" disabled={!listing?.parent} icon={<ArrowUp className="size-4" />} onClick={() => listing?.parent && browse(listing.parent)} />
        <nav aria-label="Path" className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap">
          {crumbs.map((c, i) => (
            <span key={c.path} className="flex items-center">
              {i > 0 && <ChevronRight className="size-3 shrink-0 text-noir-ash" aria-hidden />}
              <button
                type="button"
                onClick={() => browse(c.path)}
                aria-current={i === crumbs.length - 1 ? 'location' : undefined}
                className={cn('rounded px-1.5 py-1 text-[12px] transition-colors duration-fast ease-noir hover:bg-white/[0.06]', i === crumbs.length - 1 ? 'text-noir-white' : 'text-noir-silver')}
              >
                {c.label}
              </button>
            </span>
          ))}
        </nav>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          icon={isFav ? <StarOff className="size-4" /> : <Star className="size-4" />}
          onClick={() => (isFav ? void useVault.getState().removeFavorite(path) : void useVault.getState().addFavorite(path))}
        />
        <div className="w-[240px] max-w-full">
          <SearchField
            aria-label="Search in this folder"
            placeholder="Search this folder…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (e.target.value === '') setResults(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
          />
        </div>
      </div>

      {(results || searching) && (
        <div className="flex items-center justify-between gap-3 border-b border-noir-line/60 bg-noir-obsidian px-4 py-2 text-[12px] text-noir-silver" role="status">
          <span>
            {searching
              ? 'Searching…'
              : `${results?.hits.length ?? 0} ${results?.hits.length === 1 ? 'result' : 'results'} · ${results?.scanned.toLocaleString()} items scanned in ${((results?.elapsedMs ?? 0) / 1000).toFixed(1)}s${results?.truncated ? ' · stopped early, narrow the search' : ''}`}
          </span>
          <Button size="sm" variant="ghost" onClick={() => (setResults(null), setQuery(''))}>
            Clear search
          </Button>
        </div>
      )}

      <div className="flex min-h-[420px]">
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[1fr_88px_96px] gap-3 border-b border-noir-line/40 px-6 py-2">
            <span className="nis-label">Name</span>
            <span className="nis-label text-right">Size</span>
            <span className="nis-label text-right">Modified</span>
          </div>
          {loading && !listing ? (
            <div className="space-y-1.5 p-3" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="m-4 flex items-start gap-3 rounded-ctl border border-noir-line px-3.5 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-noir-mist" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-noir-paper">Couldn't open this folder</p>
                <p className="mt-0.5 text-[12px] text-noir-silver">{error}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void load(path)}>
                Try again
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <EmptyState icon={FolderOpen} title={results ? 'No matches' : 'This folder is empty'} description={results ? 'Try fewer or different words.' : 'Nothing to show here.'} />
          ) : (
            <ul ref={listRef} role="listbox" aria-multiselectable aria-label="Files and folders" tabIndex={0} onKeyDown={onKeyDown} className="max-h-[560px] overflow-y-auto p-2 focus-visible:outline-none">
              {entries.map((entry, i) => (
                <Row key={entry.path} entry={entry} selected={selected.includes(entry.path)} onClick={onRowClick(entry, i)} onOpen={() => open(entry)} buildMenu={buildMenu} />
              ))}
              {!results && listing?.truncated && <li className="px-3 py-3 text-[12px] text-noir-silver">This folder is very large, so only the first items are shown. Use search to find the rest.</li>}
            </ul>
          )}
        </div>

        {selectedEntries.length > 1 ? (
          <aside aria-label="Selection" className="flex w-[300px] shrink-0 flex-col justify-between border-l border-noir-line/60 p-4">
            <div>
              <p className="text-[13px] font-medium text-noir-white">{selectedEntries.length} items selected</p>
              <p className="mt-1 font-mono text-[10.5px] text-noir-silver">{formatBytes(selectedEntries.reduce((n, e) => n + (e.isDir ? 0 : e.size), 0))} in files</p>
            </div>
            <Button variant="outline" icon={<Trash2 className="size-4" />} onClick={() => askTrash(selectedEntries)}>
              Move to Recycle Bin…
            </Button>
          </aside>
        ) : single ? (
          <PreviewPanel entry={single} onTrash={() => askTrash([single])} />
        ) : null}
      </div>

      <TrashDialog
        targets={trash}
        onClose={() => setTrash(null)}
        onDone={() => {
          setSelected([])
          if (results) void runSearch()
          else if (path) void load(path)
        }}
      />
    </Card>
  )
}
