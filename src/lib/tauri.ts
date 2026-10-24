import { invoke } from '@tauri-apps/api/core'

/** True only inside the NOIR desktop runtime (not in a plain browser tab). */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Typed wrapper around `invoke` that normalises every failure into an Error. */
export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('The NOIR native runtime is not available here.')
  }
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    if (typeof error === 'string') throw new Error(error)
    if (error instanceof Error) throw error
    throw new Error('Unknown native error')
  }
}
