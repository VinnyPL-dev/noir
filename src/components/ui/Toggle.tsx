import { cn } from '../../lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-[42px] shrink-0 rounded-full border transition-colors duration-base ease-noir',
        'disabled:pointer-events-none disabled:opacity-40',
        checked ? 'border-noir-white bg-noir-white' : 'border-noir-line bg-noir-graphite',
      )}
    >
      <span
        className={cn(
          'absolute left-[3px] top-[3px] size-[16px] rounded-full transition-[transform,background-color] duration-base ease-noir',
          checked ? 'translate-x-[18px] bg-noir-black' : 'translate-x-0 bg-noir-mist',
        )}
      />
    </button>
  )
}
