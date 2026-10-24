import { memo, useId } from 'react'
import { useElementWidth } from '../../hooks/useElementWidth'
import { cn } from '../../lib/cn'

type Pattern = 'solid' | 'dashed' | 'dotted'
type Tone = 'bright' | 'mid' | 'dim'

export interface ChartSeries {
  label: string
  values: number[]
  pattern?: Pattern
  tone?: Tone
  /** Hatched area under the line. */
  fill?: boolean
}

interface LineChartProps {
  series: readonly ChartSeries[]
  /** Fixed upper bound (e.g. 100 for percentages). Otherwise auto-scaled. */
  max?: number
  /** Floor for the auto-scaled upper bound, so idle charts don't look noisy. */
  minMax?: number
  height?: number
  /** Number of samples the x-axis is sized for. */
  capacity?: number
  ariaLabel: string
  className?: string
}

const TONE: Record<Tone, string> = { bright: '#f2f2f2', mid: '#b5b5b5', dim: '#888888' }
const DASH: Record<Pattern, string | undefined> = { solid: undefined, dashed: '5 4', dotted: '1.5 4' }

/**
 * Monochrome line/area chart. Series are told apart by tone *and* stroke
 * pattern (solid / dashed / dotted), never by hue.
 */
export const LineChart = memo(function LineChart({
  series,
  max,
  minMax = 1,
  height = 96,
  capacity = 60,
  ariaLabel,
  className,
}: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const uid = useId().replace(/:/g, '')
  const w = Math.max(width, 1)
  const pad = 2

  const peak = series.reduce((m, s) => s.values.reduce((a, v) => (v > a ? v : a), m), 0)
  const domain = max ?? Math.max(minMax, peak * 1.15)
  const step = w / (capacity - 1)

  const xy = (value: number, i: number, count: number): [number, number] => {
    const x = (capacity - count + i) * step
    const y = height - pad - (Math.min(value, domain) / domain) * (height - pad * 2)
    return [x, y]
  }

  const linePath = (values: number[]): string =>
    values
      .map((v, i) => {
        const [x, y] = xy(v, i, values.length)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

  const areaPath = (values: number[]): string => {
    const first = xy(0, 0, values.length)[0]
    const last = xy(0, values.length - 1, values.length)[0]
    return `${linePath(values)} L${last.toFixed(1)},${height} L${first.toFixed(1)},${height} Z`
  }

  return (
    <div ref={ref} className={cn('w-full', className)} style={{ height }}>
      {width > 0 && (
        <svg role="img" aria-label={ariaLabel} width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block overflow-visible">
          <defs>
            <pattern id={`hatch-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="#f2f2f2" strokeOpacity="0.13" strokeWidth="1" />
            </pattern>
          </defs>
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1="0"
              x2={w}
              y1={pad + t * (height - pad * 2)}
              y2={pad + t * (height - pad * 2)}
              stroke="#242424"
              strokeWidth="1"
            />
          ))}
          {series.map((s) =>
            s.values.length > 1 ? (
              <g key={s.label}>
                {s.fill && <path d={areaPath(s.values)} fill={`url(#hatch-${uid})`} />}
                <path
                  d={linePath(s.values)}
                  fill="none"
                  stroke={TONE[s.tone ?? 'bright']}
                  strokeWidth="1.5"
                  strokeDasharray={DASH[s.pattern ?? 'solid']}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
            ) : null,
          )}
        </svg>
      )}
    </div>
  )
})

/** Thin horizontal usage bar. Uses transform (scaleX) so updates stay on the compositor. */
export function Meter({ value, className, label }: { value: number; className?: string; label: string }) {
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-noir-graphite', className)}
    >
      <div
        className="h-full origin-left rounded-full bg-noir-paper transition-transform duration-slow ease-noir"
        style={{ transform: `scaleX(${clamped})` }}
      />
    </div>
  )
}

/** Legend swatch that mirrors the stroke pattern used in the chart. */
export function PatternSwatch({ pattern, tone = 'bright' }: { pattern: Pattern; tone?: Tone }) {
  return (
    <svg width="18" height="6" aria-hidden className="shrink-0">
      <line x1="0" x2="18" y1="3" y2="3" stroke={TONE[tone]} strokeWidth="1.5" strokeDasharray={DASH[pattern]} strokeLinecap="round" />
    </svg>
  )
}
