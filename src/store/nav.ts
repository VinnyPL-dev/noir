import { create } from 'zustand'
import type { RouteId } from '../lib/nav'

interface NavState {
  route: RouteId
  go: (route: RouteId) => void
}

export const useNav = create<NavState>((set) => ({
  route: 'home',
  go: (route) => set({ route }),
}))
