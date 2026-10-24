import { toast } from '../components/ui/Toast'
import { call } from './tauri'
import type { AppRecord, Shortcut } from './types'
import { useOrbit } from '../store/orbit'
import { useVault } from '../store/vault'

/** Last path segment of a Windows or POSIX path ("C:\\Dev\\noir" -> "noir"). */
export function folderName(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

export interface ShortcutView {
  label: string
  detail: string
  /** App record for app shortcuts, when it is still in the index. */
  app: AppRecord | null
  missing: boolean
}

export function describeShortcut(s: Shortcut, apps: AppRecord[] | null): ShortcutView {
  if (s.kind === 'app') {
    const app = apps?.find((a) => a.id === s.id) ?? null
    return app
      ? { label: app.name, detail: app.category, app, missing: false }
      : { label: apps === null ? 'Loading…' : 'App not found', detail: 'Application', app: null, missing: apps !== null }
  }
  if (s.kind === 'folder') return { label: s.label || folderName(s.path), detail: s.path, app: null, missing: false }
  return { label: s.label || hostOf(s.url), detail: s.url, app: null, missing: false }
}

/** Runs one shortcut. Every failure surfaces as a toast; nothing is silent. */
export async function runShortcut(s: Shortcut): Promise<void> {
  try {
    if (s.kind === 'app') {
      await useOrbit.getState().ensureLoaded(false)
      const app = useOrbit.getState().apps?.find((a) => a.id === s.id)
      if (!app) {
        toast.error('That app is no longer in Orbit', 'Rescan in Orbit, or remove the shortcut.')
        return
      }
      await useOrbit.getState().launch(app)
    } else if (s.kind === 'folder') {
      await useVault.getState().open(s.path)
    } else {
      await call<void>('open_url', { url: s.url })
    }
  } catch (e) {
    toast.error('Could not open that', e instanceof Error ? e.message : undefined)
  }
}
