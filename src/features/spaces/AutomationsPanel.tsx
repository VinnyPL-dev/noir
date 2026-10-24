import { useEffect, useState } from 'react'
import { open as pickFolder } from '@tauri-apps/plugin-dialog'
import { AppWindow, Folder, FolderKanban, Globe, Pencil, Play, Plus, ShieldCheck, Trash2, X, Zap } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge, Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Toggle } from '../../components/ui/Toggle'
import { toast } from '../../components/ui/Toast'
import { folderName, hostOf } from '../../lib/launch'
import { formatAgo } from '../../lib/format'
import type { Automation, AutomationAction } from '../../lib/types'
import { useAutomations } from '../../store/automations'
import { useFlow } from '../../store/flow'
import { useNav } from '../../store/nav'
import { useOrbit } from '../../store/orbit'
import { useSpaces } from '../../store/spaces'

const ACTION_ICON = { launchApp: AppWindow, openFolder: Folder, openProject: FolderKanban, openUrl: Globe } as const

function useActionLabel() {
  const apps = useOrbit((s) => s.apps)
  const projects = useFlow((s) => s.projects)
  return (a: AutomationAction): string => {
    switch (a.type) {
      case 'launchApp':
        return `Launch ${apps?.find((x) => x.id === a.appId)?.name ?? 'unknown app'}`
      case 'openFolder':
        return `Open folder ${folderName(a.path)}`
      case 'openProject':
        return `Open project ${projects.find((p) => p.id === a.projectId)?.name ?? 'unknown project'}`
      case 'openUrl':
        return `Open ${hostOf(a.url)}`
    }
  }
}

type Kind = AutomationAction['type']

interface DialogProps {
  open: boolean
  automation: Automation | null
  onClose: () => void
}

