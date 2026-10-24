import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FolderHeart, FolderOpen, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { formatBytes } from '../../lib/format'
import { call } from '../../lib/tauri'
import type { CollectionItem } from '../../lib/types'
import { useVault } from '../../store/vault'
import { iconForEntry } from './fileKind'
import { useVaultUi } from './ui'

type Dialog = { kind: 'create' } | { kind: 'rename'; id: string; name: string } | { kind: 'delete'; id: string; name: string } | null

export function CollectionsView() {
  const collections = useVault((s) => s.collections)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<CollectionItem[] | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    void useVault.getState().refreshCollections()
  }, [])

  const active = collections.find((c) => c.id === activeId) ?? collections[0] ?? null

  const loadItems = useCallback(async (id: string) => {
    setItems(null)
    try {
      setItems(await call<CollectionItem[]>('vault_collection_items', { id }))
    } catch (e) {
      setItems([])
      toast.error('Could not load the collection', e instanceof Error ? e.message : undefined)
    }
  }, [])

  useEffect(() => {
    if (active) void loadItems(active.id)
    else setItems([])
    // Reload when the selection or the item count changes (adds happen in Browse).
  }, [active?.id, active?.count, loadItems])

  const openDialog = (d: Dialog) => {
    setName(d && d.kind === 'rename' ? d.name : '')
    setDialog(d)
  }

  const submit = async () => {
    const clean = name.trim()
    if (!dialog || !clean) return
    if (dialog.kind === 'create') {
      const c = await useVault.getState().createCollection(clean)
      if (c) setActiveId(c.id)
    } else if (dialog.kind === 'rename') {
      await useVault.getState().renameCollection(dialog.id, clean)
    }
    setDialog(null)
  }

  const removeItem = async (id: string, path: string) => {
    try {
      await call<void>('vault_collection_remove', { id, path })
      setItems((list) => list?.filter((i) => i.path !== path) ?? null)
      await useVault.getState().refreshCollections()
    } catch (e) {
      toast.error('Could not remove that item', e instanceof Error ? e.message : undefined)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card className="self-start p-4">
        <CardHeader icon={FolderHeart} title="Collections" right={<Button size="sm" variant="ghost" iconOnly aria-label="New collection" icon={<Plus className="size-4" />} onClick={() => openDialog({ kind: 'create' })} />} />
        {collections.length === 0 ? (
          <EmptyState
            compact
            icon={FolderHeart}
            title="No collections yet"
            description="Group files and folders that belong to one project."
            action={
              <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => openDialog({ kind: 'create' })}>
                New collection
              </Button>
            }
          />
        ) : (
          <ul className="-mx-1 mt-3 space-y-0.5">
            {collections.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-current={active?.id === c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn('flex h-10 w-full items-center gap-2 rounded-ctl px-2.5 text-left text-[13px] transition-colors duration-fast ease-noir', active?.id === c.id ? 'bg-white/[0.09] text-noir-white' : 'text-noir-paper hover:bg-white/[0.04]')}
                >
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-[10.5px] text-noir-silver">{c.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="min-h-[300px] p-5">
        {!active ? (
          <EmptyState icon={FolderHeart} title="Pick or create a collection" description="Collections are shortcuts: your files stay exactly where they are." />
        ) : (
          <>
            <CardHeader
              icon={FolderHeart}
              title={active.name}
              right={
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => openDialog({ kind: 'rename', id: active.id, name: active.name })}>
                    Rename
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => openDialog({ kind: 'delete', id: active.id, name: active.name })}>
                    Delete
                  </Button>
                </div>
              }
            />
            <div className="mt-4">
              {items === null ? (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  compact
                  icon={FolderOpen}
                  title="This collection is empty"
                  description="In Browse, right-click a file or folder and choose “Add to” this collection."
                  action={
                    <Button size="sm" variant="outline" onClick={() => useVaultUi.getState().setTab('browse')}>
                      Go to Browse
                    </Button>
                  }
                />
              ) : (
                <ul>
                  {items.map((item) => {
                    const Icon = iconForEntry({ name: item.name, isDir: item.isDir })
                    return (
                      <li key={item.path} className="group flex items-center gap-3 border-b border-noir-line/40 py-2 last:border-0">
                        <Icon className="size-4 shrink-0 text-noir-mist" strokeWidth={1.6} aria-hidden />
                        <button
                          type="button"
                          disabled={!item.exists}
                          onClick={() => (item.isDir ? useVaultUi.getState().browse(item.path) : void useVault.getState().open(item.path))}
                          className="min-w-0 flex-1 text-left disabled:opacity-50"
                          title={item.path}
                        >
                          <span className="block truncate text-[13px] text-noir-paper">{item.name}</span>
                          <span className="selectable block truncate font-mono text-[10.5px] text-noir-silver">{item.exists ? item.path : 'Missing or moved'}</span>
                        </button>
                        {item.exists && !item.isDir && <span className="shrink-0 font-mono text-[10.5px] text-noir-silver">{formatBytes(item.size)}</span>}
                        {item.exists && <Button size="sm" variant="ghost" iconOnly aria-label={`Open ${item.name}`} icon={<ExternalLink className="size-3.5" />} onClick={() => void useVault.getState().open(item.path)} />}
                        <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${item.name} from collection`} icon={<X className="size-3.5" />} onClick={() => void removeItem(active.id, item.path)} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </Card>

      <Modal
        open={dialog?.kind === 'create' || dialog?.kind === 'rename'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'rename' ? 'Rename collection' : 'New collection'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!name.trim()} onClick={() => void submit()}>
              {dialog?.kind === 'rename' ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <label htmlFor="collection-name" className="nis-label mb-2 block">
          Name
        </label>
        <Input id="collection-name" data-autofocus value={name} maxLength={60} placeholder="e.g. Roblox game assets" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} />
      </Modal>

      <Modal
        open={dialog?.kind === 'delete'}
        onClose={() => setDialog(null)}
        title={`Delete “${dialog?.kind === 'delete' ? dialog.name : ''}”?`}
        description="Only the collection is removed. The files and folders in it are not touched."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                if (dialog?.kind === 'delete') void useVault.getState().deleteCollection(dialog.id)
                setDialog(null)
              }}
            >
              Delete collection
            </Button>
          </>
        }
      />
    </div>
  )
}
