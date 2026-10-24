import type { ReactNode } from 'react'
import { useWindowControls } from '../../lib/window'
import { NAV_BY_ID } from '../../lib/nav'
import { useNav } from '../../store/nav'
import { cn } from '../../lib/cn'
import { Logo } from '../ui/Logo'
import { SpaceSwitcher } from './SpaceSwitcher'

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
      {children}
    </svg>
  )
}

interface ControlProps {
  label: string
  onClick: () => void
  children: ReactNode
  /** Close button inverts to white instead of the usual red. */
  close?: boolean
}

function Control({ label, onClick, children, close }: ControlProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      tabIndex={-1}
      className={cn(
        'grid h-10 w-[46px] place-items-center text-noir-mist transition-colors duration-fast ease-noir',
        close ? 'hover:bg-noir-white hover:text-noir-black' : 'hover:bg-white/[0.08] hover:text-noir-white',
      )}
    >
      {children}
    </button>
  )
}

export function TitleBar() {
  const route = useNav((s) => s.route)
  const { available, maximized, minimize, toggleMaximize, close } = useWindowControls()
  const current = NAV_BY_ID[route]

  return (
    <header
      data-tauri-drag-region
      className="relative flex h-10 shrink-0 select-none items-center justify-between border-b border-noir-line/60 bg-noir-black"
    >
      {/* Non-interactive children ignore the pointer so the drag region receives it. */}
      <div className="pointer-events-none flex items-center gap-2.5 pl-4 text-noir-white">
        <Logo size={15} />
        <span className="text-[12px] font-semibold tracking-[0.32em]">NOIR</span>
      </div>

      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-noir-silver">
        {current.label}
        <span className="mx-2 text-noir-ash">/</span>
        {current.descriptor}
      </div>

      <div className="flex items-center">
        <SpaceSwitcher />
      {available ? (
        <div className="flex">
          <Control label="Minimize" onClick={minimize}>
            <Glyph>
              <path d="M0 5.5h10" />
            </Glyph>
          </Control>
          <Control label={maximized ? 'Restore' : 'Maximize'} onClick={toggleMaximize}>
            <Glyph>
              {maximized ? (
                <>
                  <rect x="0.5" y="2.5" width="7" height="7" />
                  <path d="M2.5 2.5v-2h7v7h-2" />
                </>
              ) : (
                <rect x="0.5" y="0.5" width="9" height="9" />
              )}
            </Glyph>
          </Control>
          <Control label="Close" onClick={close} close>
            <Glyph>
              <path d="M0 0l10 10M10 0L0 10" />
            </Glyph>
          </Control>
        </div>
      ) : (
        <div className="w-2" />
      )}
      </div>
    </header>
  )
}
