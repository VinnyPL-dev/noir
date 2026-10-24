import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { cn } from '../../lib/cn'

const FIELD =
  'h-9 w-full rounded-ctl border border-noir-line bg-noir-obsidian px-3 text-[13px] text-noir-paper ' +
  'placeholder:text-noir-ash transition-colors duration-fast ease-noir ' +
  'hover:border-[#4d4d4d] focus:border-noir-mist focus-visible:outline-none'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(FIELD, className)} {...rest} />
  },
)

interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Trailing hint, e.g. a <Kbd>. */
  hint?: ReactNode
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { className, hint, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-noir-silver"
        aria-hidden
      />
      <input ref={ref} type="search" className={cn(FIELD, 'pl-9', hint ? 'pr-12' : '', className)} {...rest} />
      {hint && <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{hint}</span>}
    </div>
  )
})
