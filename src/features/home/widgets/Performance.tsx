import { useEffect } from 'react'
import { Cpu } from 'lucide-react'
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber'
import { CardHeader } from '../../../components/ui/Card'
import { LineChart } from '../../../components/ui/Chart'
import { Meter } from '../../../components/ui/Chart'
import { Skeleton } from '../../../components/ui/Skeleton'
import { formatBytes, percent } from '../../../lib/format'
import { useMonitor } from '../../../store/monitor'
import { usePulse } from '../../../store/pulse'
import { LiveGate } from './LiveGate'

function Metric({
  label,
  value,
  unit,
  detail,
  meter,
}: {
  label: string
  value: number | null
  unit?: string
  detail: string
  meter?: number
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="nis-label">{label}</p>
      <p className="text-[30px] font-semibold leading-8 tracking-tight text-noir-white">
        {value === null ? <span className="text-noir-ash">—</span> : <AnimatedNumber value={value} />}
        {value !== null && unit && <span className="ml-0.5 text-[15px] font-medium text-noir-silver">{unit}</span>}
      </p>
      {meter !== undefined && <Meter value={meter} label={`${label} usage`} />}
      <p className="line-clamp-2 min-h-[18px] text-[12px] leading-[18px] text-noir-silver">{detail}</p>
    </div>
  )
}

function Body() {
  const cpu = useMonitor((s) => s.snapshot?.cpuUsage ?? 0)
  const memUsed = useMonitor((s) => s.snapshot?.memoryUsed ?? 0)
  const memTotal = useMonitor((s) => s.snapshot?.memoryTotal ?? 0)
  const cpuBrand = useMonitor((s) => s.info?.cpuBrand ?? '')
  const cpuHistory = useMonitor((s) => s.cpuHistory)
  const memPct = percent(memUsed, memTotal)
  const gpu = usePulse((s) => s.data?.gpu ?? null)
  const gpuLoad = gpu?.gpus.reduce<number | null>((m, g) => (g.usage === null ? m : m === null ? g.usage : Math.max(m, g.usage)), null) ?? null
  const gpuDetail =
    gpu === null || gpu.status === 'pending'
      ? 'Reading…'
      : gpu.status === 'unavailable'
        ? gpu.source
        : (gpu.gpus[0]?.name ?? 'Graphics adapter')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <Metric label="CPU" value={Math.round(cpu)} unit="%" meter={cpu / 100} detail={cpuBrand || 'Processor'} />
        <Metric
          label="Memory"
          value={Math.round(memPct)}
          unit="%"
          meter={memPct / 100}
          detail={`${formatBytes(memUsed)} of ${formatBytes(memTotal, 0)}`}
        />
        <Metric
          label="GPU"
          value={gpuLoad === null ? null : Math.round(gpuLoad)}
          unit="%"
          meter={gpuLoad === null ? undefined : gpuLoad / 100}
          detail={gpuDetail}
        />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="nis-label">CPU · last 60 s</p>
          <p className="font-mono text-[10px] text-noir-ash">0 – 100 %</p>
        </div>
        <LineChart
          series={[{ label: 'CPU', values: cpuHistory, fill: true }]}
          max={100}
          height={88}
          ariaLabel="CPU usage over the last 60 seconds"
        />
      </div>
    </div>
  )
}

export function Performance() {
  // Light subscription: GPU data only, no process scan.
  useEffect(() => usePulse.getState().acquire(false), [])
  const ready = useMonitor((s) => s.snapshot !== null)
  return (
    <div className="p-5">
      <CardHeader icon={Cpu} title="Performance" />
      <div className="mt-5">
        <LiveGate
          ready={ready}
          skeleton={
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2.5">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-1 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-[88px] w-full" />
            </div>
          }
        >
          <Body />
        </LiveGate>
      </div>
    </div>
  )
}
