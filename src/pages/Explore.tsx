import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CATEGORIES, type Category, type Pilot } from '../data/pilots'
import { Sparkline } from '../components/Chart'
import { Avatar, CategoryBadge, VerifiedTick, btn } from '../components/ui'
import { SectionLabel } from '../components/Reveal'
import { useStore } from '../lib/store'
import { compact, compactUsd, pct } from '../lib/format'

type Sort = 'd30' | 'd90' | 'all' | 'copiers' | 'sharpe'
const SORTS: { key: Sort; label: string }[] = [
  { key: 'd30', label: '30D return' },
  { key: 'd90', label: '90D return' },
  { key: 'all', label: 'All-time' },
  { key: 'copiers', label: 'Most copied' },
  { key: 'sharpe', label: 'Sharpe' },
]
const MAX_COMPARE = 3

export function Explore() {
  const { isCopying, pilots } = useStore()
  const [cat, setCat] = useState<Category | 'All'>('All')
  const [sort, setSort] = useState<Sort>('d30')
  const [q, setQ] = useState('')
  const [compare, setCompare] = useState<string[]>([])

  const list = useMemo(() => {
    let l = pilots.filter((p) => (cat === 'All' ? true : p.category === cat))
    if (q.trim()) {
      const t = q.toLowerCase()
      l = l.filter((p) => p.name.toLowerCase().includes(t) || p.handle.toLowerCase().includes(t))
    }
    return [...l].sort((a, b) => {
      switch (sort) {
        case 'd30': return b.roi.d30 - a.roi.d30
        case 'd90': return b.roi.d90 - a.roi.d90
        case 'all': return b.roi.all - a.roi.all
        case 'copiers': return b.copiers - a.copiers
        case 'sharpe': return b.sharpe - a.sharpe
      }
    })
  }, [pilots, cat, sort, q])

  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id]))

  const compared = compare.map((id) => pilots.find((p) => p.id === id)!).filter(Boolean)

  return (
    <div className="mx-auto max-w-7xl px-5 pb-32 pt-12 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel>The board</SectionLabel>
          <h1 className="mt-4 font-display text-[clamp(2.2rem,6vw,3.4rem)] font-medium tracking-[-0.01em]">
            Leaderboard
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          <p className="max-w-sm text-right text-sm leading-6 text-muted">
            Public figures, AI models, and community vaults. Tick up to {MAX_COMPARE} to compare, then put your
            autopilot on one. $0/month, 0.25% per trade.
          </p>
          <Link to="/create" className={btn('accent', 'px-5 py-2.5')}>
            + Create your own vault
          </Link>
        </div>
      </div>

      {/* controls */}
      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(['All', ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                cat === c ? 'bg-accent text-white' : 'text-fg/65 hover:bg-fg/5'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-52">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pilots"
              className="w-full rounded-full border border-line bg-surface py-1.5 pl-9 pr-3 text-sm text-fg placeholder:text-muted-2 focus:border-line-2 focus:outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-fg focus:border-line-2 focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key} className="bg-surface">{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* board */}
      <div className="card mt-6 overflow-hidden rounded-2xl">
        {/* header row */}
        <div className="hidden items-center gap-4 border-b border-line px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-2 md:flex">
          <span className="w-6 text-center">#</span>
          <span className="flex-1">Pilot</span>
          <span className="w-20 text-right">30D</span>
          <span className="hidden w-20 text-right lg:block">90D</span>
          <span className="hidden w-20 text-right xl:block">Sharpe</span>
          <span className="hidden w-24 text-right lg:block">Copiers</span>
          <span className="hidden w-20 text-right xl:block">AUM</span>
          <span className="hidden w-16 2xl:block" />
          <span className="w-[120px]" />
        </div>

        <div className="divide-y divide-line">
          {list.map((p, i) => (
            <Row
              key={p.id}
              pilot={p}
              rank={i + 1}
              copying={isCopying(p.id)}
              checked={compare.includes(p.id)}
              disabled={!compare.includes(p.id) && compare.length >= MAX_COMPARE}
              onToggle={() => toggleCompare(p.id)}
            />
          ))}
        </div>

        {list.length === 0 && <div className="p-12 text-center text-muted">No pilots match your filters.</div>}
      </div>

      {/* sticky compare tray */}
      <CompareTray pilots={compared} onClear={() => setCompare([])} onRemove={(id) => toggleCompare(id)} />
    </div>
  )
}

function Row({
  pilot, rank, copying, checked, disabled, onToggle,
}: {
  pilot: Pilot; rank: number; copying: boolean; checked: boolean; disabled: boolean; onToggle: () => void
}) {
  return (
    <div className={`group relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-fg/[0.02] ${checked ? 'bg-accent/[0.045]' : ''}`}>
      <span className="tnum w-6 shrink-0 text-center text-sm text-muted-2">{rank}</span>

      <Link to={`/pilot/${pilot.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar pilot={pilot} size={36} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-fg">{pilot.name}</span>
            {pilot.verified && <VerifiedTick size={12} />}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <CategoryBadge category={pilot.category} />
            <span className="tnum hidden text-[11px] text-muted-2 sm:inline">{pilot.handle}</span>
          </span>
        </span>
      </Link>

      <span className="tnum w-20 shrink-0 text-right text-sm font-medium" style={{ color: pilot.roi.d30 >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
        {pct(pilot.roi.d30)}
      </span>
      <span className="tnum hidden w-20 shrink-0 text-right text-sm lg:block" style={{ color: pilot.roi.d90 >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
        {pct(pilot.roi.d90)}
      </span>
      <span className="tnum hidden w-20 shrink-0 text-right text-sm text-fg/80 xl:block">{pilot.sharpe.toFixed(2)}</span>
      <span className="tnum hidden w-24 shrink-0 text-right text-sm text-fg/80 lg:block">{compact(pilot.copiers)}</span>
      <span className="tnum hidden w-20 shrink-0 text-right text-sm text-fg/80 xl:block">{compactUsd(pilot.aum)}</span>
      <span className="hidden w-16 shrink-0 2xl:block">
        {pilot.spark && pilot.spark.length > 1 && <Sparkline data={pilot.spark} width={64} height={24} />}
      </span>

      <div className="flex w-[120px] shrink-0 items-center justify-end gap-2">
        <button
          onClick={onToggle}
          disabled={disabled}
          title={checked ? 'Remove from compare' : 'Add to compare'}
          className={`grid h-7 w-7 place-items-center rounded-md border text-xs transition-colors ${
            checked ? 'border-accent bg-accent text-paper' : 'border-line text-muted hover:border-line-2 disabled:opacity-30'
          }`}
        >
          {checked ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>
          )}
        </button>
        <Link
          to={`/pilot/${pilot.id}`}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            copying ? 'border border-accent/30 bg-accent/[0.08] text-accent' : 'bg-accent text-white hover:bg-accent-dim'
          }`}
        >
          {copying ? 'Copying' : 'Copy'}
        </Link>
      </div>
    </div>
  )
}

function CompareTray({ pilots, onClear, onRemove }: { pilots: Pilot[]; onClear: () => void; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <AnimatePresence>
      {pilots.length > 0 && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
        >
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-line-2 bg-surface/95 shadow-[0_-16px_50px_-24px_rgba(28,29,21,0.5)] backdrop-blur-xl">
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-line"
                >
                  <div className="grid gap-px bg-line" style={{ gridTemplateColumns: `140px repeat(${pilots.length}, 1fr)` }}>
                    <Cell head>&nbsp;</Cell>
                    {pilots.map((p) => (
                      <Cell key={p.id} head>
                        <span className="truncate font-medium text-fg">{p.name}</span>
                      </Cell>
                    ))}
                    {([
                      ['30D', (p: Pilot) => pct(p.roi.d30), true],
                      ['1Y', (p: Pilot) => pct(p.roi.all), true],
                      ['Max drawdown', (p: Pilot) => pct(p.maxDrawdown, false), false],
                      ['Sharpe', (p: Pilot) => p.sharpe.toFixed(2), false],
                      ['Copiers', (p: Pilot) => compact(p.copiers), false],
                    ] as const).map(([label, fn, colorize]) => (
                      <RowGroup key={label} label={label} pilots={pilots} fn={fn} colorize={colorize} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-sm text-muted">Compare</span>
                <div className="flex min-w-0 gap-1.5 overflow-x-auto">
                  {pilots.map((p) => (
                    <span key={p.id} className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-fg">
                      {p.name}
                      <button onClick={() => onRemove(p.id)} className="text-muted-2 hover:text-down">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={onClear} className={btn('ghost', 'px-3 py-1.5 text-xs')}>Clear</button>
                <button onClick={() => setOpen((o) => !o)} className={btn('primary', 'px-4 py-1.5 text-xs')}>
                  {open ? 'Hide' : 'Compare'} {pilots.length > 1 ? `(${pilots.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Cell({ children, head }: { children: ReactNode; head?: boolean }) {
  return (
    <div className={`bg-surface px-3 py-2.5 text-xs ${head ? 'text-muted-2' : 'text-fg'}`}>{children}</div>
  )
}

function RowGroup({
  label, pilots, fn, colorize,
}: {
  label: string; pilots: Pilot[]; fn: (p: Pilot) => string; colorize: boolean
}) {
  return (
    <>
      <Cell head>{label}</Cell>
      {pilots.map((p) => {
        const val = fn(p)
        const color = colorize ? (val.startsWith('-') ? 'var(--color-down)' : 'var(--color-up)') : undefined
        return (
          <div key={p.id} className="tnum bg-surface px-3 py-2.5 text-xs" style={color ? { color } : undefined}>
            {val}
          </div>
        )
      })}
    </>
  )
}
