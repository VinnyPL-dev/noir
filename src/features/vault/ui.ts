import { create } from 'zustand'

export type VaultTab = 'browse' | 'storage' | 'duplicates' | 'collections'

interface VaultUi {
  tab: VaultTab
  /** `null` shows the locations overview. */
  browsePath: string | null
  storagePath: string | null
  dupPath: string | null

  setTab: (tab: VaultTab) => void
  browse: (path: string | null) => void
  analyze: (path: string) => void
  findDuplicates: (path: string) => void
}

/** Lets one Vault tab hand a folder to another (e.g. Browse → Storage) without prop drilling. */
export const useVaultUi = create<VaultUi>((set) => ({
  tab: 'browse',
  browsePath: null,
  storagePath: null,
  dupPath: null,
  setTab: (tab) => set({ tab }),
  browse: (path) => set({ browsePath: path, tab: 'browse' }),
  analyze: (path) => set({ storagePath: path, tab: 'storage' }),
  findDuplicates: (path) => set({ dupPath: path, tab: 'duplicates' }),
}))
