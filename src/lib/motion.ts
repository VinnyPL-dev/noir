import type { Transition, Variants } from 'motion/react'

/** NIS motion language: one easing curve, three durations, no bounce. */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const DUR = {
  fast: 0.12,
  base: 0.18,
  slow: 0.24,
} as const

export const tween = (duration: number = DUR.base): Transition => ({ duration, ease: EASE })

/** Critically-damped spring: fluid, but never overshoots. */
export const SPRING: Transition = { type: 'spring', stiffness: 520, damping: 46, mass: 0.9 }

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: tween(DUR.slow) },
  exit: { opacity: 0, y: -4, transition: tween(DUR.fast) },
}

export const popVariants: Variants = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: tween(DUR.base) },
  exit: { opacity: 0, scale: 0.98, transition: tween(DUR.fast) },
}
