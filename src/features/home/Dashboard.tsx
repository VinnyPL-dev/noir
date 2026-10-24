import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Check, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { PageContainer, PageHeader } from '../../components/shell/PageHeader'
import { Button } from '../../components/ui/Button'
import { Dropdown, type MenuItem } from '../../components/ui/Menu'
import { Modal } from '../../components/ui/Modal'
import { toast } from '../../components/ui/Toast'
import { useElementWidth } from '../../hooks/useElementWidth'
import { cn } from '../../lib/cn'
import { DEFAULT_LAYOUT, SIZE_SPAN, addItem, moveItem, removeItem, resizeItem, ALL_WIDGET_IDS, type WidgetId, type WidgetSize } from './layout'
import { selectActiveSpace, selectLayout, selectSpacePrefs, useSpaces } from '../../store/spaces'
import { useDashboardEdit } from './editState'
import { WIDGETS } from './registry'
import { WidgetFrame } from './WidgetFrame'

/**
 * Responsive column spans. The window can shrink to 960 px with the sidebar open,
 * so on narrow content areas widgets pair up (6 + 6) or take the full row.
 */
function spanFor(size: WidgetSize, width: number): number {
  if (width > 0 && width < 640) return 12
  if (width > 0 && width < 900) return size === 'sm' || size === 'md' ? 6 : 12
  return SIZE_SPAN[size]
}

export function Dashboard() {
  const layout = useSpaces(selectLayout)
  const activeId = useSpaces((s) => s.activeId)
  const space = useSpaces(selectActiveSpace)
  const density = useSpaces(selectSpacePrefs).density
  const setLayout = (next: typeof layout) => {
    if (activeId) useSpaces.getState().setLayout(activeId, next)
  }
  const resetLayout = () => {
    if (activeId) useSpaces.getState().setLayout(activeId, null)
  }
  const editing = useDashboardEdit((s) => s.editing)
  const setEditing = useDashboardEdit((s) => s.setEditing)
  const [confirmReset, setConfirmReset] = useState(false)
  const [gridRef, width] = useElementWidth<HTMLDivElement>()

  const hidden = useMemo(
    () => ALL_WIDGET_IDS.filter((id) => !layout.some((i) => i.id === id)),
    [layout],
  )

  const addMenu: MenuItem[] = hidden.map((id) => ({
    id,
    label: WIDGETS[id].title,
    icon: <Plus className="size-4" />,
    onSelect: () => {
      const meta = WIDGETS[id]
      const def = DEFAULT_LAYOUT.find((i) => i.id === id)
      setLayout(addItem(layout, { id, size: def && meta.sizes.includes(def.size) ? def.size : (meta.sizes[0] ?? 'md') }))
    },
  }))

  const remove = (id: WidgetId) => {
    setLayout(removeItem(layout, id))
    toast.show(`${WIDGETS[id].title} removed`, 'Add it back from Customize → Add widget.')
  }

  return (
    <PageContainer>
      <PageHeader
        route="home"
        description={space ? `${space.name} space. Every reading on this page comes from your machine.` : 'Your command center at a glance. Every reading on this page comes from your machine.'}
        actions={
          editing ? (
            <>
              <Dropdown
                align="end"
                items={addMenu}
                trigger={({ toggle, ref, open }) => (
                  <Button ref={ref} variant="outline" icon={<Plus className="size-4" />} disabled={hidden.length === 0} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
                    Add widget
                  </Button>
                )}
              />
              <Button variant="outline" icon={<RotateCcw className="size-4" />} onClick={() => setConfirmReset(true)}>
                Reset
              </Button>
              <Button variant="primary" icon={<Check className="size-4" />} onClick={() => setEditing(false)}>
                Done
              </Button>
            </>
          ) : (
            <Button variant="outline" icon={<SlidersHorizontal className="size-4" />} onClick={() => setEditing(true)}>
              Customize
            </Button>
          )
        }
      />

      <div
        key={activeId ?? 'none'}
        ref={gridRef}
        // When narrow, backfill gaps so rows stay tidy. Disabled while customising so
        // that "move earlier / later" always matches what you see.
        className={cn('page-enter grid grid-cols-12 items-stretch', density === 'compact' ? 'gap-3' : 'gap-4', width > 0 && width < 900 && !editing && 'grid-flow-dense')}
      >
        <AnimatePresence initial={false}>
          {layout.map((item, index) => {
            const meta = WIDGETS[item.id]
            return (
              <WidgetFrame
                key={item.id}
                item={item}
                meta={meta}
                span={spanFor(item.size, width)}
                index={index}
                count={layout.length}
                editing={editing}
                onMove={(d) => setLayout(moveItem(layout, item.id, d))}
                onResize={(s) => setLayout(resizeItem(layout, item.id, s))}
                onRemove={() => remove(item.id)}
                onCustomize={() => setEditing(true)}
              >
                <meta.Component />
              </WidgetFrame>
            )
          })}
        </AnimatePresence>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset dashboard layout?"
        description="Widgets return to their default order and sizes. Removed widgets come back. Your data is not affected."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                resetLayout()
                setConfirmReset(false)
                toast.success('Layout reset')
              }}
            >
              Reset layout
            </Button>
          </>
        }
      />
    </PageContainer>
  )
}
