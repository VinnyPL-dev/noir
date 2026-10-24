import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  /** Square button with no label. Always pass `aria-label`. */
  iconOnly?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-noir-white text-noir-black hover:bg-[#dcdcdc]',
  secondary: 'bg-noir-graphite text-noir-paper hover:bg-[#2e2e2e]',
  ghost: 'text-noir-mist hover:bg-noir-graphite hover:text-noir-white',
  outline: 'border border-noir-line text-noir-paper hover:border-[#4d4d4d] hover:bg-white/[0.03]',
}

const SIZES: Record<Size, { base: string; icon: string }> = {
  sm: { base: 'h-8 gap-1.5 px-3 text-[12px]', icon: 'size-8' },
  md: { base: 'h-9 gap-2 px-3.5 text-[13px]', icon: 'size-9' },
  lg: { base: 'h-11 gap-2 px-5 text-[14px]', icon: 'size-11' },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, iconOnly, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-ctl font-medium',
        'transition-[background-color,border-color,color,transform] duration-fast ease-noir',
        'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        iconOnly ? SIZES[size].icon : SIZES[size].base,
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {!iconOnly && children}
      {iconOnly && !icon && children}
    </button>
  )
})
