import { ArrowDown, ArrowUp, Network as NetworkIcon } from 'lucide-react'
import { CardHeader } from '../../../components/ui/Card'
import { LineChart, PatternSwatch } from '../../../components/ui/Chart'
import { Skeleton } from '../../../components/ui/Skeleton'
import { formatRate } from '../../../lib/format'
import { useMonitor } from '../../../store/monitor'
import { LiveGate } from './LiveGate'

function Body() {
  const rx = useMonitor((s) => s.snapshot?.rxPerSec ?? 0)
  const tx = useMonitor((s) => s.snapshot?.txPerSec ?? 0)
  const rxHistory = useMonitor((s) => s.rxHistory)
  const txHistory = useMonitor((s) => s.txHistory)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-noir-silver">
            <ArrowDown className="size-3" aria-hidden />
            <span className="nis-label">Down</span>
          </p>
          <p className="truncate font-mono text-[15px] text-noir-white">{formatRate(rx)}</p>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-noir-silver">
            <ArrowUp className="size-3" aria-hidden />
            <span className="nis-label">Up</span>
          </p>
          <p className="truncate font-mono text-[15px] text-noir-white">{formatRate(tx)}</p>
        </div>
      </div>
      <LineChart
        series={[
          { label: 'Down', values: rxHistory, fill: true, tone: 'bright', pattern: 'solid' },
          { label: 'Up', values: txHistory, tone: 'mid', pattern: 'dashed' },
        ]}
        minMax={64 * 1024}
        height={72}
        ariaLabel="Network download and upload throughput over the last 60 seconds"
      />
      <div className="flex items-center gap-4 text-[11px] text-noir-silver">
        <span className="flex items-center gap-2">
          <PatternSwatch pattern="solid" /> Down
        </span>
        <span className="flex items-center gap-2">
          <PatternSwatch pattern="dashed" tone="mid" /> Up
        </span>
      </div>
    </div>
  )
}

export function Network() {
  const ready = useMonitor((s) => s.snapshot !== null)
  return (
    <div className="p-5">
      <CardHeader icon={NetworkIcon} title="Network" />
      <div className="mt-5">
        <LiveGate
          ready={ready}
          skeleton={
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-[72px] w-full" />
            </div>
          }
        >
          <Body />
        </LiveGate>
      </div>
    </div>
  )
}
