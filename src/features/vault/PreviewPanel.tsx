import { useEffect, useState } from 'react'
import { ExternalLink, FolderOpen, FolderPlus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Dropdown, type MenuItem } from '../../components/ui/Menu'
import { Skeleton } from '../../components/ui/Skeleton'
import { formatBytes } from '../../lib/format'
import { call } from '../../lib/tauri'
import type { Preview, VaultEntry } from '../../lib/types'
import { useVault } from '../../store/vault'
import { formatModified, iconForEntry } from './fileKind'
import { useVaultUi } from './ui'

interface Props {
  entry: VaultEntry
  onTrash: () => void
}

function usePreview(entry: VaultEntry): { preview: Preview | null; error: string | null } {
  const [state, setState] = useState<{ path: string; preview: Preview | null; error: string | null } | null>(null)

  useEffect(() => {
    if (entry.isDir) return
    let alive = true
    // A short delay keeps arrow-key scrolling snappy: only the row you stop on is read.
    const id = window.setTimeout(() => {
      call<Preview>('vault_preview', { path: entry.path })
        .then((preview) => alive && setState({ path: entry.path, preview, error: null }))
        .catch((e: unknown) => alive && setState({ path: entry.path, preview: null, error: e instanceof Error ? e.message : 'Could not preview this file' }))
    }, 160)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [entry.path, entry.isDir])

  return state && state.path === entry.path ? state : { preview: null, error: null }
}

export function PreviewPanel({ entry, onTrash }: Props) {
  const Icon = iconForEntry(entry)
  const collections = useVault((s) => s.collections)
  const { preview, error } = usePreview(entry)

  const collectionItems: MenuItem[] =
    collections.length === 0
      ? [{ id: 'none', label: 'Create a collection first…', onSelect: () => useVaultUi.getState().setTab('collections') }]
      : collections.map((c) => ({
          id: c.id,
          label: c.name,
          icon: <FolderPlus className="size-4" />,
          onSelect: () => void useVault.getState().addToCollection(c.id, [entry.path]),
        }))

  return (
    <aside aria-label="Preview" className="flex w-[300px] shrink-0 flex-col border-l border-noir-line/60">
      <div className="flex items-start gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-ctl bg-noir-graphite text-noir-paper">
          <Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="break-words text-[13px] font-medium leading-5 text-noir-white">{entry.name}</p>
          <p className="mt-0.5 font-mono text-[10.5px] text-noir-silver">
            {entry.isDir ? 'Folder' : formatBytes(entry.size)} · {formatModified(entry.modified)}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {entry.isDir ? (
          <p className="text-[12px] leading-[18px] text-noir-silver">Double-click to open this folder, or use the actions below.</p>
        ) : error ? (
          <p className="text-[12px] leading-[18px] text-noir-silver">{error}</p>
        ) : !preview ? (
          <Skeleton className="h-32 w-full" />
        ) : preview.kind === 'image' ? (
          <img src={preview.dataUrl} alt={`Preview of ${entry.name}`} className="max-h-[260px] w-full rounded-ctl border border-noir-line object-contain" />
        ) : preview.kind === 'text' ? (
          <div>
            <pre className="selectable max-h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-ctl border border-noir-line bg-noir-obsidian p-3 font-mono text-[11px] leading-4 text-noir-mist">
              {preview.text}
            </pre>
            {preview.truncated && <p className="mt-2 text-[11px] text-noir-silver">Showing the start of the file.</p>}
          </div>
        ) : (
          <p className="text-[12px] leading-[18px] text-noir-silver">{preview.reason}</p>
        )}
        <p className="selectable mt-4 break-all font-mono text-[10.5px] leading-4 text-noir-ash">{entry.path}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-noir-line/60 p-4">
        <Button size="sm" variant="primary" icon={<ExternalLink className="size-3.5" />} onClick={() => void useVault.getState().open(entry.path)}>
          Open
        </Button>
        <Button size="sm" variant="outline" icon={<FolderOpen className="size-3.5" />} onClick={() => void useVault.getState().reveal(entry.path)}>
          Show in Explorer
        </Button>
        <Dropdown
          items={collectionItems}
          trigger={({ toggle, ref, open }) => (
            <Button ref={ref} size="sm" variant="outline" icon={<FolderPlus className="size-3.5" />} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
              Add to collection
            </Button>
          )}
        />
        <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={onTrash}>
          Recycle…
        </Button>
      </div>
    </aside>
  )
}
