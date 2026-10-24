import {
  AppWindow,
  BookOpen,
  Camera,
  Calendar,
  Code,
  Cpu,
  FileText,
  Folder,
  Gamepad2,
  Globe,
  Headphones,
  Mail,
  MessageCircle,
  Music,
  Palette,
  Rocket,
  Shield,
  Terminal,
  Video,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { AppCategory } from '../../lib/types'

/** Icons a user can assign to an app. Keys are what gets stored in SQLite. */
export const ICON_CHOICES: Record<string, LucideIcon> = {
  'app-window': AppWindow,
  'gamepad-2': Gamepad2,
  code: Code,
  terminal: Terminal,
  globe: Globe,
  'message-circle': MessageCircle,
  mail: Mail,
  music: Music,
  headphones: Headphones,
  video: Video,
  camera: Camera,
  palette: Palette,
  'file-text': FileText,
  'book-open': BookOpen,
  calendar: Calendar,
  folder: Folder,
  wrench: Wrench,
  cpu: Cpu,
  shield: Shield,
  rocket: Rocket,
}

export const CATEGORY_ICON: Record<AppCategory, LucideIcon> = {
  Games: Gamepad2,
  Development: Code,
  Browsers: Globe,
  Communication: MessageCircle,
  Media: Music,
  Productivity: FileText,
  Utilities: Wrench,
  Other: AppWindow,
}

export const CATEGORIES: readonly AppCategory[] = [
  'Games',
  'Development',
  'Browsers',
  'Communication',
  'Media',
  'Productivity',
  'Utilities',
  'Other',
]

export const iconFor = (icon: string | null, category: AppCategory): LucideIcon =>
  (icon && ICON_CHOICES[icon]) || CATEGORY_ICON[category] || AppWindow
