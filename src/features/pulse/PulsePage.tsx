import { useEffect } from 'react'
import { Activity, Cpu, HardDrive, MemoryStick, MonitorOff, Network, Thermometer, Zap } from 'lucide-react'
import { PageContainer, PageHeader } from '../../components/shell/PageHeader'
import { AnimatedNumber } from '../../components/ui/AnimatedNumber'
import { Badge, Card } from '../../components/ui/Card'
import { LineChart, Meter, PatternSwatch } from '../../components/ui/Chart'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { formatBytes, formatRate, formatUptime, percent } from '../../lib/format'
import type { DiskInfo, GpuReading } from '../../lib/types'
import { HISTORY, useMonitor } from '../../store/monitor'
import { usePulse } from '../../store/pulse'
import { ProcessTable } from './ProcessTable'
import { KeyValue, Section, StatTile } from './parts'

const NA = <span className="text-noir-ash">—</span>

// Network history is at 1 Hz, GPU/disk history at 0.5 Hz; both hold 60 samples.
const SPARK = { height: 40, capacity: HISTORY } as const

function CpuTile() {
  const cpu = useMonitor((s) => s.snapshot?.cpuUsage ?? 0)
  const brand = useMonitor((s) => s.info?.cpuBrand ?? '')
  const cores = useMonitor((s) => s.info?.logicalCores ?? 0)
  const history = useMonitor((s) => s.cpuHistory)
  return (
    <StatTile
      icon={Cpu}
      label="CPU"
      value={<AnimatedNumber value={Math.round(cpu)} />}
      unit="%"
      detail={brand ? `${brand}${cores ? ` · ${cores} threads` : ''}` : 'Processor'}
      chart={<LineChart series={[{ label: 'CPU', values: history, fill: true }]} max={100} ariaLabel="CPU usage, last 60 seconds" {...SPARK} />}
    />
  )
}

function MemoryTile() {
  const used = useMonitor((s) => s.snapshot?.memoryUsed ?? 0)
  const total = useMonitor((s) => s.snapshot?.memoryTotal ?? 0)
  const history = useMonitor((s) => s.memHistory)
  const pct = percent(used, total)
  return (
    <StatTile
      icon={MemoryStick}
      label="Memory"
      value={<AnimatedNumber value={Math.round(pct)} />}
      unit="%"
      detail={`${formatBytes(used)} of ${formatBytes(total, 0)}`}
      chart={<LineChart series={[{ label: 'Memory', values: history, fill: true }]} max={100} ariaLabel="Memory usage, last 60 seconds" {...SPARK} />}
    />
  )
}

function busiest(gpus: GpuReading[]): GpuReading | null {
  return gpus.reduce<GpuReading | null>((best, g) => (best === null || (g.usage ?? -1) > (best.usage ?? -1) ? g : best), null)
}

function GpuTile() {
  const gpu = usePulse((s) => s.data?.gpu ?? null)
  const history = usePulse((s) => s.gpuHistory)
  const top = gpu ? busiest(gpu.gpus) : null
  const waiting = gpu === null || gpu.status === 'pending'

  let detail = 'Reading…'
  if (gpu?.status === 'unavailable') detail = gpu.source
  else if (top) detail = top.name

  return (
    <StatTile
      icon={Activity}
      label="GPU"
      value={waiting ? <Skeleton className="mt-1 h-7 w-14" /> : top?.usage != null ? <AnimatedNumber value={Math.round(top.usage)} /> : NA}
      unit={top?.usage != null ? '%' : undefined}
      detail={detail}
      chart={
        history.length > 1 ? (
          <LineChart series={[{ label: 'GPU', values: history, fill: true }]} max={100} ariaLabel="GPU load, last 2 minutes" {...SPARK} />
        ) : undefined
      }
    />
  )
}

