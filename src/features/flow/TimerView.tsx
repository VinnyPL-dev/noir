import { useState } from 'react'
import { Play, Square, Timer as TimerIcon, Trash2, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Tabs } from '../../components/ui/Tabs'
import { Tooltip } from '../../components/ui/Tooltip'
import { useNow } from '../../hooks/useNow'
import { cn } from '../../lib/cn'
import { formatDuration, isToday } from '../../lib/dates'
import { formatClock } from '../../lib/format'
import { useFlow } from '../../store/flow'
import { elapsedSecs, remainingSecs, useTimer, type ActiveTimer } from '../../store/timer'

const PRESETS = [15, 25, 50] as const

function RunningClock({ timer }: { timer: ActiveTimer }) {
  const now = useNow(1000)
  const countdown = timer.mode === 'countdown'
  const shown = countdown ? remainingSecs(timer, now) : elapsedSecs(timer, now)
  const progress = countdown && timer.totalSecs > 0 ? 1 - shown / timer.totalSecs : 0
  return (
    <div>
      <p className="font-mono text-[56px] font-medium leading-none tracking-tight text-noir-white" role="timer" aria-live="off">
        {formatClock(shown)}
      </p>
      {countdown && (
        <div className="mt-5 h-[3px] overflow-hidden rounded-full bg-noir-graphite" role="progressbar" aria-label="Countdown progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="h-full origin-left bg-noir-white transition-transform duration-slow ease-noir" style={{ transform: `scaleX(${progress})`, width: '100%' }} />
        </div>
      )}
    </div>
  )
}

function Setup() {
  const projects = useFlow((s) => s.projects)
  const start = useTimer((s) => s.start)
  const [mode, setMode] = useState<'stopwatch' | 'countdown'>('countdown')
  const [minutes, setMinutes] = useState(25)
  const [custom, setCustom] = useState('')
  const [label, setLabel] = useState('')
  const [projectId, setProjectId] = useState('')

  const customMinutes = Number(custom)
  const effective = custom.trim() ? customMinutes : minutes
  const valid = mode === 'stopwatch' || (Number.isFinite(effective) && effective >= 1 && effective <= 600)

  return (
    <div className="space-y-5">
      <Tabs
        label="Timer type"
        mode="radio"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'countdown', label: 'Countdown' },
          { value: 'stopwatch', label: 'Stopwatch' },
        ]}
      />
      {mode === 'countdown' && (
        <div>
          <span className="nis-label mb-2 block">Length</span>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={!custom.trim() && minutes === m}
                onClick={() => { setMinutes(m); setCustom('') }}
                className={cn(
                  'h-9 rounded-ctl border px-3.5 font-mono text-[12.5px] transition-colors duration-fast ease-noir',
                  !custom.trim() && minutes === m ? 'border-noir-white bg-noir-white text-noir-black' : 'border-noir-line text-noir-mist hover:border-[#4d4d4d] hover:text-noir-white',
                )}
              >
                {m} min
              </button>
            ))}
            <Input
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="Custom"
              aria-label="Custom minutes"
              className="w-[96px] font-mono"
            />
            <span className="text-[12px] text-noir-silver">min</span>
          </div>
          {!valid && <p className="mt-2 text-[12px] text-noir-mist">Enter 1 to 600 minutes.</p>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="nis-label mb-1.5 block">What are you working on?</span>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Optional" />
        </label>
        <label className="block">
          <span className="nis-label mb-1.5 block">Project</span>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
            <option value="">None</option>
            {projects.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </label>
      </div>
      <Button
        variant="primary"
        size="lg"
        icon={<Play className="size-4" />}
        disabled={!valid}
        onClick={() => start({ mode, totalSecs: mode === 'countdown' ? Math.round(effective * 60) : 0, label: label.trim(), projectId: projectId || null })}
      >
        Start {mode === 'countdown' ? `${effective || ''} min` : 'stopwatch'}
      </Button>
    </div>
  )
}

export function TimerView() {
  const active = useTimer((s) => s.active)
  const stop = useTimer((s) => s.stop)
  const discard = useTimer((s) => s.discard)
  const sessions = useFlow((s) => s.sessions)
  const projects = useFlow((s) => s.projects)
  const deleteSession = useFlow((s) => s.deleteSession)

  const todaySecs = sessions.filter((s) => isToday(s.startedAt)).reduce((n, s) => n + s.durationSecs, 0)
  const nameOf = new Map(projects.map((p) => [p.id, p.name]))
  const project = active?.projectId ? nameOf.get(active.projectId) : null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-6">
        <CardHeader icon={TimerIcon} title={active ? (active.mode === 'countdown' ? 'Countdown running' : 'Stopwatch running') : 'New session'} />
        <div className="mt-6">
          {active ? (
            <div className="space-y-6">
              <RunningClock timer={active} />
              {(active.label || project) && (
                <p className="text-[13px] text-noir-mist">
                  {active.label}
                  {active.label && project ? ' · ' : ''}
                  {project}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="primary" icon={<Square className="size-4" />} onClick={() => void stop()}>Stop and save</Button>
                <Button variant="ghost" icon={<X className="size-4" />} onClick={discard}>Discard</Button>
              </div>
            </div>
          ) : (
            <Setup />
          )}
        </div>
      </Card>

      <Card className="flex min-h-0 flex-col p-5">
        <CardHeader title="Today" right={<span className="font-mono text-[13px] text-noir-white">{todaySecs > 0 ? formatDuration(todaySecs) : '—'}</span>} />
        <div className="mt-4 min-h-0 flex-1">
          {sessions.length === 0 ? (
            <EmptyState compact icon={TimerIcon} title="No sessions yet" description="Finished sessions are logged here with their project." />
          ) : (
            <ul className="-mx-2 max-h-[380px] space-y-0.5 overflow-y-auto" aria-label="Recent sessions">
              {sessions.slice(0, 30).map((s) => (
                <li key={s.id} className="group flex items-center gap-3 rounded-ctl px-2 py-2 hover:bg-white/[0.04]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-noir-paper">{s.label || (s.projectId ? (nameOf.get(s.projectId) ?? 'Session') : 'Session')}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-noir-ash">
                      {isToday(s.startedAt) ? 'Today' : new Date(s.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(s.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-noir-mist">{formatDuration(s.durationSecs)}</span>
                  <Tooltip content="Delete session">
                    <Button variant="ghost" size="sm" iconOnly aria-label="Delete session" className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100" onClick={() => void deleteSession(s.id)} icon={<Trash2 className="size-3.5" />} />
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
