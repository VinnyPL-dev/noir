import { memo } from 'react'
import { EyeOff, Eye, Ellipsis, Pencil, Play, Star, Trash2 } from 'lucide-react'
import { Dropdown, useContextMenu, type MenuItem } from '../../components/ui/Menu'
import { Tooltip } from '../../components/ui/Tooltip'
import { cn } from '../../lib/cn'
import { formatAgo } from '../../lib/format'
import type { AppRecord } from '../../lib/types'
import { useOrbit } from '../../store/orbit'
import { iconFor } from './icons'

interface AppTileProps {
  app: AppRecord
  onEdit: (app: AppRecord) => void
}

export const AppTile = memo(function AppTile({ app, onEdit }: AppTileProps) {
  const Icon = iconFor(app.icon, app.category)

  const items: MenuItem[] = [
    { id: 'launch', label: 'Launch', icon: <Play className="size-4" />, onSelect: () => void useOrbit.getState().launch(app) },
    {
      id: 'fav',
      label: app.favorite ? 'Remove from favorites' : 'Add to favorites',
      icon: <Star className="size-4" />,
      onSelect: () => void useOrbit.getState().setFavorite(app.id, !app.favorite),
    },
    { id: 'edit', label: 'Category & icon…', icon: <Pencil className="size-4" />, onSelect: () => onEdit(app) },
    app.kind === 'custom'
      ? {
          id: 'remove',
          label: 'Remove from Orbit',
          icon: <Trash2 className="size-4" />,
          separatorBefore: true,
          onSelect: () => void useOrbit.getState().remove(app.id),
        }
      : {
          id: 'hide',
          label: app.hidden ? 'Show in Orbit' : 'Hide from Orbit',
          icon: app.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />,
          separatorBefore: true,
          onSelect: () => void useOrbit.getState().setHidden(app.id, !app.hidden),
        },
  ]

  const { onContextMenu, menu } = useContextMenu(items)

  const meta = [app.category, app.lastLaunched ? `opened ${formatAgo(app.lastLaunched)}` : null].filter(Boolean).join(' · ')

  return (
    <li onContextMenu={onContextMenu} className={cn('group relative', app.hidden && 'opacity-50')}>
      <button
        type="button"
        onClick={() => void useOrbit.getState().launch(app)}
        className={cn(
          'flex w-full items-center gap-3 rounded-card border border-noir-line bg-noir-charcoal p-3.5 text-left shadow-card',
          'transition-[border-color,transform,background-color] duration-base ease-noir',
          'hover:border-[#4a4a4a] hover:bg-[#1d1d1d] active:scale-[0.985]',
        )}
        aria-label={`Launch ${app.name}`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-ctl bg-noir-graphite text-noir-paper">
          <Icon className="size-[18px]" strokeWidth={1.6} aria-hidden />
        </span>
        <span className={cn('min-w-0 flex-1', app.favorite && 'pr-5')}>
          <span className="block truncate text-[13px] font-medium text-noir-paper">{app.name}</span>
          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-noir-silver">{meta}</span>
        </span>
      </button>

      <div
        className={cn(
          'absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-ctl bg-noir-graphite p-0.5 shadow-float transition-opacity duration-fast ease-noir',
          'pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100',
        )}
      >
        <Tooltip content={app.favorite ? 'Unfavorite' : 'Favorite'}>
          <button
            type="button"
            onClick={() => void useOrbit.getState().setFavorite(app.id, !app.favorite)}
            aria-label={app.favorite ? `Remove ${app.name} from favorites` : `Add ${app.name} to favorites`}
            aria-pressed={app.favorite}
            className="grid size-8 place-items-center rounded-ctl text-noir-silver transition-colors duration-fast ease-noir hover:bg-white/[0.06] hover:text-noir-white active:scale-95"
          >
            <Star className={cn('size-4', app.favorite && 'fill-noir-white text-noir-white')} strokeWidth={1.6} />
          </button>
        </Tooltip>
        <Dropdown
          align="end"
          items={items}
          trigger={({ toggle, ref, open }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              aria-label={`More actions for ${app.name}`}
              aria-expanded={open}
              className="grid size-8 place-items-center rounded-ctl text-noir-silver transition-colors duration-fast ease-noir hover:bg-white/[0.06] hover:text-noir-white active:scale-95"
            >
              <Ellipsis className="size-4" strokeWidth={1.6} />
            </button>
          )}
        />
      </div>

      {/* A favorite keeps its star visible even when the row isn't hovered. */}
      {app.favorite && (
        <Star
          className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 fill-noir-mist text-noir-mist transition-opacity duration-fast group-focus-within:opacity-0 group-hover:opacity-0"
          aria-hidden
        />
      )}
      {menu}
    </li>
  )
})
