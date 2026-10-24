import type { ReactNode } from 'react'
import { MonitorOff } from 'lucide-react'
import { PageContainer, PageHeader } from './PageHeader'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { isTauri } from '../../lib/tauri'
import type { RouteId } from '../../lib/nav'

/** Pages that read or change real files and settings need the desktop runtime. */
export function NativeRequired({ route, description, what, children }: { route: RouteId; description: string; what: string; children: ReactNode }) {
  if (isTauri()) return <>{children}</>
  return (
    <PageContainer>
      <PageHeader route={route} description={description} />
      <Card>
        <EmptyState
          icon={MonitorOff}
          title="Native runtime not detected"
          description={`${what} needs the NOIR desktop app. Start it with npm run tauri dev.`}
        />
      </Card>
    </PageContainer>
  )
}