function AutomationDialog({ open, automation, onClose }: DialogProps) {
  const spaces = useSpaces((s) => s.spaces) ?? []
  const apps = useOrbit((s) => s.apps) ?? []
  const projects = useFlow((s) => s.projects).filter((p) => !p.archived)
  const label = useActionLabel()

  const [name, setName] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [actions, setActions] = useState<AutomationAction[]>([])
  const [kind, setKind] = useState<Kind>('launchApp')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(automation?.name ?? '')
    setSpaceId(automation?.spaceId ?? useSpaces.getState().activeId ?? spaces[0]?.id ?? '')
    setActions(automation?.actions ?? [])
    setKind('launchApp')
    setTarget('')
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, automation])

  const canAdd = target.trim().length > 0 && (kind !== 'openUrl' || /^https?:\/\/[^\s"]+$/i.test(target.trim()))
  const addAction = () => {
    if (!canAdd) return
    const t = target.trim()
    const next: AutomationAction =
      kind === 'launchApp' ? { type: 'launchApp', appId: t } : kind === 'openFolder' ? { type: 'openFolder', path: t } : kind === 'openProject' ? { type: 'openProject', projectId: t } : { type: 'openUrl', url: t }
    setActions((a) => (a.length >= 12 ? a : [...a, next]))
    setTarget('')
  }

  const browse = async () => {
    try {
      const picked = await pickFolder({ directory: true, multiple: false, title: 'Choose a folder' })
      if (typeof picked === 'string') setTarget(picked)
    } catch (e) {
      toast.error('Could not open the folder picker', e instanceof Error ? e.message : undefined)
    }
  }

  const valid = name.trim().length > 0 && spaceId !== '' && actions.length > 0
  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    const st = useAutomations.getState()
    const ok = automation ? await st.update(automation.id, name.trim(), spaceId, actions) : await st.create(name.trim(), spaceId, actions)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title={automation ? 'Edit automation' : 'New automation'}
      description="Runs when you switch to the chosen Space. Only the actions below ever run, in order."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} loading={busy} onClick={() => void save()}>
            Save automation
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="auto-name" className="nis-label mb-2 block">
              Name
            </label>
            <Input id="auto-name" data-autofocus value={name} maxLength={60} placeholder="e.g. Start coding" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="auto-space" className="nis-label mb-2 block">
              When I enter
            </label>
            <Select id="auto-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <span className="nis-label mb-2 block">Actions · {actions.length}/12</span>
          {actions.length === 0 ? (
            <p className="rounded-ctl border border-dashed border-noir-line px-3 py-3 text-[12px] text-noir-silver">No actions yet. Add at least one below.</p>
          ) : (
            <ol className="rounded-ctl border border-noir-line">
              {actions.map((a, i) => {
                const Icon = ACTION_ICON[a.type]
                return (
                  <li key={`${i}-${a.type}`} className="flex h-10 items-center gap-3 border-b border-noir-line/60 px-3 last:border-0">
                    <span className="font-mono text-[10px] text-noir-ash">{String(i + 1).padStart(2, '0')}</span>
                    <Icon className="size-3.5 shrink-0 text-noir-mist" strokeWidth={1.7} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-noir-paper">{label(a)}</span>
                    <Button size="sm" variant="ghost" iconOnly aria-label="Remove action" icon={<X className="size-3.5" />} onClick={() => setActions((x) => x.filter((_, j) => j !== i))} />
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <div className="rounded-ctl border border-noir-line bg-noir-obsidian p-3">
          <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
            <Select
              aria-label="Action type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind)
                setTarget('')
              }}
            >
              <option value="launchApp">Launch app</option>
              <option value="openFolder">Open folder</option>
              <option value="openProject">Open project</option>
              <option value="openUrl">Open web link</option>
            </Select>

            {kind === 'launchApp' ? (
              <Select aria-label="App" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">{apps.length ? 'Choose an app…' : 'No apps in Orbit yet'}</option>
                {apps.filter((a) => !a.hidden).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            ) : kind === 'openProject' ? (
              <Select aria-label="Project" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">{projects.length ? 'Choose a project…' : 'No projects in Flow yet'}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            ) : kind === 'openFolder' ? (
              <div className="flex gap-2">
                <Input aria-label="Folder path" value={target} placeholder="C:\Users\…" onChange={(e) => setTarget(e.target.value)} />
                <Button variant="outline" onClick={() => void browse()}>
                  Browse…
                </Button>
              </div>
            ) : (
              <Input aria-label="Web address" value={target} placeholder="https://" onChange={(e) => setTarget(e.target.value)} />
            )}

            <Button variant="secondary" icon={<Plus className="size-4" />} disabled={!canAdd || actions.length >= 12} onClick={addAction}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Row({ automation, onEdit }: { automation: Automation; onEdit: () => void }) {
  const spaces = useSpaces((s) => s.spaces)
  const label = useActionLabel()
  const [running, setRunning] = useState(false)
  const space = spaces?.find((s) => s.id === automation.spaceId)

  const run = async () => {
    setRunning(true)
    const report = await useAutomations.getState().runNow(automation.id)
    setRunning(false)
    if (!report) return
    const failed = report.results.filter((r) => !r.ok)
    if (failed.length === 0) toast.success(`${report.name} ran`, `${report.results.length} ${report.results.length === 1 ? 'action' : 'actions'} completed`)
    else toast.error(`${failed.length} of ${report.results.length} actions did not run`, failed[0]?.detail ?? undefined)
  }

  return (
    <li className="flex items-center gap-4 border-b border-noir-line/50 py-3.5 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-noir-paper">{automation.name}</p>
        <p className="mt-1 truncate text-[12px] text-noir-silver" title={automation.actions.map(label).join(' → ')}>
          When I enter {space?.name ?? 'a deleted space'} · {automation.actions.length} {automation.actions.length === 1 ? 'action' : 'actions'}
          {automation.lastRun ? ` · last run ${formatAgo(automation.lastRun)}` : ''}
        </p>
      </div>
      <Button size="sm" variant="ghost" iconOnly aria-label={`Run ${automation.name} now`} icon={<Play className="size-3.5" />} loading={running} onClick={() => void run()} />
      <Button size="sm" variant="ghost" iconOnly aria-label={`Edit ${automation.name}`} icon={<Pencil className="size-3.5" />} onClick={onEdit} />
      <Button size="sm" variant="ghost" iconOnly aria-label={`Delete ${automation.name}`} icon={<Trash2 className="size-3.5" />} onClick={() => void useAutomations.getState().remove(automation.id)} />
      <Toggle label={`${automation.enabled ? 'Disable' : 'Enable'} ${automation.name}`} checked={automation.enabled} onChange={(v) => void useAutomations.getState().setEnabled(automation.id, v)} />
    </li>
  )
}

export function AutomationsPanel() {
  const automations = useAutomations((s) => s.automations)
  const master = useAutomations((s) => s.permissions.master)
  const log = useAutomations((s) => s.log)
  const [dialog, setDialog] = useState<{ open: boolean; automation: Automation | null }>({ open: false, automation: null })

  return (
    <Card className="p-5">
      <CardHeader
        icon={Zap}
        title="Automations"
        right={
          <Button size="sm" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => setDialog({ open: true, automation: null })} disabled={useSpaces.getState().spaces === null}>
            New automation
          </Button>
        }
      />

      <div className="mt-4 flex items-start gap-3 rounded-ctl border border-noir-line bg-noir-obsidian px-3.5 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-noir-mist" strokeWidth={1.7} aria-hidden />
        <div className="min-w-0 flex-1 text-[12px] leading-[18px] text-noir-silver">
          {master ? (
            <>Automations run when you switch Space. NOIR only ever performs the actions you list here, and only the types you allowed.</>
          ) : (
            <>Automatic runs are <span className="text-noir-paper">off</span>. “Run now” still works for actions you have allowed.</>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => useNav.getState().go('settings')}>
          Permissions
        </Button>
      </div>

      <div className="mt-5">
        {automations.length === 0 ? (
          <EmptyState
            compact
            icon={Zap}
            title="No automations yet"
            description="For example: when I enter Development, open my project folder and my editor."
          />
        ) : (
          <ul>
            {automations.map((a) => (
              <Row key={a.id} automation={a} onEdit={() => setDialog({ open: true, automation: a })} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 border-t border-noir-line/60 pt-4">
        <div className="flex items-center justify-between">
          <span className="nis-label">Activity</span>
          {log.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => void useAutomations.getState().clearLog()}>
              Clear
            </Button>
          )}
        </div>
        {log.length === 0 ? (
          <p className="mt-2 text-[12px] text-noir-silver">Nothing has run yet.</p>
        ) : (
          <ul className="mt-2 max-h-[220px] overflow-y-auto">
            {log.slice(0, 20).map((l) => (
              <li key={l.id} className="flex items-baseline gap-3 py-1.5 text-[12px]">
                <span className="w-20 shrink-0 font-mono text-[10.5px] text-noir-silver">{formatAgo(l.ranAt)}</span>
                <Badge className={l.ok ? '' : 'border-noir-ash text-noir-paper'}>{l.ok ? 'ok' : 'refused'}</Badge>
                <span className="shrink-0 text-noir-paper">{l.name}</span>
                <span className="min-w-0 flex-1 truncate text-noir-silver" title={l.detail}>
                  {l.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AutomationDialog open={dialog.open} automation={dialog.automation} onClose={() => setDialog((d) => ({ ...d, open: false }))} />
    </Card>
  )
}
