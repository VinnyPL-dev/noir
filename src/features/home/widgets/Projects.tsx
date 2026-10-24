import { useEffect, useMemo } from 'react'
import { FolderKanban } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { CardHeader } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { formatAgo } from '../../../lib/format'
import { isTauri } from '../../../lib/tauri'
import type { Project } from '../../../lib/types'
import { useFlow } from '../../../store/flow'
import { useNav } from '../../../store/nav'

function goToProjects() {
  useFlow.getState().setTab('projects')
  useNav.getState().go('flow')
}

function Row({ project }: { project: Project }) {
  const detail = project.openTasks > 0 ? `${project.openTasks} open` : project.lastOpened ? formatAgo(project.lastOpened) : ''
  return (
    <li>
      <button
        type="button"
        onClick={() => (project.path ? void useFlow.getState().openProject(project.id) : goToProjects())}
        className="flex h-11 w-full items-center gap-3 rounded-ctl px-2.5 text-left transition-colors duration-fast ease-noir hover:bg-white/[0.05] active:bg-white/[0.08]"
        aria-label={project.path ? `Open ${project.name} folder` : `Show ${project.name} in Flow`}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-noir-graphite text-noir-paper">
          <FolderKanban className="size-3.5" strokeWidth={1.6} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-noir-paper">{project.name}</span>
        {detail && <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-noir-silver">{detail}</span>}
      </button>
    </li>
  )
}

/** Projects from Flow, most recently opened first. */
export function Projects() {
  const loaded = useFlow((s) => s.loaded)
  const projects = useFlow((s) => s.projects)

  useEffect(() => {
    void useFlow.getState().load()
  }, [])

  const recent = useMemo(
    () =>
      projects
        .filter((p) => !p.archived)
        .sort((a, b) => (b.lastOpened ?? b.createdAt) - (a.lastOpened ?? a.createdAt))
        .slice(0, 5),
    [projects],
  )

  return (
    <div className="flex h-full flex-col p-5">
      <CardHeader icon={FolderKanban} title="Recent projects" />
      {!isTauri() ? (
        <EmptyState compact icon={FolderKanban} title="Native runtime not detected" description="Projects live in the NOIR desktop app." className="flex-1" />
      ) : !loaded ? (
        <div className="mt-3 space-y-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : recent.length === 0 ? (
        <EmptyState
          compact
          icon={FolderKanban}
          title="No projects yet"
          description="Add a project in Flow to open its folder from here."
          action={
            <Button size="sm" variant="outline" onClick={goToProjects}>
              Open Flow
            </Button>
          }
          className="flex-1"
        />
      ) : (
        <ul className="-mx-2 mt-3">
          {recent.map((p) => (
            <Row key={p.id} project={p} />
          ))}
        </ul>
      )}
    </div>
  )
}
