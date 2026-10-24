import { ClipboardCopy, PanelLeft, SlidersHorizontal, Settings, Zap, type LucideIcon } from 'lucide-react'
import { CardHeader, Kbd } from '../../../components/ui/Card'
import { toast } from '../../../components/ui/Toast'
import { formatBytes, formatUptime } from '../../../lib/format'
import { useMonitor } from '../../../store/monitor'
import { useNav } from '../../../store/nav'
import { usePrefs } from '../../../store/prefs'
import { useDashboardEdit } from '../editState'

interface Action {
  id: string
  label: string
  icon: LucideIcon
  shortcut?: string
  run: () => void
}

export function buildSummary(): string {
  const { info, snapshot } = useMonitor.getState()
  if (!info || !snapshot) return ''
  return [
    `Host: ${info.hostname}`,
    `OS: ${info.osVersion || info.osName}`,
    `CPU: ${info.cpuBrand} (${info.physicalCores ?? '?'} cores / ${info.logicalCores} threads)`,
    `Memory: ${formatBytes(snapshot.memoryUsed)} used of ${formatBytes(snapshot.memoryTotal, 0)}`,
    `Uptime: ${formatUptime(snapshot.uptimeSecs)}`,
  ].join('\n')
}

const ACTIONS: readonly Action[] = [
  { id: 'settings', label: 'Open Settings', icon: Settings, shortcut: 'Ctrl ,', run: () => useNav.getState().go('settings') },
  { id: 'sidebar', label: 'Toggle sidebar', icon: PanelLeft, shortcut: 'Ctrl B', run: () => usePrefs.getState().toggleSidebar() },
  { id: 'customize', label: 'Customize dashboard', icon: SlidersHorizontal, run: () => useDashboardEdit.getState().setEditing(true) },
  {
    id: 'summary',
    label: 'Copy system summary',
    icon: ClipboardCopy,
    run: () => {
      const text = buildSummary()
      if (!text) return toast.error('No system data yet', 'Live readings are not available right now.')
      navigator.clipboard
        .writeText(text)
        .then(() => toast.success('System summary copied'))
        .catch(() => toast.error('Could not access the clipboard'))
    },
  },
]

export function QuickActions() {
  return (
    <div className="p-5">
      <CardHeader icon={Zap} title="Quick actions" />
      <ul className="-mx-2 mt-4 space-y-0.5">
        {ACTIONS.map(({ id, label, icon: Icon, shortcut, run }) => (
          <li key={id}>
            <button
              type="button"
              onClick={run}
              className="flex h-9 w-full items-center gap-3 rounded-ctl px-2.5 text-left text-[13px] text-noir-paper transition-colors duration-fast ease-noir hover:bg-white/[0.05] active:bg-white/[0.08]"
            >
              <Icon className="size-4 shrink-0 text-noir-silver" strokeWidth={1.6} aria-hidden />
              <span className="flex-1 truncate">{label}</span>
              {shortcut && <Kbd>{shortcut}</Kbd>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
