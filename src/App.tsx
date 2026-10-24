import { Suspense, lazy, useEffect, useRef } from 'react'
import { MotionConfig } from 'motion/react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Sidebar } from './components/shell/Sidebar'
import { TitleBar } from './components/shell/TitleBar'
import { Logo } from './components/ui/Logo'
import { ToastViewport } from './components/ui/Toast'
import { Dashboard } from './features/home/Dashboard'
import { useNativeContextMenuGuard, useReducedMotionFlag, useShortcuts } from './hooks/useGlobalBehavior'
import type { RouteId } from './lib/nav'
import { CommandPalette } from './features/command/CommandPalette'
import { TimerWatcher } from './features/flow/TimerWatcher'
import { Skeleton } from './components/ui/Skeleton'
import { PageContainer } from './components/shell/PageHeader'
import { useSpaces } from './store/spaces'
import { useMonitor } from './store/monitor'
import { useNav } from './store/nav'
import { usePrefs } from './store/prefs'

// Everything except Home loads on first visit, which keeps startup fast.
const OrbitPage = lazy(() => import('./features/orbit/OrbitPage').then((m) => ({ default: m.OrbitPage })))
const PulsePage = lazy(() => import('./features/pulse/PulsePage').then((m) => ({ default: m.PulsePage })))
const FlowPage = lazy(() => import('./features/flow/FlowPage').then((m) => ({ default: m.FlowPage })))
const VaultPage = lazy(() => import('./features/vault/VaultPage').then((m) => ({ default: m.VaultPage })))
const SpacesPage = lazy(() => import('./features/spaces/SpacesPage').then((m) => ({ default: m.SpacesPage })))
const CommandPage = lazy(() => import('./features/command/CommandPage').then((m) => ({ default: m.CommandPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const PAGES: Record<Exclude<RouteId, 'home'>, React.ComponentType> = {
  orbit: OrbitPage,
  pulse: PulsePage,
  flow: FlowPage,
  vault: VaultPage,
  spaces: SpacesPage,
  command: CommandPage,
  settings: SettingsPage,
}

function PageFallback() {
  return (
    <PageContainer>
      <div className="space-y-3" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    </PageContainer>
  )
}

function Page({ route }: { route: RouteId }) {
  if (route === 'home') return <Dashboard />
  const Component = PAGES[route]
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  )
}

function Shell() {
  const route = useNav((s) => s.route)
  const main = useRef<HTMLElement>(null)

  useEffect(() => {
    main.current?.scrollTo({ top: 0 })
  }, [route])

  return (
    <div className="flex h-full flex-col bg-noir-black">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main ref={main} className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {/* CSS-driven page entrance: if the animation never runs, the page is simply visible. */}
          <div key={route} className="page-enter">
            <ErrorBoundary>
              <Page route={route} />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

function Boot() {
  return (
    <div className="grid h-full place-items-center bg-noir-black text-noir-ash">
      <Logo size={28} />
    </div>
  )
}

export default function App() {
  const ready = usePrefs((s) => s.ready)
  const motionPref = usePrefs((s) => s.motionPref)
  const forceReduce = useReducedMotionFlag(motionPref)

  useShortcuts()
  useNativeContextMenuGuard()

  useEffect(() => {
    void usePrefs.getState().hydrate()
  }, [])

  // One polling loop for the whole app; paused automatically while the window is hidden.
  useEffect(() => useMonitor.getState().start(), [])

  // Spaces drive the dashboard, so they load as soon as settings are ready.
  useEffect(() => {
    if (ready) void useSpaces.getState().ensureLoaded()
  }, [ready])

  return (
    <MotionConfig reducedMotion={forceReduce ? 'always' : motionPref === 'full' ? 'never' : 'user'}>
      <ErrorBoundary>{ready ? <Shell /> : <Boot />}</ErrorBoundary>
      {ready && <TimerWatcher />}
      {ready && <CommandPalette />}
      <ToastViewport />
    </MotionConfig>
  )
}
