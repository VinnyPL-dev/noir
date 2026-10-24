import { motion } from 'motion/react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '../../lib/cn'
import { DUR, SPRING, tween } from '../../lib/motion'
import { NAV, indexLabel, type NavItem } from '../../lib/nav'
import { useNav } from '../../store/nav'
import { usePrefs } from '../../store/prefs'
import { useMonitor } from '../../store/monitor'
import { Tooltip } from '../ui/Tooltip'
import { Kbd } from '../ui/Card'

const WIDTH_EXPANDED = 232
const WIDTH_COLLAPSED = 68

function NavButton({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const go = useNav((s) => s.go)
  const Icon = item.icon

  return (
    <Tooltip
      block
      side="right"
      disabled={!collapsed}
      delay={250}
      content={
        <span className="flex items-center gap-2">
          {item.label}
          <Kbd>{`Ctrl ${indexLabel(item.id).replace(/^0/, '')}`}</Kbd>
        </span>
      }
    >
      <button
        type="button"
        onClick={() => go(item.id)}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? `${item.label} — ${item.descriptor}` : undefined}
        className={cn(
          'group/nav relative flex h-10 w-full items-center gap-3 rounded-ctl px-[13px] text-left',
          'transition-colors duration-fast ease-noir',
          active ? 'text-noir-white' : 'text-noir-silver hover:text-noir-paper',
        )}
      >
        {active ? (
          <>
            <motion.span layoutId="nav-active" transition={SPRING} className="absolute inset-0 rounded-ctl bg-noir-graphite" />
            <motion.span
              layoutId="nav-bar"
              transition={SPRING}
              className="absolute bottom-2.5 left-0 top-2.5 w-[2px] rounded-full bg-noir-white"
            />
          </>
        ) : (
          <span className="absolute inset-0 rounded-ctl bg-white/0 transition-colors duration-fast ease-noir group-hover/nav:bg-white/[0.04]" />
        )}
        <Icon className="relative size-[18px] shrink-0" strokeWidth={1.6} aria-hidden />
        <motion.span
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1 }}
          transition={tween(DUR.base)}
          className="relative flex min-w-0 flex-1 items-center justify-between whitespace-nowrap"
        >
          <span className="text-[12px] font-medium uppercase tracking-[0.14em]">{item.label}</span>
          <span className="font-mono text-[10px] text-noir-ash">{indexLabel(item.id)}</span>
        </motion.span>
      </button>
    </Tooltip>
  )
}

/** Small live indicator. Selectors return primitives so it re-renders only when the rounded value changes. */
function StatusIndicator({ collapsed }: { collapsed: boolean }) {
  const status = useMonitor((s) => s.status)
  const cpu = useMonitor((s) => (s.snapshot ? Math.round(s.snapshot.cpuUsage) : null))
  const mem = useMonitor((s) =>
    s.snapshot && s.snapshot.memoryTotal > 0 ? Math.round((s.snapshot.memoryUsed / s.snapshot.memoryTotal) * 100) : null,
  )

  const live = status === 'live'
  const label = live ? 'Live' : status === 'starting' ? 'Connecting' : status === 'error' ? 'Interrupted' : 'Offline'
  const detail =
    live && cpu !== null && mem !== null ? `CPU ${cpu}% · RAM ${mem}%` : status === 'unavailable' ? 'No native runtime' : '—'

  return (
    <Tooltip block side="right" disabled={!collapsed} delay={250} content={`${label} — ${detail}`}>
      <div
        role="status"
        aria-label={`System status: ${label}. ${detail}`}
        className="flex h-10 w-full items-center gap-3 rounded-ctl px-[13px]"
      >
        <span className="grid size-[18px] shrink-0 place-items-center">
          <span
            className={cn(
              'size-[7px] rounded-full',
              live ? 'animate-pulse bg-noir-white' : 'border border-noir-silver bg-transparent',
            )}
          />
        </span>
        <motion.span
          initial={false}
          animate={{ opacity: collapsed ? 0 : 1 }}
          transition={tween(DUR.base)}
          className="flex min-w-0 flex-col whitespace-nowrap leading-tight"
        >
          <span className="nis-label !text-noir-mist">{label}</span>
          <span className="font-mono text-[10px] text-noir-silver">{detail}</span>
        </motion.span>
      </div>
    </Tooltip>
  )
}

export function Sidebar() {
  const route = useNav((s) => s.route)
  const collapsed = usePrefs((s) => s.sidebarCollapsed)
  const toggle = usePrefs((s) => s.toggleSidebar)

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED }}
      transition={{ duration: DUR.slow, ease: [0.22, 1, 0.36, 1] }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-noir-line/60 bg-noir-obsidian"
    >
      <nav aria-label="Primary" className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4">
        <ul className="space-y-1">
          {NAV.filter((n) => n.id !== 'settings').map((item) => (
            <li key={item.id}>
              <NavButton item={item} active={route === item.id} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-noir-line/60 px-3 py-3">
        <NavButton item={NAV.find((n) => n.id === 'settings') as NavItem} active={route === 'settings'} collapsed={collapsed} />
        <StatusIndicator collapsed={collapsed} />
        <Tooltip block side="right" disabled={!collapsed} delay={250} content="Expand sidebar">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="flex h-10 w-full items-center gap-3 rounded-ctl px-[13px] text-noir-silver transition-colors duration-fast ease-noir hover:bg-white/[0.04] hover:text-noir-paper"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px] shrink-0" strokeWidth={1.6} aria-hidden />
            ) : (
              <PanelLeftClose className="size-[18px] shrink-0" strokeWidth={1.6} aria-hidden />
            )}
            <motion.span
              initial={false}
              animate={{ opacity: collapsed ? 0 : 1 }}
              transition={tween(DUR.base)}
              className="flex flex-1 items-center justify-between whitespace-nowrap"
            >
              <span className="text-[12px] font-medium uppercase tracking-[0.14em]">Collapse</span>
              <Kbd>Ctrl B</Kbd>
            </motion.span>
          </button>
        </Tooltip>
      </div>
    </motion.aside>
  )
}