function DiskTile() {
  const read = usePulse((s) => s.data?.diskReadPerSec ?? null)
  const write = usePulse((s) => s.data?.diskWritePerSec ?? null)
  const loaded = usePulse((s) => s.data !== null)
  const rh = usePulse((s) => s.diskReadHistory)
  const wh = usePulse((s) => s.diskWriteHistory)
  const known = read !== null && write !== null
  return (
    <StatTile
      icon={HardDrive}
      label="Disk activity"
      value={!loaded ? <Skeleton className="mt-1 h-7 w-24" /> : known ? <span className="text-[22px]">{formatRate(read + write)}</span> : NA}
      detail={known ? `Read ${formatRate(read)} · Write ${formatRate(write)}` : loaded ? 'Windows reported no disk counters.' : 'Reading…'}
      chart={
        rh.length > 1 ? (
          <LineChart
            series={[
              { label: 'Read', values: rh, fill: true, tone: 'bright', pattern: 'solid' },
              { label: 'Write', values: wh, tone: 'mid', pattern: 'dashed' },
            ]}
            minMax={1024 * 1024}
            ariaLabel="Disk read and write throughput, last 2 minutes"
            {...SPARK}
          />
        ) : undefined
      }
    />
  )
}

function CoreBars() {
  const perCore = useMonitor((s) => s.snapshot?.perCore)
  if (!perCore || perCore.length === 0) return <Skeleton className="h-16 w-full" />
  return (
    <div>
      <p className="nis-label mb-3">Per core</p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(perCore.length, 16)}, minmax(0, 1fr))` }}>
        {perCore.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5" title={`Core ${i} · ${Math.round(v)}%`}>
            <div className="flex h-14 w-full items-end overflow-hidden rounded-[4px] bg-noir-graphite">
              <div
                className="h-full w-full origin-bottom bg-noir-paper transition-transform duration-slow ease-noir"
                style={{ transform: `scaleY(${Math.min(1, Math.max(0.02, v / 100))})` }}
              />
            </div>
            <span className="font-mono text-[9px] text-noir-ash">{i}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProcessorSection() {
  const cpuHistory = useMonitor((s) => s.cpuHistory)
  const memHistory = useMonitor((s) => s.memHistory)
  return (
    <Section icon={Cpu} title="Processor & memory" className="lg:col-span-2" right={<span className="font-mono text-[10px] text-noir-ash">last 60 s · 0–100 %</span>}>
      <div className="space-y-6">
        <div>
          <LineChart
            series={[
              { label: 'CPU', values: cpuHistory, fill: true, tone: 'bright', pattern: 'solid' },
              { label: 'Memory', values: memHistory, tone: 'mid', pattern: 'dashed' },
            ]}
            max={100}
            height={120}
            ariaLabel="CPU and memory usage over the last 60 seconds"
          />
          <div className="mt-3 flex items-center gap-4 text-[11px] text-noir-silver">
            <span className="flex items-center gap-2"><PatternSwatch pattern="solid" /> CPU</span>
            <span className="flex items-center gap-2"><PatternSwatch pattern="dashed" tone="mid" /> Memory</span>
          </div>
        </div>
        <CoreBars />
      </div>
    </Section>
  )
}

function NetworkSection() {
  const rx = useMonitor((s) => s.snapshot?.rxPerSec ?? 0)
  const tx = useMonitor((s) => s.snapshot?.txPerSec ?? 0)
  const rxh = useMonitor((s) => s.rxHistory)
  const txh = useMonitor((s) => s.txHistory)
  return (
    <Section icon={Network} title="Network">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="nis-label">Down</p>
            <p className="mt-1.5 truncate font-mono text-[15px] text-noir-white">{formatRate(rx)}</p>
          </div>
          <div className="min-w-0">
            <p className="nis-label">Up</p>
            <p className="mt-1.5 truncate font-mono text-[15px] text-noir-white">{formatRate(tx)}</p>
          </div>
        </div>
        <LineChart
          series={[
            { label: 'Down', values: rxh, fill: true, tone: 'bright', pattern: 'solid' },
            { label: 'Up', values: txh, tone: 'mid', pattern: 'dashed' },
          ]}
          minMax={64 * 1024}
          height={96}
          ariaLabel="Network throughput over the last 60 seconds"
        />
        <div className="flex items-center gap-4 text-[11px] text-noir-silver">
          <span className="flex items-center gap-2"><PatternSwatch pattern="solid" /> Down</span>
          <span className="flex items-center gap-2"><PatternSwatch pattern="dashed" tone="mid" /> Up</span>
        </div>
      </div>
    </Section>
  )
}

function Volume({ disk }: { disk: DiskInfo }) {
  const used = disk.total - disk.available
  const title = disk.name ? `${disk.name} (${disk.mountPoint})` : disk.mountPoint
  return (
    <li className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-medium text-noir-paper">{title}</p>
          <Badge>{disk.kind === 'Unknown' ? disk.fileSystem || 'Disk' : disk.kind}</Badge>
        </div>
        <p className="shrink-0 font-mono text-[11px] text-noir-silver">
          {formatBytes(disk.available)} free of {formatBytes(disk.total, 0)}
        </p>
      </div>
      <Meter value={percent(used, disk.total)} label={`${title} used`} />
    </li>
  )
}

function StorageSection() {
  const storage = useMonitor((s) => s.storage)
  return (
    <Section icon={HardDrive} title="Storage volumes">
      {storage === null ? (
        <Skeleton className="h-16 w-full" />
      ) : storage.length === 0 ? (
        <EmptyState compact icon={HardDrive} title="No volumes reported" description="The system returned no mounted drives." />
      ) : (
        <ul className="space-y-4">
          {storage.map((d) => (
            <Volume key={`${d.mountPoint}-${d.name}`} disk={d} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function SensorsSection() {
  const data = usePulse((s) => s.data)
  const uptime = useMonitor((s) => s.snapshot?.uptimeSecs ?? null)
  const gpus = data?.gpu.gpus ?? []
  const temps = data?.temperatures ?? []
  const gpuTemps = gpus.filter((g) => g.temperature !== null)
  const hasAny = temps.length > 0 || gpuTemps.length > 0

  return (
    <Section icon={Thermometer} title="Sensors" right={uptime !== null ? <Badge>Up {formatUptime(uptime)}</Badge> : undefined}>
      {data === null ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="space-y-4">
          {hasAny ? (
            <dl className="divide-y divide-noir-line/40">
              {gpuTemps.map((g) => (
                <KeyValue key={g.name} label={`${g.name} · temperature`} value={`${Math.round(g.temperature as number)} °C`} />
              ))}
              {gpus.filter((g) => g.powerWatts !== null).map((g) => (
                <KeyValue key={`${g.name}-p`} label={`${g.name} · power`} value={`${(g.powerWatts as number).toFixed(1)} W`} />
              ))}
              {gpus.filter((g) => g.memoryTotal !== null && g.memoryUsed !== null).map((g) => (
                <KeyValue key={`${g.name}-m`} label={`${g.name} · video memory`} value={`${formatBytes(g.memoryUsed as number)} / ${formatBytes(g.memoryTotal as number, 0)}`} />
              ))}
              {temps.map((t) => (
                <KeyValue key={t.label} label={t.label} value={`${Math.round(t.celsius)} °C`} />
              ))}
            </dl>
          ) : (
            <EmptyState
              compact
              icon={Zap}
              title="No temperature sensors exposed"
              description="Windows only shares most CPU and board temperatures with elevated or vendor-specific tools. NOIR shows what the system actually reports and never estimates."
            />
          )}
          {data.gpu.status === 'ok' && <p className="font-mono text-[10px] text-noir-ash">GPU source: {data.gpu.source}</p>}
        </div>
      )}
    </Section>
  )
}

function SystemTag() {
  const info = useMonitor((s) => s.info)
  if (!info) return null
  return (
    <div className="hidden text-right md:block">
      <p className="text-[13px] font-medium text-noir-paper">{info.hostname || 'This PC'}</p>
      <p className="font-mono text-[10px] text-noir-silver">{info.osVersion || info.osName}</p>
    </div>
  )
}

export function PulsePage() {
  const status = useMonitor((s) => s.status)
  const error = useMonitor((s) => s.error)
  const pulseError = usePulse((s) => s.error)

  useEffect(() => usePulse.getState().acquire(true), [])

  return (
    <PageContainer>
      <PageHeader route="pulse" description="Live readings from this machine. Nothing on this page is simulated." actions={<SystemTag />} />
      {status === 'unavailable' ? (
        <Card>
          <EmptyState
            icon={MonitorOff}
            title="Native runtime not detected"
            description="Pulse reads your hardware through the NOIR desktop app. Start it with npm run tauri dev."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {(error || pulseError) && (
            <p role="alert" className="rounded-ctl border border-noir-line px-3.5 py-2.5 text-[12px] text-noir-mist">
              Some readings are interrupted: {pulseError ?? error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CpuTile />
            <MemoryTile />
            <GpuTile />
            <DiskTile />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ProcessorSection />
            <NetworkSection />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StorageSection />
            <SensorsSection />
          </div>
          <ProcessTable />
        </div>
      )}
    </PageContainer>
  )
}
