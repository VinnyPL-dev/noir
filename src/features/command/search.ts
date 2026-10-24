// Pure search helpers for the command palette (no React, easy to test).

/**
 * 0 = no match. Higher is better:
 * exact 100 · prefix 90 · word-start 75 · substring 60 · all words present 50 · fuzzy subsequence 20-40.
 */
export function scoreMatch(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const t = text.toLowerCase()
  if (t === q) return 100
  if (t.startsWith(q)) return 90
  if (new RegExp(`[\\s\\-_.\\\\/]${escapeRegExp(q)}`).test(t)) return 75
  if (t.includes(q)) return 60
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length > 1 && words.every((w) => t.includes(w))) return 50
  if (q.length >= 3 && !q.includes(' ')) {
    let at = -1
    let gaps = 0
    for (const ch of q) {
      const next = t.indexOf(ch, at + 1)
      if (next === -1) return 0
      if (at !== -1) gaps += next - at - 1
      at = next
    }
    return Math.max(20, 40 - Math.min(20, gaps))
  }
  return 0
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface Rankable {
  title: string
  keywords?: string
  /** Small tie-breaker, e.g. launch count. */
  boost?: number
}

/** Best of title (full weight) and keywords (slightly lower), plus a capped boost. 0 means "hide". */
export function scoreItem(query: string, item: Rankable): number {
  const q = query.trim()
  if (!q) return 1 + Math.min(item.boost ?? 0, 50) / 100
  const title = scoreMatch(q, item.title)
  const keys = item.keywords ? scoreMatch(q, item.keywords) * 0.8 : 0
  const base = Math.max(title, keys)
  return base === 0 ? 0 : base + Math.min(item.boost ?? 0, 20) / 20
}

/** Stable sort by descending score, dropping non-matches. */
export function rankItems<T extends Rankable>(items: readonly T[], query: string): T[] {
  return items
    .map((item, index) => ({ item, index, score: scoreItem(query, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.item)
}

const WINDOWS_PATH = /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/])/

export const looksLikePath = (q: string): boolean => WINDOWS_PATH.test(q.trim())
export const looksLikeUrl = (q: string): boolean => /^https?:\/\/[^\s"]+$/i.test(q.trim())

const SPECIAL_KEYS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
}

export interface KeyLike {
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/**
 * Turns a key press into a global-shortcut accelerator such as "Ctrl+Shift+Space".
 * Returns null while only modifiers are held, or when no modifier is held (a bare
 * letter would hijack typing system-wide).
 */
export function toAccelerator(e: KeyLike): string | null {
  const mods: string[] = []
  if (e.ctrlKey) mods.push('Ctrl')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey) mods.push('Super')

  let key: string | null = null
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3)
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5)
  else if (/^F(?:[1-9]|1\d|2[0-4])$/.test(e.code)) key = e.code
  else key = SPECIAL_KEYS[e.code] ?? null

  if (!key || mods.length === 0) return null
  return [...mods, key].join('+')
}
