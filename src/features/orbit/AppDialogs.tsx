import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { open as openFileDialog } from '@tauri-apps/plugin-dialog'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import type { AppCategory, AppRecord } from '../../lib/types'
import { useOrbit } from '../../store/orbit'
import { CATEGORIES, CATEGORY_ICON, ICON_CHOICES, iconFor } from './icons'

function CategoryPicker({ value, onChange }: { value: AppCategory; onChange: (c: AppCategory) => void }) {
  return (
    <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICON[c]
        const active = c === value
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-ctl border px-2.5 text-[12px] transition-colors duration-fast ease-noir',
              active
                ? 'border-noir-white bg-noir-white text-noir-black'
                : 'border-noir-line text-noir-mist hover:border-[#4d4d4d] hover:text-noir-white',
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
            {c}
          </button>
        )
      })}
    </div>
  )
}

const Label = ({ children }: { children: string }) => <p className="nis-label mb-2">{children}</p>

export function EditAppModal({ app, onClose }: { app: AppRecord | null; onClose: () => void }) {
  const [category, setCategory] = useState<AppCategory>('Other')
  const [icon, setIcon] = useState<string | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    if (app) {
      setCategory(app.category)
      setIcon(app.icon)
      setName(app.name)
    }
  }, [app])

  const save = () => {
    if (!app) return
    const store = useOrbit.getState()
    if (category !== app.category) void store.setCategory(app.id, category)
    if (icon !== app.icon) void store.setIcon(app.id, icon)
    if (app.kind === 'custom' && name.trim() && name.trim() !== app.name) void store.rename(app.id, name)
    onClose()
  }

  return (
    <Modal
      open={app !== null}
      onClose={onClose}
      title={app ? `Customize ${app.name}` : 'Customize'}
      description="Choose where it appears in Orbit and how it looks."
      width={500}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {app?.kind === 'custom' && (
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} aria-label="Name" />
          </div>
        )}
        <div>
          <Label>Category</Label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
        <div>
          <Label>Icon</Label>
          <div role="radiogroup" aria-label="Icon" className="grid grid-cols-10 gap-1.5">
            <button
              type="button"
              role="radio"
              aria-checked={icon === null}
              onClick={() => setIcon(null)}
              title="Default for this category"
              className={cn(
                'grid h-9 place-items-center rounded-ctl border text-[10px] font-mono uppercase transition-colors duration-fast ease-noir',
                icon === null ? 'border-noir-white text-noir-white' : 'border-noir-line text-noir-silver hover:border-[#4d4d4d]',
              )}
            >
              Auto
            </button>
            {Object.keys(ICON_CHOICES).map((key) => {
              const Icon = iconFor(key, 'Other')
              const active = icon === key
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={key}
                  onClick={() => setIcon(key)}
                  className={cn(
                    'grid h-9 place-items-center rounded-ctl border transition-colors duration-fast ease-noir',
                    active ? 'border-noir-white bg-noir-white text-noir-black' : 'border-noir-line text-noir-mist hover:border-[#4d4d4d] hover:text-noir-white',
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.6} aria-hidden />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function AddAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [path, setPath] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<AppCategory>('Other')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setPath('')
      setName('')
      setCategory('Other')
      setBusy(false)
    }
  }, [open])

  const browse = async () => {
    try {
      const picked = await openFileDialog({
        multiple: false,
        directory: false,
        title: 'Choose a program',
        filters: [{ name: 'Programs and shortcuts', extensions: ['exe', 'lnk'] }],
      })
      if (typeof picked === 'string') setPath(picked)
    } catch (e) {
      toast.error('Could not open the file picker', e instanceof Error ? e.message : undefined)
    }
  }

  const add = async () => {
    setBusy(true)
    const ok = await useOrbit.getState().addCustom(path, name || undefined, category)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a program"
      description="Add any .exe or shortcut, even if Windows doesn't list it in the Start menu."
      width={500}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void add()} loading={busy} disabled={!path.trim()}>
            Add to Orbit
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label>Program</Label>
          <div className="flex gap-2">
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="C:\Program Files\App\app.exe"
              aria-label="Program path"
              spellCheck={false}
            />
            <Button variant="outline" icon={<FolderOpen className="size-4" />} onClick={() => void browse()}>
              Browse
            </Button>
          </div>
        </div>
        <div>
          <Label>Name (optional)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Uses the file name if empty" maxLength={100} aria-label="Display name" />
        </div>
        <div>
          <Label>Category</Label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>
      </div>
    </Modal>
  )
}
