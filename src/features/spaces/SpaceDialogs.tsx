import { useEffect, useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input, SearchField } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { cn } from '../../lib/cn'
import type { LayoutItem } from '../home/layout'
import type { AppRecord, Shortcut, SpaceIcon } from '../../lib/types'
import { iconFor } from '../orbit/icons'
import { SPACE_ICON_KEYS, SPACE_TEMPLATES, SPACE_ICONS, shortcutKey } from './model'
import { Rocket } from 'lucide-react'

/** Starting dashboards for the built-in templates. Every id/size pair here is valid for its widget. */
export const TEMPLATE_LAYOUTS: Record<string, LayoutItem[]> = {
  gaming: [
    { id: 'welcome', size: 'full' },
    { id: 'space-shortcuts', size: 'md' },
    { id: 'recent-apps', size: 'md' },
    { id: 'performance', size: 'lg' },
    { id: 'network', size: 'sm' },
  ],
  development: [
    { id: 'welcome', size: 'full' },
    { id: 'space-shortcuts', size: 'md' },
    { id: 'projects', size: 'md' },
    { id: 'performance', size: 'lg' },
    { id: 'session', size: 'sm' },
  ],
  everyday: [
    { id: 'welcome', size: 'full' },
    { id: 'space-shortcuts', size: 'md' },
    { id: 'favorites', size: 'md' },
    { id: 'quick-actions', size: 'md' },
    { id: 'recent-apps', size: 'md' },
  ],
  blank: [
    { id: 'welcome', size: 'full' },
    { id: 'space-shortcuts', size: 'md' },
    { id: 'quick-actions', size: 'md' },
  ],
}

interface SpaceDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: { name: string; icon: SpaceIcon }
  onClose: () => void
  onSubmit: (name: string, icon: SpaceIcon, templateId: string | null) => Promise<boolean>
}

export function SpaceDialog({ open, mode, initial, onClose, onSubmit }: SpaceDialogProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<SpaceIcon>('grid')
  const [template, setTemplate] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setIcon(initial?.icon ?? 'grid')
    setTemplate(null)
    setTouched(false)
    setBusy(false)
  }, [open, initial?.name, initial?.icon])

  const pickTemplate = (id: string) => {
    const t = SPACE_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setTemplate(id)
    setIcon(t.icon)
    if (!touched) setName(t.name)
  }

  const valid = name.trim().length > 0
  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    const ok = await onSubmit(name.trim(), icon, template)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      title={mode === 'create' ? 'New space' : 'Edit space'}
      description={mode === 'create' ? 'A Space is its own dashboard, shortcuts and preferences.' : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} loading={busy} onClick={() => void submit()}>
            {mode === 'create' ? 'Create space' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {mode === 'create' && (
          <fieldset>
            <legend className="nis-label mb-2">Start from</legend>
            <div className="grid grid-cols-2 gap-2">
              {SPACE_TEMPLATES.map((t) => {
                const Icon = SPACE_ICONS[t.icon]
                const active = template === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pickTemplate(t.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-ctl border p-3 text-left transition-colors duration-fast ease-noir',
                      active ? 'border-noir-white bg-white/[0.05]' : 'border-noir-line hover:border-[#4d4d4d]',
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-noir-mist" strokeWidth={1.7} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-noir-paper">{t.name}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-4 text-noir-silver">{t.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor="space-name" className="nis-label mb-2 block">
            Name
          </label>
          <Input
            id="space-name"
            data-autofocus
            value={name}
            maxLength={40}
            placeholder="e.g. Streaming"
            onChange={(e) => {
              setName(e.target.value)
              setTouched(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
        </div>

        <fieldset>
          <legend className="nis-label mb-2">Icon</legend>
          <div className="flex flex-wrap gap-1.5">
            {SPACE_ICON_KEYS.map((key) => {
              const Icon = SPACE_ICONS[key]
              const active = icon === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={active}
                  onClick={() => setIcon(key)}
                  className={cn(
                    'grid size-9 place-items-center rounded-ctl border transition-colors duration-fast ease-noir',
                    active ? 'border-noir-white bg-noir-white text-noir-black' : 'border-noir-line text-noir-mist hover:border-[#4d4d4d] hover:text-noir-white',
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.7} aria-hidden />
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}

interface AddAppDialogProps {
  open: boolean
  apps: AppRecord[] | null
  existing: readonly Shortcut[]
  onClose: () => void
  onAdd: (app: AppRecord) => void
}

export function AddAppDialog({ open, apps, existing, onClose, onAdd }: AddAppDialogProps) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const taken = useMemo(() => new Set(existing.map(shortcutKey)), [existing])
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (apps ?? []).filter((a) => !a.hidden && (!q || a.name.toLowerCase().includes(q))).slice(0, 80)
  }, [apps, query])

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      title="Add an app"
      description="Pick from the apps Orbit has found. Add as many as you like."
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <SearchField data-autofocus placeholder="Search apps" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search apps" />
      <ul className="-mx-1 mt-3 max-h-[320px] overflow-y-auto px-1">
        {list.map((app) => {
          const Icon = iconFor(app.icon, app.category)
          const added = taken.has(`app:${app.id}`)
          return (
            <li key={app.id}>
              <button
                type="button"
                disabled={added}
                onClick={() => onAdd(app)}
                className="flex h-10 w-full items-center gap-3 rounded-ctl px-2 text-left transition-colors duration-fast ease-noir hover:bg-white/[0.05] disabled:opacity-50"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-noir-graphite text-noir-paper">
                  <Icon className="size-3.5" strokeWidth={1.6} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-noir-paper">{app.name}</span>
                {added ? <Check className="size-4 text-noir-mist" aria-label="Added" /> : <Plus className="size-4 text-noir-silver" aria-hidden />}
              </button>
            </li>
          )
        })}
      </ul>
      {list.length === 0 && (
        <EmptyState
          compact
          icon={Rocket}
          title={apps === null ? 'Loading apps…' : apps.length === 0 ? 'Orbit has no apps yet' : 'No matching apps'}
          description={apps && apps.length === 0 ? 'Open Orbit and scan for installed applications first.' : 'Try a different search.'}
        />
      )}
    </Modal>
  )
}

interface AddLinkDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (url: string, label: string) => void
}

export function AddLinkDialog({ open, onClose, onAdd }: AddLinkDialogProps) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (open) {
      setUrl('')
      setLabel('')
    }
  }, [open])

  const clean = url.trim()
  const valid = /^https?:\/\/[^\s"]+$/i.test(clean) && clean.length <= 2048
  const submit = () => {
    if (!valid) return
    onAdd(clean, label.trim())
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a web link"
      description="Opens in your default browser. Only http:// and https:// links are allowed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>
            Add link
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="link-url" className="nis-label mb-2 block">
            Address
          </label>
          <Input id="link-url" data-autofocus value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          {clean && !valid && <p className="mt-1.5 text-[11.5px] text-noir-silver">Enter a full address starting with http:// or https://</p>}
        </div>
        <div>
          <label htmlFor="link-label" className="nis-label mb-2 block">
            Label <span className="normal-case tracking-normal text-noir-ash">(optional)</span>
          </label>
          <Input id="link-label" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
      </div>
    </Modal>
  )
}
