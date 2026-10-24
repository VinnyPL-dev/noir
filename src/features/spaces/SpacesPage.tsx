import { useEffect, useState } from 'react'
import { open as pickFolder } from '@tauri-apps/plugin-dialog'
import { AppWindow, Folder, Globe, LayoutGrid, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { NativeRequired } from '../../components/shell/NativeRequired'
import { PageContainer, PageHeader } from '../../components/shell/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Dropdown, type MenuItem } from '../../components/ui/Menu'
import { Modal } from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs } from '../../components/ui/Tabs'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { describeShortcut } from '../../lib/launch'
import type { Shortcut, Space, SpacePrefs } from '../../lib/types'
import { useAutomations } from '../../store/automations'
import { useFlow } from '../../store/flow'
import { useOrbit } from '../../store/orbit'
import { useSpaces } from '../../store/spaces'
import { iconFor } from '../orbit/icons'
import { AutomationsPanel } from './AutomationsPanel'
import { iconOf, parseSpacePrefs, shortcutKey } from './model'
import { AddAppDialog, AddLinkDialog, SpaceDialog, TEMPLATE_LAYOUTS } from './SpaceDialogs'

function SpaceCard({ space, selected, active, onSelect }: { space: Space; selected: boolean; active: boolean; onSelect: () => void }) {
  const Icon = iconOf(space.icon)
  const prefs = parseSpacePrefs(space.prefs)
  return (
    <li>
      <div
        className={cn(
          'nis-card flex h-full flex-col gap-4 p-4 transition-colors duration-base ease-noir',
          selected ? 'border-noir-mist' : 'hover:border-[#4a4a4a]',
        )}
      >
        <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Edit ${space.name}`} className="flex flex-1 items-start gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-ctl bg-noir-graphite text-noir-white">
            <Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[14px] font-medium text-noir-white">{space.name}</span>
              {active && <Badge>Active</Badge>}
            </span>
            <span className="mt-1 block truncate text-[12px] text-noir-silver">
              {prefs.tagline || `${space.shortcuts.length} ${space.shortcuts.length === 1 ? 'shortcut' : 'shortcuts'}`}
            </span>
          </span>
        </button>
        <Button
          size="sm"
          variant={active ? 'ghost' : 'outline'}
          disabled={active}
          onClick={() => void useSpaces.getState().switchTo(space.id)}
        >
          {active ? 'You are here' : 'Switch to this space'}
        </Button>
      </div>
    </li>
  )
}

function ShortcutRow({ shortcut, onRemove }: { shortcut: Shortcut; onRemove: () => void }) {
  const apps = useOrbit((s) => s.apps)
  const view = describeShortcut(shortcut, apps)
  const Icon = view.app ? iconFor(view.app.icon, view.app.category) : shortcut.kind === 'folder' ? Folder : shortcut.kind === 'url' ? Globe : AppWindow
  return (
    <li className="flex h-11 items-center gap-3 border-b border-noir-line/50 last:border-0">
      <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-noir-graphite text-noir-paper">
        <Icon className="size-3.5" strokeWidth={1.6} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13px]', view.missing ? 'text-noir-silver' : 'text-noir-paper')}>{view.label}</span>
      </span>
      <span className="hidden max-w-[45%] truncate font-mono text-[10.5px] text-noir-silver sm:block" title={view.detail}>
        {view.detail}
      </span>
      <Button variant="ghost" size="sm" iconOnly aria-label={`Remove ${view.label}`} icon={<X className="size-4" />} onClick={onRemove} />
    </li>
  )
}

function Editor({ space, onEdit, onDelete }: { space: Space; onEdit: () => void; onDelete: () => void }) {
  const apps = useOrbit((s) => s.apps)
  const prefs = parseSpacePrefs(space.prefs)
  const [tagline, setTagline] = useState(prefs.tagline)
  const [addApp, setAddApp] = useState(false)
  const [addLink, setAddLink] = useState(false)

  useEffect(() => setTagline(prefs.tagline), [space.id, prefs.tagline])

  const savePrefs = (next: Partial<SpacePrefs>) => useSpaces.getState().setPrefs(space.id, { ...prefs, ...next })
  const setShortcuts = (list: Shortcut[]) => void useSpaces.getState().setShortcuts(space.id, list)
  const add = (s: Shortcut) => {
    if (space.shortcuts.some((x) => shortcutKey(x) === shortcutKey(s))) {
      toast.show('Already in this space')
      return
    }
    setShortcuts([...space.shortcuts, s])
  }

  const addFolder = async () => {
    try {
      const picked = await pickFolder({ directory: true, multiple: false, title: 'Choose a folder' })
      if (typeof picked === 'string') add({ kind: 'folder', path: picked })
    } catch (e) {
      toast.error('Could not open the folder picker', e instanceof Error ? e.message : undefined)
    }
  }

  const menu: MenuItem[] = [
    { id: 'app', label: 'Application…', icon: <AppWindow className="size-4" />, onSelect: () => setAddApp(true) },
    { id: 'folder', label: 'Folder…', icon: <Folder className="size-4" />, onSelect: () => void addFolder() },
    { id: 'link', label: 'Web link…', icon: <Link2 className="size-4" />, onSelect: () => setAddLink(true) },
  ]

  return (
    <Card className="p-5">
      <CardHeader
        icon={iconOf(space.icon)}
        title={`${space.name} — settings`}
        right={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={onEdit}>
              Rename
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="space-tagline" className="nis-label mb-2 block">
            Tagline
          </label>
          <Input
            id="space-tagline"
            value={tagline}
            maxLength={80}
            placeholder="Shown on this space's Home"
            onChange={(e) => setTagline(e.target.value)}
            onBlur={() => tagline.trim() !== prefs.tagline && savePrefs({ tagline: tagline.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </div>
        <div>
          <span className="nis-label mb-2 block">Dashboard density</span>
          <Tabs<SpacePrefs['density']>
            mode="radio"
            label="Dashboard density"
            value={prefs.density}
            onChange={(density) => savePrefs({ density })}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className="nis-label">Shortcuts · {space.shortcuts.length}</span>
          <Dropdown
            align="end"
            items={menu}
            trigger={({ toggle, ref, open }) => (
              <Button ref={ref} size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
                Add shortcut
              </Button>
            )}
          />
        </div>
        {space.shortcuts.length === 0 ? (
          <EmptyState compact icon={LayoutGrid} title="No shortcuts yet" description="Apps, folders and links added here appear on this space's Home." />
        ) : (
          <ul className="mt-2">
            {space.shortcuts.map((s) => (
              <ShortcutRow key={shortcutKey(s)} shortcut={s} onRemove={() => setShortcuts(space.shortcuts.filter((x) => shortcutKey(x) !== shortcutKey(s)))} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11.5px] text-noir-silver">Home shows these through the “Space shortcuts” widget. Add it from Customize if you removed it.</p>
      </div>

      <AddAppDialog
        open={addApp}
        apps={apps}
        existing={space.shortcuts}
        onClose={() => setAddApp(false)}
        onAdd={(app) => add({ kind: 'app', id: app.id })}
      />
      <AddLinkDialog open={addLink} onClose={() => setAddLink(false)} onAdd={(url, label) => add({ kind: 'url', url, label: label || null })} />
    </Card>
  )
}

function Body() {
  const spaces = useSpaces((s) => s.spaces)
  const activeId = useSpaces((s) => s.activeId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void useSpaces.getState().ensureLoaded()
    void useOrbit.getState().ensureLoaded(false)
    void useAutomations.getState().load()
    void useFlow.getState().load()
  }, [])

  const selected = spaces?.find((s) => s.id === (selectedId ?? activeId)) ?? spaces?.[0] ?? null

  return (
    <PageContainer>
      <PageHeader
        route="spaces"
        description="Separate environments with their own dashboard, shortcuts and preferences. Switch from the title bar or with Alt 1…9."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} disabled={!spaces || spaces.length >= 12}>
            New space
          </Button>
        }
      />

      {!spaces ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          <Skeleton className="h-[132px] rounded-card" />
          <Skeleton className="h-[132px] rounded-card" />
          <Skeleton className="h-[132px] rounded-card" />
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((s) => (
              <SpaceCard key={s.id} space={s} selected={selected?.id === s.id} active={s.id === activeId} onSelect={() => setSelectedId(s.id)} />
            ))}
          </ul>
          {selected && <Editor space={selected} onEdit={() => setEditing(true)} onDelete={() => setDeleting(true)} />}
          <AutomationsPanel />
        </div>
      )}

      <SpaceDialog
        open={creating}
        mode="create"
        onClose={() => setCreating(false)}
        onSubmit={async (name, icon, template) => {
          const space = await useSpaces.getState().create(name, icon, [])
          if (!space) return false
          useSpaces.getState().setLayout(space.id, TEMPLATE_LAYOUTS[template ?? 'blank'] ?? TEMPLATE_LAYOUTS['blank'] ?? null)
          setSelectedId(space.id)
          toast.success(`${space.name} created`, 'Add shortcuts below, then switch to it from the title bar.')
          return true
        }}
      />
      <SpaceDialog
        open={editing}
        mode="edit"
        initial={selected ? { name: selected.name, icon: selected.icon as Space['icon'] } : undefined}
        onClose={() => setEditing(false)}
        onSubmit={(name, icon) => (selected ? useSpaces.getState().update(selected.id, name, icon) : Promise.resolve(false))}
      />
      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete “${selected?.name ?? ''}”?`}
        description="Its dashboard layout, shortcuts and automations are removed. Your apps, files and notes are not affected."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                const id = selected?.id
                setDeleting(false)
                if (id) {
                  setSelectedId(null)
                  void useSpaces.getState().remove(id).then(() => useAutomations.getState().load(true))
                }
              }}
            >
              Delete space
            </Button>
          </>
        }
      />
    </PageContainer>
  )
}

export function SpacesPage() {
  return (
    <NativeRequired route="spaces" description="Separate environments with their own dashboard, shortcuts and preferences." what="Spaces are saved to a local database, so this page">
      <Body />
    </NativeRequired>
  )
}
