// Pure layout model for the Home dashboard (no React, no components).

export type WidgetId =
  | 'welcome'
  | 'performance'
  | 'session'
  | 'network'
  | 'storage'
  | 'quick-actions'
  | 'recent-apps'
  | 'favorites'
  | 'projects'
  | 'space-shortcuts'

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full'

/** Column span on the 12-column grid. */
export const SIZE_SPAN: Record<WidgetSize, number> = { sm: 4, md: 6, lg: 8, full: 12 }
export const SIZE_LABEL: Record<WidgetSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  full: 'Full width',
}
export const SIZE_ORDER: readonly WidgetSize[] = ['sm', 'md', 'lg', 'full']

export interface LayoutItem {
  id: WidgetId
  size: WidgetSize
}

export const ALL_WIDGET_IDS: readonly WidgetId[] = [
  'welcome',
  'performance',
  'session',
  'network',
  'storage',
  'quick-actions',
  'recent-apps',
  'favorites',
  'projects',
  'space-shortcuts',
]

/** Treated as immutable. Kept as one stable reference so selectors never return a fresh array. */
export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: 'welcome', size: 'full' },
  { id: 'performance', size: 'lg' },
  { id: 'session', size: 'sm' },
  { id: 'network', size: 'sm' },
  { id: 'storage', size: 'lg' },
  { id: 'quick-actions', size: 'sm' },
  { id: 'recent-apps', size: 'lg' },
  { id: 'favorites', size: 'md' },
  { id: 'projects', size: 'md' },
]

const isWidgetId = (v: unknown): v is WidgetId =>
  typeof v === 'string' && (ALL_WIDGET_IDS as readonly string[]).includes(v)
const isSize = (v: unknown): v is WidgetSize => typeof v === 'string' && v in SIZE_SPAN

/** Defensive parse: unknown ids/sizes are dropped, duplicates removed. */
export function parseLayout(raw: string | undefined): LayoutItem[] | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return null
    const seen = new Set<WidgetId>()
    const items: LayoutItem[] = []
    for (const entry of data as unknown[]) {
      if (typeof entry !== 'object' || entry === null) continue
      const { id, size } = entry as { id?: unknown; size?: unknown }
      if (isWidgetId(id) && isSize(size) && !seen.has(id)) {
        seen.add(id)
        items.push({ id, size })
      }
    }
    return items
  } catch {
    return null
  }
}

export function moveItem(layout: LayoutItem[], id: WidgetId, delta: -1 | 1): LayoutItem[] {
  const from = layout.findIndex((i) => i.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= layout.length) return layout
  const next = layout.slice()
  const [item] = next.splice(from, 1)
  if (item) next.splice(to, 0, item)
  return next
}

export const resizeItem = (layout: LayoutItem[], id: WidgetId, size: WidgetSize): LayoutItem[] =>
  layout.map((i) => (i.id === id ? { ...i, size } : i))

export const removeItem = (layout: LayoutItem[], id: WidgetId): LayoutItem[] =>
  layout.filter((i) => i.id !== id)

export const addItem = (layout: LayoutItem[], item: LayoutItem): LayoutItem[] =>
  layout.some((i) => i.id === item.id) ? layout : [...layout, item]
