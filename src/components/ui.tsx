import { Link } from 'react-router-dom'
import type { Category, Pilot } from '../data/pilots'

export function Logo({ size = 34, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="Alutic home">
      <span
        className="grid place-items-center rounded-xl bg-accent text-white shadow-[0_3px_0_var(--color-accent-shadow)] transition-transform duration-300 group-hover:rotate-[-6deg]"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} aria-hidden>
          <path d="M5 19 L11 5 L13 5 L19 19 L16.4 19 L15.1 15.6 L8.9 15.6 L7.6 19 Z M9.7 13.4 L14.3 13.4 L12 7.6 Z" fill="currentColor" />
        </svg>
      </span>
      {withWord && (
        <span className="font-display text-[22px] text-accent">
          alutic
        </span>
      )}
    </Link>
  )
}

export function CategoryBadge({ category, className = '' }: { category: Category; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-paper-2 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-muted ${className}`}
    >
      {category}
    </span>
  )
}

/** One icon per category, drawn in the brand green on a soft tint. */
function CategoryGlyph({ category, size }: { category: Category; size: number }) {
  const s = { width: size, height: size }
  switch (category) {
    case 'Politician': // capitol columns
      return (
        <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M4 18h16M6 18v-7M10 18v-7M14 18v-7M18 18v-7M3 11h18L12 4z" />
        </svg>
      )
    case 'Hedge Fund': // rising chart
      return (
        <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </svg>
      )
    case 'AI': // sparkle
      return (
        <svg {...s} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
        </svg>
      )
    case 'Index': // flip arrows
      return (
        <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3l4 4-4 4M21 7H7M7 21l-4-4 4-4M3 17h14" />
        </svg>
      )
    case 'Community': // people
      return (
        <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M2.8 19.5c.8-3 3.2-4.7 6.2-4.7s5.4 1.7 6.2 4.7" />
          <circle cx="17.2" cy="9.5" r="2.4" />
          <path d="M15.6 14.6c2.6.2 4.6 1.7 5.4 4.2" />
        </svg>
      )
  }
}

export function Avatar({ pilot, size = 44 }: { pilot: Pilot; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-accent/[0.1] text-accent"
      style={{ width: size, height: size }}
    >
      <CategoryGlyph category={pilot.category} size={size * 0.5} />
    </span>
  )
}

export function VerifiedTick({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="text-blue" aria-label="Verified">
      <path
        fill="currentColor"
        d="M12 1.6l2.3 1.7 2.8-.4 1 2.7 2.5 1.4-.6 2.8 1.4 2.5-1.9 2.1.2 2.8-2.7.8-1.5 2.4-2.7-.7-2.6 1.1-1.8-2.2-2.8-.3-.5-2.8-2.4-1.5.6-2.8-1-2.6 2-2 .1-2.8 2.7-.9z"
      />
      <path fill="#ffffff" d="M9.6 12.2l1.7 1.7 3.4-3.6 1.2 1.1-4.6 4.9-2.9-2.9z" />
    </svg>
  )
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-2">{label}</div>
      <div className="tnum mt-1 text-base text-fg" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  )
}

/**
 * Duolingo-style chunky 3D buttons: flat color, hard bottom shadow,
 * press = drop 4px and lose the shadow.
 */
export function btn(variant: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' = 'primary', extra = '') {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-extrabold uppercase tracking-[0.5px] transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none select-none'
  const v = {
    primary:
      'bg-accent text-white shadow-[0_4px_0_var(--color-accent-shadow)] hover:bg-accent-dim active:translate-y-[4px] active:shadow-none',
    accent:
      'bg-blue text-white shadow-[0_4px_0_var(--color-blue-shadow)] hover:brightness-105 active:translate-y-[4px] active:shadow-none',
    secondary:
      'bg-white text-accent border-2 border-line-2 shadow-[0_4px_0_var(--color-line-2)] hover:bg-paper-2 active:translate-y-[4px] active:shadow-none',
    danger:
      'bg-down text-white shadow-[0_4px_0_var(--color-down-shadow)] hover:brightness-105 active:translate-y-[4px] active:shadow-none',
    ghost: 'text-accent hover:bg-accent/[0.08]',
  }[variant]
  return `${base} ${v} ${extra}`
}
