import { greeting } from '../../../lib/format'
import { useNow } from '../../../hooks/useNow'
import { useMonitor } from '../../../store/monitor'
import { usePrefs } from '../../../store/prefs'
import { selectActiveSpace, selectSpacePrefs, useSpaces } from '../../../store/spaces'

export function Welcome() {
  const now = useNow(30_000)
  const date = new Date(now)
  const stored = usePrefs((s) => s.displayName)
  const osUser = useMonitor((s) => s.session?.username ?? '')
  const hostname = useMonitor((s) => s.info?.hostname ?? '')
  const name = stored || osUser
  const space = useSpaces(selectActiveSpace)
  const tagline = useSpaces(selectSpacePrefs).tagline

  return (
    <div className="flex min-h-[148px] flex-col justify-between p-7">
      <p className="nis-label">
        {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        <span className="mx-2 text-noir-ash">·</span>
        {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </p>
      <div>
        <h2 className="text-[34px] font-semibold leading-[40px] tracking-tight text-noir-white">
          {greeting(date.getHours())}
          {name ? <span className="text-noir-silver">, {name}</span> : null}
        </h2>
        <p className="mt-2 text-[13px] text-noir-silver">
          {space ? <span className="text-noir-mist">{space.name}</span> : null}
          {space && (tagline || hostname) ? <span className="mx-2 text-noir-ash">·</span> : null}
          {tagline || (hostname ? `Signed in to ${hostname}` : '')}
        </p>
      </div>
    </div>
  )
}
