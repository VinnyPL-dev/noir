import { useMemo } from 'react'
import { Select } from '../../components/ui/Select'
import { useVault } from '../../store/vault'

interface Props {
  value: string | null
  onChange: (path: string) => void
  label: string
}

/** Choose a starting folder from Vault's locations and favorites (plus the current value if it is something else). */
export function ScopePicker({ value, onChange, label }: Props) {
  const roots = useVault((s) => s.roots)
  const favorites = useVault((s) => s.favorites)

  const options = useMemo(() => {
    const map = new Map<string, string>()
    roots.forEach((r) => map.set(r.path, r.label))
    favorites.filter((f) => f.exists).forEach((f) => map.set(f.path, `★ ${f.label}`))
    if (value && !map.has(value)) map.set(value, value)
    return [...map]
  }, [roots, favorites, value])

  return (
    <Select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="min-w-[240px]">
      <option value="" disabled>
        Choose a folder…
      </option>
      {options.map(([path, text]) => (
        <option key={path} value={path}>
          {text}
        </option>
      ))}
    </Select>
  )
}
