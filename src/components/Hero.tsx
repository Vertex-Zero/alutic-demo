import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MiniBoard } from './Board'
import { Avatar, btn } from './ui'
import { BlurFade } from './effects'
import { type Pilot } from '../data/pilots'
import { useStore } from '../lib/store'
import { usd } from '../lib/format'

// the famous names people come here to copy, not the bots or baskets
const PEOPLE = ['pelosi', 'buffett', 'burry', 'ackman', 'druckenmiller', 'cohen', 'dalio', 'tuberville', 'khanna']

export function Hero() {
  const { pilots } = useStore()
  const people = pilots.filter((p) => PEOPLE.includes(p.id))
  const top = [
    ...people.filter((p) => p.id === 'pelosi'),
    ...people.filter((p) => p.id !== 'pelosi').sort((a, b) => b.roi.d30 - a.roi.d30),
  ].slice(0, 5)

  return (
    <section className="hero-gradient relative flex min-h-[100svh] flex-col">
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 text-center sm:px-8">
        <div className="min-h-10 flex-1 sm:min-h-14" />

        <BlurFade>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-accent/25 bg-white px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[1.5px] text-accent">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" />
            onchain autopilot · live
          </div>
        </BlurFade>

        <h1 className="mt-7 font-display text-[clamp(2.5rem,7.5vw,5rem)] leading-[1.05] text-navy">
          <BlurFade delay={0.08}>copy the people</BlurFade>
          <BlurFade delay={0.18}>
            <span className="text-accent">who move markets</span>
          </BlurFade>
        </h1>

        <BlurFade delay={0.3}>
          <p className="mx-auto mt-6 max-w-xl text-balance text-[15px] font-semibold leading-7 text-muted sm:text-[17px]">
            Alutic auto-mirrors politicians, hedge-fund legends and AI models into your own wallet through tokenized
            stocks. When they trade, you trade, even while you're asleep.
          </p>
        </BlurFade>

        <BlurFade delay={0.4}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link to="/explore" className={btn('primary', 'h-12 px-6 text-[15px]')}>
              Start copying
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link to="/how-it-works" className={btn('secondary', 'h-12 px-6 text-[15px]')}>
              See the fee math
            </Link>
          </div>
        </BlurFade>

        <BlurFade delay={0.5}>
          <div className="mt-9 flex items-center gap-6 text-[11px] font-extrabold uppercase tracking-[1px] text-muted sm:gap-9 sm:text-xs">
            <span><b className="text-navy">$0</b> / month</span>
            <span className="h-3 w-0.5 rounded bg-line-2" />
            <span><b className="text-navy">$0</b> deposit fee</span>
            <span className="h-3 w-0.5 rounded bg-line-2" />
            <span><b className="text-accent">0.25%</b> per trade</span>
          </div>
        </BlurFade>

        <div className="min-h-10 flex-1 sm:min-h-14" />

        {/* the product, live */}
        <div className="animate-hero-rise relative w-full max-w-4xl pb-12 [animation-delay:550ms] sm:pb-16">
          <AppWindow top={top} />
        </div>
      </div>
    </section>
  )
}

/* ── product window: everything in it is real platform data ────────────── */

interface PlatformStats {
  xstocks: number
  quotes: number
}

