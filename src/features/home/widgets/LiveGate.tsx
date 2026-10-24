import type { ReactNode } from 'react'
import { MonitorOff, TriangleAlert } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { useMonitor } from '../../../store/monitor'

interface LiveGateProps {
  /** True once this widget's own data has arrived. */
  ready: boolean
  skeleton: ReactNode
  children: ReactNode
}

/**
 * Shared loading / error / unavailable handling for widgets backed by native data.
 * No data is ever invented: if the runtime can't supply it, the widget says so.
 */
export function LiveGate({ ready, skeleton, children }: LiveGateProps) {
  const status = useMonitor((s) => s.status)
  const error = useMonitor((s) => s.error)
  const retry = useMonitor((s) => s.retry)

  if (ready) return <>{children}</>

  if (status === 'unavailable') {
    return (
      <EmptyState
        compact
        icon={MonitorOff}
        title="Native runtime not detected"
        description="Live readings come from the NOIR desktop app. Start it with npm run tauri dev."
      />
    )
  }

  if (status === 'error') {
    return (
      <EmptyState
        compact
        icon={TriangleAlert}
        title="Couldn't read system data"
        description={error ?? 'The native layer did not respond.'}
        action={
          <Button size="sm" variant="outline" onClick={retry}>
            Retry
          </Button>
        }
      />
    )
  }

  return <>{skeleton}</>
}
