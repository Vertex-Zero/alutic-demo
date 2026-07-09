import { Link } from 'react-router-dom'
import type { Pilot } from '../data/pilots'
import { Sparkline } from './Chart'
import { Avatar } from './ui'
import { compact, pct } from '../lib/format'

/** Compact ranked board used inside the hero mockup and cards. */
export function MiniBoard({ pilots }: { pilots: Pilot[] }) {
  return (
    <div className="divide-y divide-line">
      {pilots.map((p, i) => (
        <Link
          key={p.id}
          to={`/pilot/${p.id}`}
          className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-fg/[0.025] sm:px-5"
        >
          <span className="tnum w-6 shrink-0 text-xs text-muted-2">{String(i + 1).padStart(2, '0')}</span>
          <Avatar pilot={p} size={32} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
            <span className="block truncate text-[11px] text-muted-2">{p.category}</span>
          </span>
          {p.spark && p.spark.length > 1 && <Sparkline data={p.spark} width={64} height={26} />}
          <span
            className="tnum w-16 shrink-0 text-right text-[15px] font-medium"
            style={{ color: p.roi.d30 >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}
          >
            {pct(p.roi.d30)}
          </span>
        </Link>
      ))}
    </div>
  )
}
