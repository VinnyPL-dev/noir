import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

/** Native <select> (keyboard and screen-reader friendly) dressed in the NIS field style. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none rounded-ctl border border-noir-line bg-noir-obsidian pl-3 pr-9 text-[13px] text-noir-paper [color-scheme:dark]',
          'transition-colors duration-fast ease-noir hover:border-[#4d4d4d] focus:border-noir-mist focus-visible:outline-none disabled:opacity-40',
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-noir-silver" aria-hidden />
    </div>
  )
})
