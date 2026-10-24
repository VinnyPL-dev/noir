import { useEffect } from 'react'
import { FolderKanban, ListChecks, NotebookPen, Timer } from 'lucide-react'
import { NativeRequired } from '../../components/shell/NativeRequired'
import { PageContainer, PageHeader } from '../../components/shell/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs } from '../../components/ui/Tabs'
import { TriangleAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useFlow, type FlowTab } from '../../store/flow'
import { useTimer } from '../../store/timer'
import { NotesView } from './NotesView'
import { ProjectsView } from './ProjectsView'
import { TasksView } from './TasksView'
import { TimerView } from './TimerView'

const TABS = [
  { value: 'notes', label: 'Notes', icon: NotebookPen },
  { value: 'tasks', label: 'Tasks', icon: ListChecks },
  { value: 'projects', label: 'Projects', icon: FolderKanban },
  { value: 'timer', label: 'Timer', icon: Timer },
] as const

function Body() {
  const loaded = useFlow((s) => s.loaded)
  const error = useFlow((s) => s.error)
  const tab = useFlow((s) => s.tab)
  const setTab = useFlow((s) => s.setTab)
  const running = useTimer((s) => s.active !== null)

  useEffect(() => {
    void useFlow.getState().load()
  }, [])

  return (
    <PageContainer>
      <PageHeader route="flow" description="Notes, tasks, projects and focus sessions. Everything saves automatically and stays on this PC." />
      <div className="mb-5">
        <Tabs
          label="Flow sections"
          value={tab}
          onChange={(v: FlowTab) => setTab(v)}
          options={TABS.map((t) => ({
            value: t.value,
            ariaLabel: t.label,
            label: (
              <span className="inline-flex items-center gap-2">
                <t.icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t.label}
                {t.value === 'timer' && running && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-label="Timer running" />}
              </span>
            ),
          }))}
        />
      </div>
      {!loaded ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-14 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-3 rounded-ctl border border-noir-line px-3.5 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-noir-mist" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-noir-paper">Couldn't load Flow</p>
            <p className="mt-0.5 text-[12px] text-noir-silver">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void useFlow.getState().load(true)}>Try again</Button>
        </div>
      ) : tab === 'notes' ? (
        <NotesView />
      ) : tab === 'tasks' ? (
        <TasksView />
      ) : tab === 'projects' ? (
        <ProjectsView />
      ) : (
        <TimerView />
      )}
    </PageContainer>
  )
}

export function FlowPage() {
  return (
    <NativeRequired route="flow" description="Notes, tasks, projects and focus sessions." what="Flow saves your notes and tasks to a local database, so it">
      <Body />
    </NativeRequired>
  )
}