function AppWindow({ top }: { top: Pilot[] }) {
  const [stats, setStats] = useState<PlatformStats | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/execution/status').then((r) => r.json()),
      fetch('/api/health').then((r) => r.json()),
    ])
      .then(([venue, health]) =>
        setStats({ xstocks: venue.xstocksResolved ?? 0, quotes: health.prices?.live ?? 0 }),
      )
      .catch(() => {})
  }, [])

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-line bg-white text-left shadow-[0_20px_50px_-24px_rgba(16,18,62,0.22)]">
      {/* title bar */}
      <div className="flex items-center gap-3 border-b-2 border-line bg-paper-2 px-4 py-2.5">
        <span className="flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-[#e0655a]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[#e0b04f]" />
          <i className="h-2.5 w-2.5 rounded-full bg-[#69b076]" />
        </span>
        <span className="tnum mx-auto flex items-center gap-1.5 rounded-lg bg-white px-6 py-1 text-[10px] text-muted">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          alutic.ai
        </span>
        <span className="w-10" />
      </div>

      {/* real platform stats */}
      <div className="grid grid-cols-3 divide-x-2 divide-line border-b-2 border-line bg-white">
        <MockStat label="Tokenized stocks" value={stats ? `${stats.xstocks} live on Solana` : '…'} />
        <MockStat label="Market quotes" value={stats ? `${stats.quotes} live` : '…'} up />
        <MockStat label="Protocol fee" value="0.25% / trade" />
      </div>

      <div className="grid md:grid-cols-[1.05fr_0.95fr]">
        {/* top pilots, real returns */}
        <div className="border-b-2 border-line md:border-b-0 md:border-r-2">
          <div className="flex items-center justify-between border-b-2 border-line px-4 py-2.5 sm:px-5">
            <span className="text-[12px] font-extrabold uppercase tracking-[1px] text-muted-2">The smart money</span>
            <span className="tnum text-[10px] uppercase tracking-[0.14em] text-muted-2">30D · real data</span>
          </div>
          <MiniBoard pilots={top} />
        </div>

        {/* real platform trades */}
        <LiveFeed />
      </div>
    </div>
  )
}

function MockStat({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted-2">{label}</div>
      <div className={`tnum mt-0.5 text-sm sm:text-base ${up ? 't-up' : 'text-fg'}`}>{value}</div>
    </div>
  )
}

interface ActivityItem {
  ticker: string
  assetName: string
  side: 'buy' | 'sell'
  notional: number
  fee: number
  pilotId: string
  at: number
}

/** Real trades executed on the platform, refreshed live. */
function LiveFeed() {
  const { getPilot } = useStore()
  const [items, setItems] = useState<ActivityItem[]>([])

  useEffect(() => {
    const pull = () =>
      fetch('/api/activity')
        .then((r) => r.json())
        .then((d) => Array.isArray(d.activity) && setItems(d.activity.slice(0, 5)))
        .catch(() => {})
    pull()
    const id = setInterval(pull, 6_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between border-b-2 border-line px-4 py-2.5 sm:px-5">
        <span className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[1px] text-muted-2">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" />
          Platform trades
        </span>
        <span className="tnum text-[10px] uppercase tracking-[0.14em] text-muted-2">0.25% / trade</span>
      </div>
      {items.length === 0 ? (
        <div className="flex h-full min-h-[180px] items-center justify-center px-6 py-8 text-center text-xs font-bold leading-5 text-muted-2">
          Autopilot trades appear here the moment they execute.
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden">
          <AnimatePresence initial={false}>
            {items.map((it) => {
              const pilot = getPilot(it.pilotId)
              return (
                <motion.div
                  key={`${it.at}-${it.ticker}-${it.notional}`}
                  initial={{ opacity: 0, y: -14, backgroundColor: 'rgba(0,192,110,0.12)' }}
                  animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,192,110,0)' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 px-4 py-[9px] sm:px-5"
                >
                  {pilot && <Avatar pilot={pilot} size={28} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-fg">
                      <b className={it.side === 'buy' ? 't-up' : 't-down'}>{it.side === 'buy' ? 'Bought' : 'Sold'}</b>{' '}
                      <span className="tnum">{it.ticker}</span>
                    </span>
                    <span className="block truncate text-[11px] text-muted-2">
                      {pilot ? `mirroring ${pilot.name}` : it.assetName}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tnum block text-[13px] text-fg">{usd(it.notional, { decimals: 2 })}</span>
                    <span className="tnum block text-[10px] text-muted-2">fee {usd(it.fee, { decimals: 2 })}</span>
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
