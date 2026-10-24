import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Info, TriangleAlert } from 'lucide-react'
import { create } from 'zustand'
import { DUR, tween } from '../../lib/motion'

type Tone = 'neutral' | 'success' | 'error'

interface ToastItem {
  id: number
  title: string
  description?: string
  tone: Tone
}

interface ToastStore {
  items: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1

const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items.slice(-3), { ...t, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))

/** Imperative API: `toast.success('Saved')` from anywhere. */
export const toast = {
  show: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'neutral' }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'error' }),
}

const ICONS = { neutral: Info, success: Check, error: TriangleAlert } as const

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const Icon = ICONS[item.tone]

  useEffect(() => {
    const id = window.setTimeout(() => dismiss(item.id), item.tone === 'error' ? 6500 : 4000)
    return () => window.clearTimeout(id)
  }, [dismiss, item.id, item.tone])

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: tween(DUR.base) }}
      exit={{ opacity: 0, x: 16, transition: tween(DUR.fast) }}
      className="pointer-events-auto flex w-[340px] items-start gap-3 rounded-ctl border border-noir-line bg-noir-graphite px-3.5 py-3 shadow-float"
    >
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-noir-ash text-noir-paper">
        <Icon className="size-3" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-5 text-noir-white">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-[12px] leading-[18px] text-noir-mist">{item.description}</p>
        )}
      </div>
    </motion.li>
  )
}

export function ToastViewport() {
  const items = useToastStore((s) => s.items)
  return (
    <ul
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col items-end gap-2"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </ul>
  )
}
