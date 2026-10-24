import { Timer } from 'lucide-react'
import { CardHeader } from '../../../components/ui/Card'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useNow } from '../../../hooks/useNow'
import { formatClock, formatUptime } from '../../../lib/format'
import { useMonitor } from '../../../store/monitor'
import { LiveGate } from './LiveGate'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-noir-line/50 py-2.5 last:border-0">
      <dt className="nis-label shrink-0">{label}</dt>
      <dd className="selectable min-w-0 truncate text-right font-mono text-[12px] text-noir-paper">{value}</dd>
    </div>
  )
}

/** Ticks once per second, so it is kept tiny and isolated. */
function SessionClock({ startedAtMs }: { startedAtMs: number }) {
  const now = useNow(1000)
  return <p className="font-mono text-[28px] font-medium leading-8 tracking-tight text-noir-white">{formatClock((now - startedAtMs) / 1000)}</p>
}

function Body() {
  const session = useMonitor((s) => s.session)
  const info = useMonitor((s) => s.info)
  const uptime = useMonitor((s) => s.snapshot?.uptimeSecs ?? 0)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="nis-label">NOIR session</p>
        {session ? <SessionClock startedAtMs={session.startedAtMs} /> : <p className="text-noir-ash">—</p>}
      </div>
      <dl>
        <Row label="System uptime" value={formatUptime(uptime)} />
        <Row label="Host" value={info?.hostname || '—'} />
        <Row label="OS" value={info?.osVersion || info?.osName || '—'} />
      </dl>
    </div>
  )
}

export function Session() {
  const ready = useMonitor((s) => s.snapshot !== null)
  return (
    <div className="p-5">
      <CardHeader icon={Timer} title="Session" />
      <div className="mt-5">
        <LiveGate
          ready={ready}
          skeleton={
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-24 w-full" />
            </div>
          }
        >
          <Body />
        </LiveGate>
      </div>
    </div>
  )
}
