import { useRef, useState, type FormEvent } from 'react'
import { open as pickFolder } from '@tauri-apps/plugin-dialog'
import { Archive, ArchiveRestore, Clock3, FolderKanban, FolderOpen, ListChecks, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge, Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Dropdown, type MenuItem } from '../../components/ui/Menu'
import { Modal } from '../../components/ui/Modal'
import { formatDuration } from '../../lib/dates'
import { formatAgo } from '../../lib/format'
import type { Project } from '../../lib/types'
import { useFlow } from '../../store/flow'

async function chooseFolder(): Promise<string | null> {
  try {
    const picked = await pickFolder({ directory: true, multiple: false })
    return typeof picked === 'string' ? picked : null
  } catch {
    return null
  }
}

function ProjectDialog({ project, open, onClose }: { project: Project | null; open: boolean; onClose: () => void }) {
  const add = useFlow((s) => s.addProject)
  const update = useFlow((s) => s.updateProject)
  const [name, setName] = useState(project?.name ?? '')
  const [path, setPath] = useState(project?.path ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const ok = project ? await update(project.id, name, path.trim() || null) : (await add(name, path.trim() || null)) !== null
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      description="A project links a folder, tasks and focus time together."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!name.trim()} onClick={() => void submit()}>
            {project ? 'Save' : 'Create project'}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-3.5">
        <label className="block">
          <span className="nis-label mb-1.5 block">Name</span>
          <Input data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Website redesign" />
        </label>
        <div>
          <span className="nis-label mb-1.5 block">Folder (optional)</span>
          <div className="flex gap-2">
            <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\Users\you\projects\site" aria-label="Project folder" />
            <Button variant="outline" icon={<FolderOpen className="size-4" />} onClick={() => void chooseFolder().then((p) => p && setPath(p))}>
              Browse
            </Button>
          </div>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}

/** Keeps the dialog mounted while it animates out and remounts its fields per project. */
function ProjectModal({ state, onClose }: { state: Project | 'new' | null; onClose: () => void }) {
  const last = useRef<Project | 'new'>('new')
  if (state) last.current = state
  const shown = state ?? last.current
  const key = shown === 'new' ? 'new' : shown.id
  return <ProjectDialog key={key} project={shown === 'new' ? null : shown} open={state !== null} onClose={onClose} />
}

function ProjectCard({ project, tasksOpen, focusSecs, onEdit }: { project: Project; tasksOpen: number; focusSecs: number; onEdit: (p: Project) => void }) {
  const openProject = useFlow((s) => s.openProject)
  const archive = useFlow((s) => s.setProjectArchived)
  const remove = useFlow((s) => s.deleteProject)
  const [confirm, setConfirm] = useState(false)

  const items: MenuItem[] = [
    { id: 'edit', label: 'Edit', icon: <Pencil className="size-4" />, onSelect: () => onEdit(project) },
    { id: 'archive', label: project.archived ? 'Restore' : 'Archive', icon: project.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />, onSelect: () => void archive(project.id, !project.archived) },
    { id: 'delete', label: 'Delete…', icon: <Trash2 className="size-4" />, separatorBefore: true, onSelect: () => setConfirm(true) },
  ]

  return (
    <li>
      <Card interactive className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-noir-white">{project.name}</h3>
            <p className="mt-1 truncate font-mono text-[11px] text-noir-silver" title={project.path ?? undefined}>
              {project.path ?? 'No folder linked'}
            </p>
          </div>
          <Dropdown
            align="end"
            items={items}
            trigger={({ toggle, ref, open }) => (
              <Button ref={ref} variant="ghost" size="sm" iconOnly aria-label={`More options for ${project.name}`} aria-haspopup="menu" aria-expanded={open} onClick={toggle} icon={<MoreHorizontal className="size-4" />} />
            )}
          />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="nis-label flex items-center gap-1.5"><ListChecks className="size-3" aria-hidden />Open tasks</dt>
            <dd className="mt-1 font-mono text-[18px] text-noir-white">{tasksOpen}</dd>
          </div>
          <div>
            <dt className="nis-label flex items-center gap-1.5"><Clock3 className="size-3" aria-hidden />Focus time</dt>
            <dd className="mt-1 font-mono text-[18px] text-noir-white">{focusSecs > 0 ? formatDuration(focusSecs) : '—'}</dd>
          </div>
        </dl>
        <div className="mt-5 flex items-center justify-between gap-3 pt-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-noir-ash">
            {project.archived ? <Badge>Archived</Badge> : project.lastOpened ? `Opened ${formatAgo(project.lastOpened)}` : 'Never opened'}
          </span>
          <Button size="sm" variant="outline" icon={<FolderOpen className="size-3.5" />} disabled={!project.path} onClick={() => void openProject(project.id)}>
            Open folder
          </Button>
        </div>
      </Card>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete “${project.name}”?`}
        description="Its tasks and focus sessions are kept but unlinked. Your folder on disk is not touched."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="primary" data-autofocus onClick={() => { setConfirm(false); void remove(project.id) }}>Delete project</Button>
          </>
        }
      />
    </li>
  )
}

export function ProjectsView() {
  const projects = useFlow((s) => s.projects)
  const tasks = useFlow((s) => s.tasks)
  const sessions = useFlow((s) => s.sessions)
  const [dialog, setDialog] = useState<Project | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const visible = projects.filter((p) => showArchived || !p.archived)
  const archivedCount = projects.filter((p) => p.archived).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-noir-silver">
          {projects.length === 0 ? 'Group tasks, folders and focus time.' : `${visible.length} ${visible.length === 1 ? 'project' : 'projects'}`}
        </p>
        <div className="flex items-center gap-2">
          {archivedCount > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
            </Button>
          )}
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setDialog('new')}>New project</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create one to link a folder, track its tasks and see how much time you spend on it."
            action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setDialog('new')}>New project</Button>}
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {visible.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              tasksOpen={tasks.filter((t) => t.projectId === p.id && !t.done).length}
              focusSecs={sessions.filter((s) => s.projectId === p.id).reduce((n, s) => n + s.durationSecs, 0)}
              onEdit={setDialog}
            />
          ))}
        </ul>
      )}
      <ProjectModal state={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}
