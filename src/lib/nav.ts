import {
  Activity,
  Command,
  FolderClosed,
  House,
  LayoutGrid,
  ListChecks,
  Orbit,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type RouteId =
  | 'home'
  | 'orbit'
  | 'pulse'
  | 'vault'
  | 'flow'
  | 'command'
  | 'spaces'
  | 'settings'

export interface NavItem {
  id: RouteId
  label: string
  descriptor: string
  icon: LucideIcon
  /** Roadmap phase in which this section becomes functional. */
  phase: 2 | 3 | 4 | 5
}

export const NAV: readonly NavItem[] = [
  { id: 'home', label: 'Home', descriptor: 'Overview', icon: House, phase: 2 },
  { id: 'orbit', label: 'Orbit', descriptor: 'Applications', icon: Orbit, phase: 3 },
  { id: 'pulse', label: 'Pulse', descriptor: 'Performance', icon: Activity, phase: 3 },
  { id: 'vault', label: 'Vault', descriptor: 'Files', icon: FolderClosed, phase: 4 },
  { id: 'flow', label: 'Flow', descriptor: 'Productivity', icon: ListChecks, phase: 4 },
  { id: 'command', label: 'Command', descriptor: 'Quick Actions', icon: Command, phase: 4 },
  { id: 'spaces', label: 'Spaces', descriptor: 'Workspaces', icon: LayoutGrid, phase: 4 },
  { id: 'settings', label: 'Settings', descriptor: 'Preferences', icon: Settings, phase: 2 },
] as const

export const NAV_BY_ID = Object.fromEntries(NAV.map((n) => [n.id, n])) as Record<RouteId, NavItem>

export const indexLabel = (id: RouteId): string =>
  String(NAV.findIndex((n) => n.id === id) + 1).padStart(2, '0')
