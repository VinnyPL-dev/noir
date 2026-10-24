const DAY = 86_400_000

export const startOfDay = (ms: number): number => {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** `YYYY-MM-DD` (what <input type="date"> uses) to local midnight, or null. */
export function dateInputToMs(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
  return Number.isNaN(ms) ? null : ms
}

export function msToDateInput(ms: number | null): string {
  if (ms === null) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later'

export function dueState(due: number, now: number = Date.now()): DueState {
  const diff = Math.round((startOfDay(due) - startOfDay(now)) / DAY)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  return diff <= 3 ? 'soon' : 'later'
}

export function formatDue(due: number, now: number = Date.now()): string {
  const diff = Math.round((startOfDay(due) - startOfDay(now)) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const opts: Intl.DateTimeFormatOptions =
    Math.abs(diff) < 7 ? { weekday: 'short' } : { month: 'short', day: 'numeric' }
  return new Date(due).toLocaleDateString(undefined, opts)
}

/** "1h 25m", "25m", "40s" — for focus totals. */
export function formatDuration(secs: number): string {
  const s = Math.max(0, Math.floor(secs))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${s}s`
}

export const isToday = (ms: number, now: number = Date.now()): boolean => startOfDay(ms) === startOfDay(now)
