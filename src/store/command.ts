import { create } from 'zustand'

interface CommandState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommand = create<CommandState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}))
