import { useStore } from '../lib/store'
import { pct } from '../lib/format'

export function TickerTape({ className = '' }: { className?: string }) {
  const { pilots } = useStore()
  const items = pilots.map((p) => ({ id: p.id, label: p.name, v: p.roi.d30 }))
  const row = [...items, ...items]
  return (
    <div className={`fade-mask-x relative overflow-hidden border-y border-line bg-surface/70 py-2.5 ${className}`}>
      <div className="flex w-max animate-ticker gap-8 whitespace-nowrap">
        {row.map((it, i) => (
          <span key={i} className="flex items-center gap-2 text-[13px]">
            <span className="font-medium text-fg/70">{it.label}</span>
            <span className="tnum" style={{ color: it.v >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
              {pct(it.v)}
            </span>
            <span className="tnum text-[10px] text-muted-2">30D</span>
            <span className="ml-2 text-line-2">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}
