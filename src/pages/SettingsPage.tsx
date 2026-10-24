import { useEffect, useState, type ReactNode } from 'react'
import { Card, CardHeader, Kbd } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { PageContainer, PageHeader } from '../components/shell/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { Toggle } from '../components/ui/Toggle'
import { toast } from '../components/ui/Toast'
import { isTauri, call } from '../lib/tauri'
import type { AppInfo } from '../lib/types'
import { useMonitor } from '../store/monitor'
import { usePrefs, type MotionPref } from '../store/prefs'
import { useSpaces } from '../store/spaces'
import { AutomationPermissions } from '../features/spaces/AutomationPermissions'
import { Layout, Palette, Info, Keyboard, User, Zap } from 'lucide-react'

function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-8 border-b border-noir-line/50 py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-noir-paper">{title}</p>
        {description && <p className="mt-1 max-w-[52ch] text-[12px] leading-[18px] text-noir-silver">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: typeof User; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <CardHeader icon={icon} title={title} />
      <div className="mt-5">{children}</div>
    </Card>
  )
}

const SHORTCUTS: readonly [string, string][] = [
  ['Toggle sidebar', 'Ctrl B'],
  ['Go to section 1–8', 'Ctrl 1…8'],
  ['Open Settings', 'Ctrl ,'],
  ['Open the command palette', 'Ctrl K'],
  ['Switch to Space 1–9', 'Alt 1…9'],
]

function DisplayName() {
  const stored = usePrefs((s) => s.displayName)
  const setName = usePrefs((s) => s.setDisplayName)
  const osUser = useMonitor((s) => s.session?.username ?? '')
  const [draft, setDraft] = useState(stored)

  useEffect(() => setDraft(stored), [stored])

  const commit = () => {
    if (draft.trim() !== stored) setName(draft)
  }

  return (
    <Input
      aria-label="Display name"
      value={draft}
      maxLength={40}
      placeholder={osUser || 'Your name'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className="w-60"
    />
  )
}

export function SettingsPage() {
  const collapsed = usePrefs((s) => s.sidebarCollapsed)
  const setCollapsed = usePrefs((s) => s.setSidebarCollapsed)
  const motionPref = usePrefs((s) => s.motionPref)
  const setMotionPref = usePrefs((s) => s.setMotionPref)
  const resetLayout = () => {
    const id = useSpaces.getState().activeId
    if (id) useSpaces.getState().setLayout(id, null)
  }
  const [confirm, setConfirm] = useState(false)
  const [app, setApp] = useState<AppInfo | null>(null)

  useEffect(() => {
    if (!isTauri()) return
    call<AppInfo>('get_app_info').then(setApp).catch(() => setApp(null))
  }, [])

  return (
    <PageContainer>
      <PageHeader route="settings" description="Preferences are stored locally in an SQLite database on this PC." />
      <div className="space-y-4">
        <Section icon={User} title="Profile">
          <Row title="Display name" description="Used in the Home greeting. Leave empty to use your Windows user name.">
            <DisplayName />
          </Row>
        </Section>

        <Section icon={Palette} title="Interface">
          <Row title="Collapse sidebar" description="Show icons only. Also available with Ctrl B.">
            <Toggle label="Collapse sidebar" checked={collapsed} onChange={setCollapsed} />
          </Row>
          <Row title="Motion" description="System follows your Windows animation setting. Reduced removes transitions.">
            <Tabs<MotionPref>
              mode="radio"
              label="Motion"
              value={motionPref}
              onChange={setMotionPref}
              options={[
                { value: 'system', label: 'System' },
                { value: 'reduce', label: 'Reduced' },
                { value: 'full', label: 'Full' },
              ]}
            />
          </Row>
        </Section>

        <Section icon={Layout} title="Dashboard">
          <Row title="Reset layout" description="Restore the default widgets, order and sizes on Home for the active Space.">
            <Button variant="outline" onClick={() => setConfirm(true)}>
              Reset layout
            </Button>
          </Row>
        </Section>

        <Section icon={Zap} title="Automations">
          <AutomationPermissions />
        </Section>

        <Section icon={Keyboard} title="Keyboard">
          {SHORTCUTS.map(([label, keys]) => (
            <Row key={label} title={label}>
              <Kbd>{keys}</Kbd>
            </Row>
          ))}
        </Section>

        <Section icon={Info} title="About">
          <Row title="Version">
            <span className="font-mono text-[12px] text-noir-paper">{app?.version ?? '—'}</span>
          </Row>
          <Row title="Data location" description="Everything NOIR stores stays in this folder.">
            <span className="selectable block max-w-[360px] truncate font-mono text-[11.5px] text-noir-mist" title={app?.dataDir}>
              {app?.dataDir ?? 'Available in the desktop app'}
            </span>
          </Row>
        </Section>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset dashboard layout?"
        description="Widgets return to their default order and sizes. Your data is not affected."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                resetLayout()
                setConfirm(false)
                toast.success('Layout reset')
              }}
            >
              Reset layout
            </Button>
          </>
        }
      />
    </PageContainer>
  )
}
