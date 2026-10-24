import { create } from 'zustand'
import { toast } from '../components/ui/Toast'
import { call, isTauri } from '../lib/tauri'
import type { Collection, FavFolder, RecentFile, VaultRoot } from '../lib/types'

const message = (e: unknown): string => (e instanceof Error ? e.message : 'Unknown error')

interface VaultState {
  loaded: boolean
  roots: VaultRoot[]
  favorites: FavFolder[]
  recents: RecentFile[]
  collections: Collection[]

  load: (force?: boolean) => Promise<void>
  addFavorite: (path: string) => Promise<void>
  removeFavorite: (path: string) => Promise<void>
  /** Opens a file or folder with Windows and records it in Recent. */
  open: (path: string) => Promise<void>
  reveal: (path: string) => Promise<void>
  clearRecents: () => Promise<void>
  createCollection: (name: string) => Promise<Collection | null>
  renameCollection: (id: string, name: string) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  addToCollection: (id: string, paths: string[]) => Promise<void>
  refreshCollections: () => Promise<void>
}

let loading: Promise<void> | null = null

export const useVault = create<VaultState>((set, get) => ({
  loaded: false,
  roots: [],
  favorites: [],
  recents: [],
  collections: [],

  load: async (force = false) => {
    if (!isTauri()) return
    if (get().loaded && !force) return
    loading ??= (async () => {
      try {
        const [roots, favorites, recents, collections] = await Promise.all([
          call<VaultRoot[]>('vault_roots'),
          call<FavFolder[]>('vault_folder_list'),
          call<RecentFile[]>('vault_recent_list', { limit: 15 }),
          call<Collection[]>('vault_collection_list'),
        ])
        set({ roots, favorites, recents, collections, loaded: true })
      } catch (e) {
        set({ loaded: true })
        toast.error('Could not load Vault', message(e))
      } finally {
        loading = null
      }
    })()
    await loading
  },

  addFavorite: async (path) => {
    try {
      await call<void>('vault_folder_add', { path })
      set({ favorites: await call<FavFolder[]>('vault_folder_list') })
      toast.success('Added to favorites')
    } catch (e) {
      toast.error('Could not add that folder', message(e))
    }
  },
  removeFavorite: async (path) => {
    const before = get().favorites
    set({ favorites: before.filter((f) => f.path !== path) })
    try {
      await call<void>('vault_folder_remove', { path })
    } catch (e) {
      set({ favorites: before })
      toast.error('Could not remove that folder', message(e))
    }
  },

  open: async (path) => {
    try {
      await call<void>('vault_open', { path })
      set({ recents: await call<RecentFile[]>('vault_recent_list', { limit: 15 }) })
    } catch (e) {
      toast.error('Could not open that', message(e))
    }
  },
  reveal: async (path) => {
    try {
      await call<void>('vault_reveal', { path })
    } catch (e) {
      toast.error('Could not show that in Explorer', message(e))
    }
  },
  clearRecents: async () => {
    const before = get().recents
    set({ recents: [] })
    try {
      await call<void>('vault_recent_clear')
    } catch (e) {
      set({ recents: before })
      toast.error('Could not clear recent files', message(e))
    }
  },

  refreshCollections: async () => {
    try {
      set({ collections: await call<Collection[]>('vault_collection_list') })
    } catch {
      /* the list keeps its last known state */
    }
  },
  createCollection: async (name) => {
    try {
      const c = await call<Collection>('vault_collection_create', { name })
      set((s) => ({ collections: [...s.collections, c] }))
      return c
    } catch (e) {
      toast.error('Could not create the collection', message(e))
      return null
    }
  },
  renameCollection: async (id, name) => {
    try {
      await call<void>('vault_collection_rename', { id, name })
      set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)) }))
    } catch (e) {
      toast.error('Could not rename the collection', message(e))
    }
  },
  deleteCollection: async (id) => {
    const before = get().collections
    set({ collections: before.filter((c) => c.id !== id) })
    try {
      await call<void>('vault_collection_delete', { id })
    } catch (e) {
      set({ collections: before })
      toast.error('Could not delete the collection', message(e))
    }
  },
  addToCollection: async (id, paths) => {
    try {
      const added = await call<number>('vault_collection_add', { id, paths })
      await get().refreshCollections()
      toast.success(added === 0 ? 'Already in that collection' : `Added ${added} ${added === 1 ? 'item' : 'items'}`)
    } catch (e) {
      toast.error('Could not add to the collection', message(e))
    }
  },
}))
