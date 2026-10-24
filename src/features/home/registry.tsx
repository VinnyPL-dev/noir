import type { ComponentType } from 'react'
import {
  AppWindow,
  Cpu,
  FolderKanban,
  HardDrive,
  Hand,
  LayoutGrid,
  Network as NetworkIcon,
  Star,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { WidgetId, WidgetSize } from './layout'
import { Favorites, RecentApps } from './widgets/OrbitWidgets'
import { Projects } from './widgets/Projects'
import { SpaceShortcuts } from './widgets/SpaceShortcuts'
import { Network } from './widgets/Network'
import { Performance } from './widgets/Performance'
import { QuickActions } from './widgets/QuickActions'
import { Session } from './widgets/Session'
import { Storage } from './widgets/Storage'
import { Welcome } from './widgets/Welcome'

export interface WidgetMeta {
  title: string
  icon: LucideIcon
  sizes: readonly WidgetSize[]
  Component: ComponentType
}

export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  welcome: { title: 'Welcome', icon: Hand, sizes: ['lg', 'full'], Component: Welcome },
  performance: { title: 'Performance', icon: Cpu, sizes: ['md', 'lg', 'full'], Component: Performance },
  session: { title: 'Session', icon: Timer, sizes: ['sm', 'md'], Component: Session },
  network: { title: 'Network', icon: NetworkIcon, sizes: ['sm', 'md', 'lg'], Component: Network },
  storage: { title: 'Storage', icon: HardDrive, sizes: ['md', 'lg', 'full'], Component: Storage },
  'quick-actions': { title: 'Quick actions', icon: Zap, sizes: ['sm', 'md'], Component: QuickActions },
  'recent-apps': { title: 'Recently launched', icon: AppWindow, sizes: ['sm', 'md', 'lg'], Component: RecentApps },
  favorites: { title: 'Favorites', icon: Star, sizes: ['sm', 'md', 'lg'], Component: Favorites },
  projects: { title: 'Recent projects', icon: FolderKanban, sizes: ['sm', 'md', 'lg'], Component: Projects },
  'space-shortcuts': { title: 'Space shortcuts', icon: LayoutGrid, sizes: ['sm', 'md', 'lg'], Component: SpaceShortcuts },
}
