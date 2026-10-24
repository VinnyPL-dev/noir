import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Check, CalendarDays, FolderKanban, ListChecks, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge, Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { Tabs } from '../../components/ui/Tabs'
import { Tooltip } from '../../components/ui/Tooltip'
import { cn } from '../../lib/cn'
import { dateInputToMs, dueState, formatDue, msToDateInput } from '../../lib/dates'
import type { Task } from '../../lib/types'
import { useFlow } from '../../store/flow'

type Filter = 'open' | 'done' | 'all'

/** Keeps the last task mounted while the dialog animates out, and remounts the form per task. */
function EditTaskModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const last = useRef<Task | null>(null)
  if (task) last.current = task
  const shown = task ?? last.current
  return shown ? <EditTaskDialog key={shown.id} task={shown} open={task !== null} onClose={onClose} /> : null
}

function EditTaskDialog({ task, open, onClose }: { task: Task; open: boolean; onClose: () => void }) {
  const projects = useFlow((s) => s.projects)
  const update = useFlow((s) => s.updateTask)
  const [title, setTitle] = useState(task.title)
  const [due, setDue] = useState(msToDateInput(task.due))
  const [projectId, setProjectId] = useState(task.projectId ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const ok = await update(task.id, title, projectId || null, dateInputToMs(due))
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!title.trim()} onClick={(e) => void submit(e)}>Save</Button>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-3.5">
        <label className="block">
          <span className="nis-label mb-1.5 block">Task</span>
          <Input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="nis-label mb-1.5 block">Due</span>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="[color-scheme:dark]" />
          </label>
          <label className="block">
            <span className="nis-label mb-1.5 block">Project</span>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
              <option value="">None</option>
              {projects.filter((p) => !p.archived || p.id === task.projectId).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </label>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}

function TaskRow({ task, projectName, onEdit }: { task: Task; projectName: string | null; onEdit: (t: Task) => void }) {
  const setDone = useFlow((s) => s.setTaskDone)
  const setPinned = useFlow((s) => s.setTaskPinned)
  const remove = useFlow((s) => s.deleteTask)
  const state = task.due !== null && !task.done ? dueState(task.due) : null

  return (
    <li className="group flex min-h-[48px] items-center gap-3 rounded-ctl px-3 py-2 transition-colors duration-fast ease-noir hover:bg-white/[0.04]">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
        onClick={() => void setDone(task.id, !task.done)}
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-full border transition-[background-color,border-color,transform] duration-fast ease-noir active:scale-90',
          task.done ? 'border-noir-white bg-noir-white text-noir-black' : 'border-noir-ash hover:border-noir-white',
        )}
      >
        {task.done && <Check className="size-3" strokeWidth={3} aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[13.5px]', task.done ? 'text-noir-silver line-through decoration-noir-ash' : 'text-noir-paper')}>{task.title}</p>
        {(task.due !== null || projectName) && (
          <p className="mt-0.5 flex items-center gap-3 text-[11.5px] text-noir-silver">
            {task.due !== null && (
              <span className={cn('inline-flex items-center gap-1', state === 'overdue' && 'font-medium text-noir-white')}>
                <CalendarDays className="size-3" aria-hidden />
                {formatDue(task.due)}
                {state === 'overdue' && <Badge className="ml-1 border-noir-mist text-noir-paper">Overdue</Badge>}
              </span>
            )}
            {projectName && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <FolderKanban className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{projectName}</span>
              </span>
            )}
          </p>
        )}
      </div>
      {task.pinned && <Pin className="size-3.5 shrink-0 text-noir-mist group-hover:hidden" aria-label="Pinned reminder" />}
      <div className="hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex">
        <Tooltip content={task.pinned ? 'Unpin' : 'Pin as reminder'}>
          <Button variant="ghost" size="sm" iconOnly aria-label={task.pinned ? 'Unpin task' : 'Pin task as reminder'} onClick={() => void setPinned(task.id, !task.pinned)} icon={task.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} />
        </Tooltip>
        <Tooltip content="Edit">
          <Button variant="ghost" size="sm" iconOnly aria-label="Edit task" onClick={() => onEdit(task)} icon={<Pencil className="size-4" />} />
        </Tooltip>
        <Tooltip content="Delete">
          <Button variant="ghost" size="sm" iconOnly aria-label="Delete task" onClick={() => void remove(task.id)} icon={<Trash2 className="size-4" />} />
        </Tooltip>
      </div>
    </li>
  )
}

export function TasksView() {
  const tasks = useFlow((s) => s.tasks)
  const projects = useFlow((s) => s.projects)
  const addTask = useFlow((s) => s.addTask)
  const clearDone = useFlow((s) => s.clearDone)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [projectId, setProjectId] = useState('')
  const [filter, setFilter] = useState<Filter>('open')
  const [projectFilter, setProjectFilter] = useState('')
  const [editing, setEditing] = useState<Task | null>(null)

  const nameOf = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])
  const open = tasks.filter((t) => !t.done)
  const doneCount = tasks.length - open.length
  const overdue = open.filter((t) => t.due !== null && dueState(t.due) === 'overdue').length

  const shown = useMemo(
    () =>
      tasks
        .filter((t) => (filter === 'open' ? !t.done : filter === 'done' ? t.done : true))
        .filter((t) => !projectFilter || (projectFilter === 'none' ? t.projectId === null : t.projectId === projectFilter)),
    [tasks, filter, projectFilter],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const created = await addTask(title, projectId || null, dateInputToMs(due))
    if (created) {
      setTitle('')
      setDue('')
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task and press Enter" aria-label="New task" maxLength={200} />
          </div>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="w-[150px] [color-scheme:dark]" />
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project" className="w-[160px]">
            <option value="">No project</option>
            {projects.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Button type="submit" variant="primary" icon={<Plus className="size-4" />} disabled={!title.trim()}>Add</Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            label="Task filter"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'open', label: `Open · ${open.length}` },
              { value: 'done', label: `Done · ${doneCount}` },
              { value: 'all', label: 'All' },
            ]}
          />
          {projects.length > 0 && (
            <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="Filter by project" className="w-[170px]">
              <option value="">All projects</option>
              <option value="none">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )}
        </div>
        <div className="flex items-center gap-3">
          {overdue > 0 && <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-noir-white">{overdue} overdue</span>}
          {doneCount > 0 && (
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => void clearDone()}>
              Clear completed
            </Button>
          )}
        </div>
      </div>

      <Card className="p-2">
        {shown.length === 0 ? (
          <EmptyState
            compact
            icon={ListChecks}
            title={tasks.length === 0 ? 'Nothing to do yet' : filter === 'done' ? 'Nothing completed yet' : 'All clear'}
            description={tasks.length === 0 ? 'Add your first task above. Pin important ones as reminders.' : 'No tasks match this view.'}
            className="py-10"
          />
        ) : (
          <ul aria-label="Tasks">
            {shown.map((t) => (
              <TaskRow key={t.id} task={t} projectName={t.projectId ? (nameOf.get(t.projectId) ?? null) : null} onEdit={setEditing} />
            ))}
          </ul>
        )}
      </Card>
      <EditTaskModal task={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
