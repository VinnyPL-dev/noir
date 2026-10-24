import { ChevronDown, Settings2 } from 'lucide-react'
import { Dropdown, type MenuItem } from '../ui/Menu'
import { iconOf } from '../../features/spaces/model'
import { useNav } from '../../store/nav'
import { selectActiveSpace, useSpaces } from '../../store/spaces'

/** Always-available Space switcher that lives in the title bar. */
export function SpaceSwitcher() {
  const spaces = useSpaces((s) => s.spaces)
  const active = useSpaces(selectActiveSpace)
  if (!spaces || !active) return null

  const ActiveIcon = iconOf(active.icon)
  const items: MenuItem[] = [
    ...spaces.map((s, i): MenuItem => {
      const Icon = iconOf(s.icon)
      return {
        id: s.id,
        label: s.name,
        icon: <Icon className="size-4" />,
        active: s.id === active.id,
        shortcut: i < 9 ? `Alt ${i + 1}` : undefined,
        onSelect: () => void useSpaces.getState().switchTo(s.id),
      }
    }),
    {
      id: 'manage',
      label: 'Manage spaces…',
      icon: <Settings2 className="size-4" />,
      separatorBefore: true,
      onSelect: () => useNav.getState().go('spaces'),
    },
  ]

  return (
    <Dropdown
      align="end"
      items={items}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Space: ${active.name}. Switch space`}
          className="mr-2 flex h-7 max-w-[180px] items-center gap-2 rounded-ctl border border-noir-line px-2.5 text-[11.5px] text-noir-paper transition-colors duration-fast ease-noir hover:border-[#4d4d4d] hover:bg-white/[0.04]"
        >
          <ActiveIcon className="size-3.5 shrink-0 text-noir-mist" strokeWidth={1.7} aria-hidden />
          <span className="truncate">{active.name}</span>
          <ChevronDown className="size-3 shrink-0 text-noir-silver" aria-hidden />
        </button>
      )}
    />
  )
}
