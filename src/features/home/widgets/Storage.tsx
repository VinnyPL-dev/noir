import { HardDrive } from 'lucide-react'
import { Badge, CardHeader } from '../../../components/ui/Card'
import { Meter } from '../../../components/ui/Chart'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { formatBytes, percent } from '../../../lib/format'
import type { DiskInfo } from '../../../lib/types'
import { useMonitor } from '../../../store/monitor'
import { LiveGate } from './LiveGate'

const VISIBLE = 4

function DiskRow({ disk }: { disk: DiskInfo }) {
  const used = disk.total - disk.available
  const pct = percent(used, disk.total)
  const title = disk.name ? `${disk.name} (${disk.mountPoint})` : disk.mountPoint
  return (
    <li className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-medium text-noir-paper">{title}</p>
          <Badge>{disk.kind === 'Unknown' ? disk.fileSystem || 'Disk' : disk.kind}</Badge>
        </div>
        <p className="shrink-0 font-mono text-[11px] text-noir-silver">
          {formatBytes(used)} / {formatBytes(disk.total, 0)}
        </p>
      </div>
      <Meter value={pct / 100} label={`${title} used`} />
    </li>
  )
}

function Body({ disks }: { disks: DiskInfo[] }) {
  if (disks.length === 0) {
    return <EmptyState compact icon={HardDrive} title="No volumes reported" description="The system returned no mounted drives." />
  }
  const totalUsed = disks.reduce((a, d) => a + (d.total - d.available), 0)
  const total = disks.reduce((a, d) => a + d.total, 0)
  const shown = disks.slice(0, VISIBLE)
  const hidden = disks.length - shown.length

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-noir-silver">
        <span className="text-[22px] font-semibold tracking-tight text-noir-white">{formatBytes(totalUsed)}</span> used of{' '}
        {formatBytes(total, 0)} across {disks.length} {disks.length === 1 ? 'volume' : 'volumes'}
      </p>
      <ul className="space-y-4">
        {shown.map((d) => (
          <DiskRow key={d.mountPoint} disk={d} />
        ))}
      </ul>
      {hidden > 0 && <p className="text-[12px] text-noir-silver">+ {hidden} more — full breakdown arrives with Vault.</p>}
    </div>
  )
}

export function Storage() {
  const storage = useMonitor((s) => s.storage)
  return (
    <div className="p-5">
      <CardHeader icon={HardDrive} title="Storage" />
      <div className="mt-5">
        <LiveGate
          ready={storage !== null}
          skeleton={
            <div className="space-y-4">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          }
        >
          <Body disks={storage ?? []} />
        </LiveGate>
      </div>
    </div>
  )
}
