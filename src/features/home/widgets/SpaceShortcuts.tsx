import { useEffect } from 'react'
import { Folder, Globe, LayoutGrid, Link2, Rocket } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { CardHeader } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { describeShortcut, runShortcut } from '../../../lib/launch'
import type { Shortcut } from '../../../lib/types'
import { useNav } from '../../../store/nav'
import { useOrbit } from '../../../store/orbit'
import { selectActiveSpace, useSpaces } from '../../../store/spaces'
import { iconFor } from '../../orbit/icons'

function Row({ shortcut }: { shortcut: Shortcut }) {
  const apps = useOrbit((s) => s.apps)
  const view = describeShortcut(shortcut, apps)
  const Icon = view.app ? iconFor(view.app.icon, view.app.category) : shortcut.kind === 'folder' ? Folder : shortcut.kind === 'url' ? Globe : Link2
  return (
    <li>
      <button
        type="button"
        onClick={() => void runShortcut(shortcut)}
        className="flex h-11 w-full items-center gap-3 rounded-ctl px-2.5 text-left transition-colors duration-fast ease-noir hover:bg-white/[0.05] active:bg-white/[0.08]"
        aria-label={`Open ${view.label}`}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-noir-graphite text-noir-paper">
          <Icon className="size-3.5" strokeWidth={1.6} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={view.missing ? 'block truncate text-[13px] text-noir-silver' : 'block truncate text-[13px] text-noir-paper'}>{view.label}</span>
        </span>
        <span className="max-w-[40%] shrink-0 truncate font-mono text-[10px] text-noir-silver">{view.detail}</span>
      </button>
    </li>
  )
}

/** The active Space's own shortcuts: apps, folders and web links. */
export function SpaceShortcuts() {
  const space = useSpaces(selectActiveSpace)

  useEffect(() => {
    void useOrbit.getState().ensureLoaded(false)
  }, [])

  return (
    <div className="flex h-full flex-col p-5">
      <CardHeader icon={Rocket} title={space ? `${space.name} shortcuts` : 'Shortcuts'} />
      {!space || space.shortcuts.length === 0 ? (
        <EmptyState
          compact
          icon={LayoutGrid}
          title="No shortcuts in this Space"
          description="Add apps, folders and links that belong to this Space."
          action={
            <Button size="sm" variant="outline" onClick={() => useNav.getState().go('spaces')}>
              Edit Spaces
            </Button>
          }
          className="flex-1"
        />
      ) : (
        <ul className="-mx-2 mt-3">
          {space.shortcuts.map((s) => (
            <Row key={s.kind === 'app' ? s.id : s.kind === 'folder' ? s.path : s.url} shortcut={s} />
          ))}
        </ul>
      )}
    </div>
  )
}
