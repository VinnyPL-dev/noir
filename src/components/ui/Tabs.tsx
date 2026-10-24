import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { SPRING } from '../../lib/motion'

export interface TabOption<T extends string> {
  value: T
  label: ReactNode
  /** Plain-text name for screen readers when `label` is not text. */
  ariaLabel?: string
}

interface TabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: readonly TabOption<T>[]
  /** `tabs` for switching views, `radio` for choosing one setting value. */
  mode?: 'tabs' | 'radio'
  size?: 'sm' | 'md'
  label: string
  className?: string
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  mode = 'tabs',
  size = 'md',
  label,
  className,
}: TabsProps<T>) {
  const pillId = useId()
  const isRadio = mode === 'radio'

  return (
    <div
      role={isRadio ? 'radiogroup' : 'tablist'}
      aria-label={label}
      className={cn('inline-flex rounded-ctl border border-noir-line bg-noir-obsidian p-0.5', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role={isRadio ? 'radio' : 'tab'}
            aria-checked={isRadio ? active : undefined}
            aria-selected={isRadio ? undefined : active}
            aria-label={opt.ariaLabel}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative inline-flex items-center justify-center rounded-[8px] font-medium transition-colors duration-fast ease-noir',
              size === 'sm' ? 'h-7 min-w-7 px-2.5 text-[11.5px]' : 'h-8 px-3.5 text-[12.5px]',
              active ? 'text-noir-black' : 'text-noir-mist hover:text-noir-white',
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                transition={SPRING}
                className="absolute inset-0 rounded-[8px] bg-noir-white"
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
