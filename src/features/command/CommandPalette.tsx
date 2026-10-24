import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { listen } from '@tauri-apps/api/event'
import { CornerDownLeft, Search } from 'lucide-react'
import { Kbd } from '../../components/ui/Card'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/cn'
import { DUR, popVariants, tween } from '../../lib/motion'
import { isTauri } from '../../lib/tauri'
import { useCommand } from '../../store/command'
import { useFlow } from '../../store/flow'
import { useOrbit } from '../../store/orbit'
import { useSpaces } from '../../store/spaces'
import { useVault } from '../../store/vault'
import { GROUP_ORDER, useCommandItems, type CommandItem } from './useCommandItems'

/** Brings the palette up when the OS-wide shortcut fires (NOIR raises its own window in Rust). */
function useGlobalSummon() {
  useEffect(() => {
    if (!isTauri()) return
    let un: (() => void) | undefined
    let dead = false
    listen('noir:command', () => useCommand.getState().setOpen(true))
      .then((fn) => (dead ? fn() : (un = fn)))
      .catch(() => undefined)
    return () => {
      dead = true
      un?.()
    }
  }, [])
}

function Palette() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const items = useCommandItems(query)
  const listRef = useRef<HTMLUListElement>(null)

  // Make sure every source is loaded; each call is a no-op after the first.
  useEffect(() => {
    void useSpaces.getState().ensureLoaded()
    void useOrbit.getState().ensureLoaded(false)
    void useFlow.getState().load()
    void useVault.getState().load()
  }, [])

  // With a query, list in rank order; with none, group in a fixed order.
  const ordered = useMemo(() => {
    if (query.trim()) return items
    return GROUP_ORDER.flatMap((g) => items.filter((i) => i.group === g))
  }, [items, query])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const close = () => useCommand.getState().setOpen(false)

  const run = (item: CommandItem | undefined) => {
    if (!item) return
    close()
    Promise.resolve()
      .then(() => item.run())
      .catch((e: unknown) => toast.error('That did not work', e instanceof Error ? e.message : undefined))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = ordered.length - 1
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((i) => (i >= last ? 0 : i + 1)))
    else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((i) => (i <= 0 ? last : i - 1)))
    else if (e.key === 'Home') (e.preventDefault(), setActive(0))
    else if (e.key === 'End') (e.preventDefault(), setActive(Math.max(0, last)))
    else if (e.key === 'Enter') (e.preventDefault(), run(ordered[active]))
    else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close())
  }

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-6 pt-[13vh]" onKeyDown={onKeyDown}>
      <motion.div
        className="absolute inset-0 bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: tween(DUR.base) }}
        exit={{ opacity: 0, transition: tween(DUR.fast) }}
        onClick={close}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        variants={popVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="relative w-[640px] max-w-full overflow-hidden rounded-card border border-noir-line bg-noir-charcoal shadow-float"
      >
        <div className="flex items-center gap-3 border-b border-noir-line/70 px-4">
          <Search className="size-4 shrink-0 text-noir-silver" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded
            aria-controls="command-results"
            aria-activedescendant={ordered[active] ? `cmd-${ordered[active].id}` : undefined}
            placeholder="Search apps, spaces, projects, notes, folders… or type to create"
            spellCheck={false}
            autoComplete="off"
            className="h-14 min-w-0 flex-1 bg-transparent text-[14px] text-noir-white placeholder:text-noir-ash focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul id="command-results" ref={listRef} role="listbox" className="max-h-[400px] overflow-y-auto p-2">
          {ordered.length === 0 && (
            <li className="px-3 py-10 text-center text-[13px] text-noir-silver" role="presentation">
              Nothing matches “{query.trim()}”.
            </li>
          )}
          {ordered.map((item, i) => {
            const showHeader = !query.trim() && item.group !== lastGroup
            lastGroup = item.group
            const Icon = item.icon
            const isActive = i === active
            return (
              <Fragment key={item.id}>
                {showHeader && (
                  <li role="presentation" className="nis-label px-3 pb-1 pt-3 first:pt-1">
                    {item.group}
                  </li>
                )}
                <li
                  id={`cmd-${item.id}`}
                  role="option"
                  aria-selected={isActive}
                  data-index={i}
                  onMouseMove={() => !isActive && setActive(i)}
                  onClick={() => run(item)}
                  className={cn('flex h-11 cursor-default items-center gap-3 rounded-ctl px-3 transition-colors duration-fast ease-noir', isActive ? 'bg-white/[0.09]' : '')}
                >
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-[8px]', isActive ? 'bg-noir-white text-noir-black' : 'bg-noir-graphite text-noir-paper')}>
                    <Icon className="size-3.5" strokeWidth={1.7} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-noir-white">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-[11px] text-noir-silver">{item.subtitle}</span>}
                  </span>
                  {query.trim() && <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-noir-ash">{item.group}</span>}
                  {isActive && <CornerDownLeft className="size-3.5 shrink-0 text-noir-mist" aria-hidden />}
                </li>
              </Fragment>
            )
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-noir-line/70 px-4 py-2.5 font-mono text-[10px] text-noir-silver">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> run
          </span>
          <span className="ml-auto">{ordered.length} {ordered.length === 1 ? 'result' : 'results'}</span>
        </div>
      </motion.div>
    </div>
  )
}

/** Mounted once at the app root. */
export function CommandPalette() {
  const open = useCommand((s) => s.open)
  useGlobalSummon()
  return createPortal(<AnimatePresence>{open && <Palette key="palette" />}</AnimatePresence>, document.body)
}
