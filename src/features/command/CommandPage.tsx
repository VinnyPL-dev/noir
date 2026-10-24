import { useEffect, useState } from 'react'
import { Command, Keyboard, Search } from 'lucide-react'
import { PageContainer, PageHeader } from '../../components/shell/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, Card, CardHeader, Kbd } from '../../components/ui/Card'
import { toast } from '../../components/ui/Toast'
import { call, isTauri } from '../../lib/tauri'
import type { ShortcutInfo } from '../../lib/types'
import { useCommand } from '../../store/command'
import { toAccelerator } from './search'

const DEFAULT_ACCELERATOR = 'Ctrl+Shift+Space'

const CAPABILITIES: readonly { title: string; example: string }[] = [
  { title: 'Launch applications', example: 'Type part of an app name, then Enter.' },
  { title: 'Search installed software', example: 'Everything Orbit has found is searchable, favorites and frequent apps first.' },
  { title: 'Open directories', example: 'Pick a favorite folder or drive, or paste a path such as C:\\Users\\you\\Documents.' },
  { title: 'Create notes and tasks', example: 'Type any text, then choose “New note” or “Add task”.' },
  { title: 'Switch Spaces', example: 'Type “switch” to list your Spaces. Automations run as usual.' },
  { title: 'Open projects', example: 'Projects from Flow open their folder.' },
  { title: 'See system information', example: 'Type “cpu” or “memory” for a live reading, or copy a full summary.' },
  { title: 'Go anywhere in NOIR', example: 'Type “go to” followed by a section name.' },
]

function Recorder({ info, onSaved }: { info: ShortcutInfo | null; onSaved: (i: ShortcutInfo) => void }) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (accelerator: string) => {
    setBusy(true)
    setError(null)
    try {
      onSaved(await call<ShortcutInfo>('command_shortcut_set', { accelerator }))
      toast.success('Shortcut changed', accelerator.replace(/\+/g, ' + '))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That shortcut could not be used.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(false)
        return
      }
      const accelerator = toAccelerator(e)
      if (!accelerator) return
      setRecording(false)
      void save(accelerator)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          aria-live="polite"
          className="flex h-10 min-w-[220px] items-center gap-2 rounded-ctl border border-noir-line bg-noir-obsidian px-3.5"
        >
          {recording ? (
            <span className="text-[13px] text-noir-mist">Press the new shortcut… (Esc to cancel)</span>
          ) : info ? (
            info.accelerator.split('+').map((k, i) => <Kbd key={`${k}-${i}`}>{k}</Kbd>)
          ) : (
            <span className="text-[13px] text-noir-silver">Loading…</span>
          )}
        </div>
        <Button variant="outline" loading={busy} disabled={!info || recording} onClick={() => (setError(null), setRecording(true))}>
          Change…
        </Button>
        <Button variant="ghost" disabled={!info || busy || info.accelerator === DEFAULT_ACCELERATOR} onClick={() => void save(DEFAULT_ACCELERATOR)}>
          Reset to default
        </Button>
        {info && <Badge className={info.registered ? '' : 'border-noir-ash text-noir-paper'}>{info.registered ? 'Active' : 'Not registered'}</Badge>}
      </div>
      {error && (
        <p role="alert" className="mt-3 max-w-[60ch] text-[12px] leading-[18px] text-noir-mist">
          {error}
        </p>
      )}
      {info && !info.registered && info.error && (
        <p role="alert" className="mt-3 max-w-[60ch] text-[12px] leading-[18px] text-noir-mist">
          {info.error} Choose another shortcut.
        </p>
      )}
      <p className="mt-3 max-w-[60ch] text-[12px] leading-[18px] text-noir-silver">
        Include at least one of Ctrl, Alt, Shift or the Windows key. The shortcut works from any app, brings NOIR to the front and opens the palette.
      </p>
    </div>
  )
}

export function CommandPage() {
  const [info, setInfo] = useState<ShortcutInfo | null>(null)

  useEffect(() => {
    if (!isTauri()) return
    call<ShortcutInfo>('command_shortcut_get').then(setInfo).catch(() => setInfo(null))
  }, [])

  return (
    <PageContainer>
      <PageHeader
        route="command"
        description="One search box for everything in NOIR. It runs real actions, not just a list of links."
        actions={
          <Button variant="primary" icon={<Search className="size-4" />} onClick={() => useCommand.getState().setOpen(true)}>
            Open palette
          </Button>
        }
      />

      <div className="space-y-4">
        <Card className="p-5">
          <CardHeader icon={Keyboard} title="Shortcuts" />
          <div className="mt-5 space-y-6">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-[13px] font-medium text-noir-paper">Inside NOIR</p>
                <p className="mt-1 text-[12px] text-noir-silver">Always available while the window is focused.</p>
              </div>
              <span className="flex items-center gap-1">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </span>
            </div>
            <div className="border-t border-noir-line/50 pt-6">
              <p className="text-[13px] font-medium text-noir-paper">Global shortcut</p>
              <p className="mb-4 mt-1 max-w-[60ch] text-[12px] leading-[18px] text-noir-silver">Summon the palette from anywhere in Windows.</p>
              {isTauri() ? (
                <Recorder info={info} onSaved={setInfo} />
              ) : (
                <p className="text-[12px] text-noir-silver">The global shortcut needs the NOIR desktop app. Start it with npm run tauri dev.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader icon={Command} title="What it can do" />
          <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <li key={c.title}>
                <p className="text-[13px] font-medium text-noir-paper">{c.title}</p>
                <p className="mt-1 text-[12px] leading-[18px] text-noir-silver">{c.example}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PageContainer>
  )
}
