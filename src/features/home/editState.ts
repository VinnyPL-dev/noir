import { create } from 'zustand'

/** Whether the dashboard is in customise mode. Not persisted. */
interface EditState {
  editing: boolean
  setEditing: (editing: boolean) => void
}

export const useDashboardEdit = create<EditState>((set) => ({
  editing: false,
  setEditing: (editing) => set({ editing }),
}))
