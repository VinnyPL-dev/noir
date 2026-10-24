import {
  BookOpen,
  Briefcase,
  Coffee,
  Code2,
  Gamepad2,
  House,
  LayoutGrid,
  Music,
  Palette,
  Rocket,
  SquareTerminal,
  Star,
  type LucideIcon,
} from 'lucide-react'
import type { Shortcut, SpaceIcon, SpacePrefs } from '../../lib/types'

export const SPACE_ICONS: Record<SpaceIcon, LucideIcon> = {
  grid: LayoutGrid,
  gamepad: Gamepad2,
  code: Code2,
  coffee: Coffee,
  briefcase: Briefcase,
  music: Music,
  palette: Palette,
  book: BookOpen,
  terminal: SquareTerminal,
  rocket: Rocket,
  home: House,
  star: Star,
}

export const SPACE_ICON_KEYS = Object.keys(SPACE_ICONS) as SpaceIcon[]

export const iconOf = (key: string): LucideIcon => SPACE_ICONS[key as SpaceIcon] ?? LayoutGrid

export const DEFAULT_SPACE_PREFS: SpacePrefs = { density: 'comfortable', tagline: '' }

/** Defensive parse of the per-space preferences JSON. */
export function parseSpacePrefs(raw: string | undefined | null): SpacePrefs {
  if (!raw) return DEFAULT_SPACE_PREFS
  try {
    const v = JSON.parse(raw) as Partial<SpacePrefs>
    return {
      density: v.density === 'compact' ? 'compact' : 'comfortable',
      tagline: typeof v.tagline === 'string' ? v.tagline.slice(0, 80) : '',
    }
  } catch {
    return DEFAULT_SPACE_PREFS
  }
}

/** Starting points offered when creating a space. Shortcuts are chosen by the user afterwards. */
export interface SpaceTemplate {
  id: string
  name: string
  icon: SpaceIcon
  description: string
  shortcuts: Shortcut[]
}

export const SPACE_TEMPLATES: readonly SpaceTemplate[] = [
  { id: 'gaming', name: 'Gaming', icon: 'gamepad', description: 'Games, voice chat and performance at a glance.', shortcuts: [] },
  { id: 'development', name: 'Development', icon: 'code', description: 'Editors, project folders and developer tools.', shortcuts: [] },
  { id: 'everyday', name: 'Everyday', icon: 'coffee', description: 'Browser, music, notes and general apps.', shortcuts: [] },
  { id: 'blank', name: 'Blank', icon: 'grid', description: 'Start from nothing.', shortcuts: [] },
]

export const shortcutKey = (s: Shortcut): string =>
  s.kind === 'app' ? `app:${s.id}` : s.kind === 'folder' ? `folder:${s.path}` : `url:${s.url}`
