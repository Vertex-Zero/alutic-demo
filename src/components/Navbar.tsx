import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Logo } from './ui'
import { usd, shortAddr } from '../lib/format'
import { SHOWCASE_ADDRESS, SHOWCASE_BALANCE } from '../lib/showcase'

const LINKS = [
  { to: '/explore', label: 'Pilots' },
  { to: '/create', label: 'Create' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/dashboard', label: 'Dashboard' },
]

export function Navbar() {
  const { connected, address, balance } = useStore()
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  return (
    <header className="sticky top-0 z-50 animate-fade-down">
      <div className="border-b-2 border-line bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-9">
            <span className="flex items-center gap-2">
              <Logo />
            </span>
            <nav className="hidden items-center gap-1 md:flex">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `rounded-xl px-3.5 py-2 text-[13px] font-extrabold uppercase tracking-[0.5px] transition-colors ${
                      isActive ? 'bg-accent/[0.08] text-accent' : 'text-muted-2 hover:bg-accent/[0.08] hover:text-accent'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <Link to="/dashboard" className="hidden items-center gap-2.5 rounded-xl border-2 border-line py-1.5 pl-3.5 pr-1.5 sm:flex">
              <span className="tnum text-sm text-fg">
                {usd(connected ? balance : SHOWCASE_BALANCE, { decimals: 0 })}
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-accent/[0.1] px-2.5 py-1">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" />
                <span className="tnum text-xs text-accent">{shortAddr(connected ? address : SHOWCASE_ADDRESS)}</span>
              </span>
            </Link>
            <button
              className="grid h-9 w-9 place-items-center rounded-xl text-fg/70 hover:bg-fg/5 md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="animate-fade-down border-b-2 border-line bg-white/95 px-5 py-3 backdrop-blur-xl md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`block rounded-xl px-3 py-2.5 text-sm font-extrabold uppercase tracking-[0.5px] ${
                loc.pathname === l.to ? 'bg-accent/[0.08] text-accent' : 'text-muted'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
