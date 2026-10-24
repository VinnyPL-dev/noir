import { useEffect } from 'react'
import { Toggle } from '../../components/ui/Toggle'
import { isTauri } from '../../lib/tauri'
import type { AutomationPermissions as Permissions } from '../../lib/types'
import { useAutomations } from '../../store/automations'

const ROWS: readonly { key: keyof Permissions; title: string; description: string }[] = [
  {
    key: 'master',
    title: 'Run automations automatically',
    description: 'When on, enabled automations run as you switch Space. Off by default. “Run now” is unaffected.',
  },
  { key: 'apps', title: 'Launch applications', description: 'Allow automations to start apps from your Orbit list.' },
  { key: 'folders', title: 'Open folders and projects', description: 'Allow automations to open folders and project folders in Explorer.' },
  { key: 'urls', title: 'Open web links', description: 'Allow automations to open http(s) links in your browser.' },
]

/** Fine-grained automation permissions. NOIR never runs scripts: only these four built-in action types exist. */
export function AutomationPermissions() {
  const permissions = useAutomations((s) => s.permissions)

  useEffect(() => {
    void useAutomations.getState().load()
  }, [])

  if (!isTauri()) {
    return <p className="text-[12px] text-noir-silver">Automation permissions are available in the desktop app.</p>
  }

  return (
    <div>
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-8 border-b border-noir-line/50 py-4 first:pt-0 last:border-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-noir-paper">{row.title}</p>
            <p className="mt-1 max-w-[52ch] text-[12px] leading-[18px] text-noir-silver">{row.description}</p>
          </div>
          <Toggle label={row.title} checked={permissions[row.key]} onChange={(v) => void useAutomations.getState().setPermission(row.key, v)} />
        </div>
      ))}
    </div>
  )
}
