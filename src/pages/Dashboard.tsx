import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { PILOTS, type Pilot } from '../data/pilots'
import { AreaChart, Sparkline } from '../components/Chart'
import { Avatar, btn } from '../components/ui'
import { NumberTicker } from '../components/effects'
import { Reveal, SectionLabel } from '../components/Reveal'
import { usd, pct, shortAddr, num } from '../lib/format'
import { feeOn } from '../lib/store'
import {
  SHOWCASE_ADDRESS as ADDRESS,
  SHOWCASE_DEPOSIT_ADDRESS as DELEGATE_ADDRESS,
  SHOWCASE_NETWORK as NETWORK,
  SHOWCASE_BALANCE as BALANCE,
  showcaseBalance,
} from '../lib/showcase'

/**
 * Showcase dashboard. Everything on this page is generated locally so it
 * always renders a fully populated portfolio: no wallet, no backend.
 */

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

function walk(seed: number, points: number, drift: number, vol: number): number[] {
  const rand = seeded(seed)
  let v = 100
  const out: number[] = []
  for (let i = 0; i < points; i++) {
    v *= 1 + drift + (rand() - 0.5) * vol
    out.push(v)
  }
  return out
}

const DAYS = 365
const DATES = Array.from({ length: DAYS }, (_, i) => Date.now() - (DAYS - 1 - i) * 86_400_000)

const RANGES = [
  ['7D', 7],
  ['30D', 30],
  ['90D', 90],
  ['All', DAYS],
] as const
type RangeKey = (typeof RANGES)[number][0]

interface FakePosition {
  pilot: Pilot
  allocation: number
  value: number
  tradeCount: number
  feesAccrued: number
  stopLoss: number
  copyMode: 'proportional' | 'fixed'
  spark: number[]
}

function position(
  pilotId: string,
  allocation: number,
  value: number,
  mirrorTrades: number,
  avgMirrorFee: number,
  stopLoss: number,
  sparkSeed: number,
): FakePosition {
  const pilot = PILOTS.find((p) => p.id === pilotId)!
  return {
    pilot,
    allocation,
    value,
    // the entry copy counts as a trade, and its 0.25% fee is in the total
    tradeCount: mirrorTrades + 1,
    feesAccrued: feeOn(allocation) + mirrorTrades * avgMirrorFee,
    stopLoss,
    copyMode: 'proportional',
    spark: walk(sparkSeed, 30, value >= allocation ? 0.002 : -0.001, 0.03),
  }
}

const POSITIONS: FakePosition[] = [
  position('pelosi', 43_618, 50_812.44, 133, 4.0, 15, 7),
  position('buffett', 31_079, 33_571.22, 57, 3.2, 0, 19),
  position('ackman', 18_527, 17_804.61, 24, 2.85, 25, 53),
]

const DEPLOYED = POSITIONS.reduce((s, p) => s + p.allocation, 0)
const POSITIONS_VALUE = POSITIONS.reduce((s, p) => s + p.value, 0)
const PORTFOLIO_VALUE = BALANCE + POSITIONS_VALUE
// the tiles are sums of the position rows, so they always agree
const TRADES_EXECUTED = POSITIONS.reduce((s, p) => s + p.tradeCount, 0)
const FEES_PAID = POSITIONS.reduce((s, p) => s + p.feesAccrued, 0)
// The books, exactly as a user would check them:
//   portfolio = deployed + available + P&L - fees
// P&L is market gains before fees (pill and position rows); fees are
// their own line and get subtracted once.
const GROSS_PNL = POSITIONS_VALUE - DEPLOYED + FEES_PAID
const START_VALUE = PORTFOLIO_VALUE - GROSS_PNL
// trade-only session key: swaps capped at this, can never withdraw
const AUTOPILOT_CAP = 120_000

// Portfolio history in dollars: a seeded walk exponentially bridged so it
// starts at the wallet's starting value and ends exactly at today's
// portfolio value. Every timeframe's P&L reconciles with the account math.
const SERIES = (() => {
  const raw = walk(42, DAYS, 0.0004, 0.024)
  const bridge = Math.log(PORTFOLIO_VALUE / START_VALUE / (raw[DAYS - 1] / raw[0]))
  return raw.map((v, i) => START_VALUE * (v / raw[0]) * Math.exp((bridge * i) / (DAYS - 1)))
})()

interface FakeTrade {
  id: string
  kind: 'copy' | 'mirror' | 'exit' | 'deposit' | 'withdraw'
  side: 'buy' | 'sell'
  ticker: string
  assetName: string
  pilotName: string
  notional: number
  at: number
}

const MIN = 60_000
const trade = (
  minsAgo: number,
  kind: FakeTrade['kind'],
  side: FakeTrade['side'],
  ticker: string,
  assetName: string,
  pilotName: string,
  notional: number,
): FakeTrade => ({
  id: `${kind}-${ticker}-${minsAgo}`,
  kind,
  side,
  ticker,
  assetName,
  pilotName,
  notional,
  at: Date.now() - minsAgo * MIN,
})

const TRADES: FakeTrade[] = [
  trade(3, 'mirror', 'buy', 'NVDAx', 'Nvidia', 'Pelosi Tracker', 2_140.5),
  trade(18, 'mirror', 'sell', 'GOOGLx', 'Alphabet', 'Pelosi Tracker', 1_310.25),
  trade(47, 'mirror', 'buy', 'CMGx', 'Chipotle', 'Bill Ackman', 890.1),
  trade(92, 'mirror', 'buy', 'AAPLx', 'Apple', 'Warren Buffett', 3_260.4),
  trade(140, 'mirror', 'sell', 'NKEx', 'Nike', 'Bill Ackman', 645.8),
  trade(210, 'mirror', 'buy', 'AVGOx', 'Broadcom', 'Pelosi Tracker', 1_775.6),
  trade(370, 'mirror', 'sell', 'OXYx', 'Occidental', 'Warren Buffett', 1_120.35),
  trade(540, 'mirror', 'buy', 'MSFTx', 'Microsoft', 'Pelosi Tracker', 2_480.0),
  trade(760, 'mirror', 'buy', 'HLTx', 'Hilton', 'Bill Ackman', 705.9),
  trade(1_150, 'mirror', 'sell', 'TEMx', 'Tempus AI', 'Pelosi Tracker', 980.45),
  trade(2_300, 'mirror', 'buy', 'KOx', 'Coca-Cola', 'Warren Buffett', 1_540.7),
  trade(95 * 1_440, 'copy', 'buy', 'PORTx', 'Portfolio basket', 'Bill Ackman', POSITIONS[2].allocation),
  trade(213 * 1_440 - 260, 'copy', 'buy', 'PORTx', 'Portfolio basket', 'Warren Buffett', POSITIONS[1].allocation),
  trade(213 * 1_440, 'deposit', 'buy', 'USDC', 'Autopilot cap raised', 'Wallet', AUTOPILOT_CAP),
  trade(364 * 1_440 - 310, 'copy', 'buy', 'PORTx', 'Portfolio basket', 'Pelosi Tracker', POSITIONS[0].allocation),
  trade(364 * 1_440, 'deposit', 'buy', 'USDC', 'Autopilot authorized · cap set', 'Wallet', 60_000),
]

const VAULT = {
  name: 'Blue Chip Momentum',
  tagline: 'Mega-cap quality names with a momentum tilt, rebalanced weekly.',
  roi30: 8.7,
  copiers: 312,
  aum: 1_240_000,
  // creator gets half of every copier trade fee; entry fees alone on
  // $1.24M copied are 0.25% x 1.24M / 2 = $1,550, plus mirror-fee share
  earnedUsd: 2_431.77,
}

/** Mirrored trades stream in every so often, like the live autopilot. */
const LIVE_POOL: [string, string, string][] = [
  ['NVDAx', 'Nvidia', 'Pelosi Tracker'],
  ['MSFTx', 'Microsoft', 'Pelosi Tracker'],
  ['AVGOx', 'Broadcom', 'Pelosi Tracker'],
  ['AAPLx', 'Apple', 'Warren Buffett'],
  ['KOx', 'Coca-Cola', 'Warren Buffett'],
  ['CMGx', 'Chipotle', 'Bill Ackman'],
  ['HLTx', 'Hilton', 'Bill Ackman'],
]

function liveTrade(): FakeTrade {
  const [ticker, assetName, pilotName] = LIVE_POOL[Math.floor(Math.random() * LIVE_POOL.length)]
  const side = Math.random() < 0.68 ? 'buy' : 'sell'
  const notional = Math.round((300 + Math.random() * 900) * 100) / 100
  return {
    id: `live-${Date.now()}`,
    kind: 'mirror',
    side,
    ticker,
    assetName,
    pilotName,
    notional,
    at: Date.now(),
  }
}

export function Dashboard() {
  const [trades, setTrades] = useState(TRADES)
  const [positions, setPositions] = useState(POSITIONS)
  const [range, setRange] = useState<RangeKey>('90D')
  const balance = useSyncExternalStore(showcaseBalance.subscribe, showcaseBalance.get)

  // every figure derives from the live rows, so the books always balance:
  // portfolio = deployed + available + P&L - fees, at every instant
  const tradesExecuted = positions.reduce((s, p) => s + p.tradeCount, 0)
  const feesPaid = positions.reduce((s, p) => s + p.feesAccrued, 0)
  const positionsValue = positions.reduce((s, p) => s + p.value, 0)
  const portfolioValue = balance + positionsValue

  const days = RANGES.find(([k]) => k === range)![1]
  const series = SERIES.slice(-days)
  const dates = DATES.slice(-days)
  // all-time = gross market P&L (the checkable number); windows = chart move
  const rangeAbs = range === 'All' ? positionsValue - DEPLOYED + feesPaid : portfolioValue - series[0]
  const rangePct = (rangeAbs / series[0]) * 100
  const up = rangeAbs >= 0

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      if (!alive) return
      const t = liveTrade()
      const fee = feeOn(t.notional)
      setTrades((prev) => [t, ...prev].slice(0, 40))
      // the fee comes out of the position's cash sleeve, so the row
      // identity (value = deployed + P&L - fees) keeps holding
      setPositions((prev) =>
        prev.map((p) =>
          p.pilot.name === t.pilotName
            ? { ...p, value: p.value - fee, tradeCount: p.tradeCount + 1, feesAccrued: p.feesAccrued + fee }
            : p,
        ),
      )
      timer = setTimeout(tick, 40_000 + Math.random() * 60_000)
    }
    timer = setTimeout(tick, 9_000 + Math.random() * 12_000)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionLabel>Dashboard</SectionLabel>
            <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3rem)] font-medium tracking-[-0.01em]">
              Your autopilot
            </h1>
            <p className="tnum mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" />
              {shortAddr(ADDRESS)} · connected
              <span className="rounded-full bg-accent/[0.1] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-accent">
                ✓ Autopilot authorized · no signatures needed
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button className={btn('ghost', 'px-4 py-2.5')}>Disconnect</button>
          </div>
        </div>
      </Reveal>

      {/* summary */}
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Reveal>
          <div className="card relative h-full overflow-hidden rounded-2xl p-6">
            <div className="glow-accent pointer-events-none absolute -left-10 -top-16 h-56 w-56" />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">Portfolio value</div>
                <div className="tnum mt-1.5 text-4xl font-medium text-fg">
                  <NumberTicker value={portfolioValue} prefix="$" decimals={2} duration={1} />
                </div>
                <div
                  className={`tnum mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm ${up ? 'pill-up' : 'pill-down'}`}
                >
                  {up ? '▲' : '▼'} {usd(Math.abs(rangeAbs))} ({pct(rangePct)}) · {range === 'All' ? 'all time' : `past ${range.toLowerCase()}`}
                </div>
              </div>
              <div className="flex gap-1">
                {RANGES.map(([k]) => (
                  <button
                    key={k}
                    onClick={() => setRange(k)}
                    className={`tnum rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                      range === k ? 'bg-fg/[0.08] text-fg ring-1 ring-line-2' : 'text-fg/50 hover:text-fg'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <AreaChart data={series} dates={dates} height={150} stroke="var(--color-accent)" unit="usd" />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="grid h-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            <Tile label="Available USDC" value={usd(balance)} sub="in your wallet" />
            <Tile label="Deployed" value={usd(DEPLOYED)} />
            <Tile label="Trades executed" value={num(tradesExecuted)} sub="by your autopilot" />
            <Tile
              label="Fees paid · 0.25%/trade"
              value={`-${usd(feesPaid, { decimals: 2 })}`}
              accent="var(--color-down)"
            />
          </div>
        </Reveal>
      </div>

      {/* autopilot authorization */}
      <AutopilotCard />

      {/* your vaults */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Your vaults</h2>
          <Link to="/create" className={btn('accent', 'px-4 py-2')}>
            + Create a vault
          </Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card card-hover rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-display text-lg text-fg">{VAULT.name}</div>
                <div className="mt-0.5 line-clamp-1 text-xs text-muted">{VAULT.tagline}</div>
              </div>
              <span className="tnum shrink-0 text-lg" style={{ color: 'var(--color-up)' }}>
                {pct(VAULT.roi30)}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-5 border-t border-line pt-3 text-xs text-muted">
              <span>
                <b className="tnum text-fg">{num(VAULT.copiers)}</b> copiers
              </span>
              <span>
                <b className="tnum text-fg">{usd(VAULT.aum)}</b> copied
              </span>
              <span className="ml-auto rounded-full bg-accent/[0.1] px-2.5 py-1 font-extrabold text-accent">
                earned {usd(VAULT.earnedUsd, { decimals: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* positions */}
      <Reveal className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Copied pilots</h2>
          <Link to="/explore" className={btn('secondary', 'px-4 py-2')}>
            + Copy a pilot
          </Link>
        </div>
      </Reveal>

      <div className="mt-5 space-y-3">
        {positions.map((p) => (
          <PositionRow key={p.pilot.id} position={p} />
        ))}
      </div>

      {/* live trade ledger */}
      <Reveal className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2.5 font-display text-xl font-medium">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-up" />
            Live activity
          </h2>
          <span className="tnum text-xs text-muted-2">each trade with its exact fee</span>
        </div>
      </Reveal>

      <div className="card mt-5 overflow-hidden rounded-2xl">
        <div className="hidden items-center gap-4 border-b border-line px-5 py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-2 sm:flex">
          <span className="w-16">Type</span>
          <span className="w-12">Side</span>
          <span className="w-20">Asset</span>
          <span className="flex-1">Pilot</span>
          <span className="w-24 text-right">Notional</span>
          <span className="w-20 text-right">Fee</span>
          <span className="w-20 text-right">When</span>
        </div>
        <div className="max-h-[480px] divide-y divide-line overflow-y-auto">
          {trades.map((t) => (
            <TradeRow key={t.id} trade={t} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AutopilotCard() {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="card mt-6 rounded-2xl px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
            Autopilot access · non-custodial
            <span className="rounded-full bg-accent/[0.1] px-2 py-0.5 text-accent">{NETWORK}</span>
          </div>
          <div className="tnum mt-1 flex items-center gap-2 break-all text-sm text-fg">
            <span className="text-muted-2">session key</span>
            <span>
              {revealed ? DELEGATE_ADDRESS : `${DELEGATE_ADDRESS.slice(0, 8)}••••••••••••${DELEGATE_ADDRESS.slice(-6)}`}
            </span>
            <button
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? 'Hide session key' : 'Show session key'}
              className="shrink-0 text-muted-2 transition-colors hover:text-fg"
            >
              {revealed ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 sm:ml-auto sm:w-auto">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-2">Trading cap</div>
            <div className="tnum mt-0.5 text-sm text-fg">{usd(AUTOPILOT_CAP)}</div>
          </div>
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-2">In use</div>
            <div className="tnum mt-0.5 text-sm text-fg">{usd(DEPLOYED)}</div>
          </div>
          <div className="flex gap-2">
            <button className={btn('secondary', 'whitespace-nowrap px-4 py-2 text-xs')}>Adjust cap</button>
            <button className={btn('ghost', 'whitespace-nowrap px-4 py-2 text-xs text-down hover:bg-down/10')}>
              Revoke access
            </button>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-2">
        Your funds never leave your wallet. The autopilot holds a trade-only session key: it can swap whitelisted
        tokenized stocks up to your cap, and can never withdraw or transfer. Revoking takes effect immediately and
        returns full control; re-authorize anytime with one signature.
      </p>
    </div>
  )
}

const KIND_STYLE: Record<FakeTrade['kind'], [string, string]> = {
  copy: ['COPY', 'text-accent bg-accent/[0.08] border-accent/25'],
  mirror: ['AUTO', 'text-blue bg-blue/[0.08] border-blue/25'],
  exit: ['EXIT', 'text-down bg-down/[0.07] border-down/25'],
  deposit: ['FUND', 'text-gold bg-gold/[0.08] border-gold/30'],
  withdraw: ['OUT', 'text-navy bg-navy/[0.06] border-navy/20'],
}

function TradeRow({ trade }: { trade: FakeTrade }) {
  const [kindLabel, kindCls] = KIND_STYLE[trade.kind]
  const fee = trade.kind === 'deposit' || trade.kind === 'withdraw' ? 0 : feeOn(trade.notional)
  const fresh = Date.now() - trade.at < 12_000
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm ${fresh ? 'feed-in' : ''}`}>
      <span className="w-16 shrink-0">
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.08em] ${kindCls}`}>{kindLabel}</span>
      </span>
      <span className={`w-12 shrink-0 font-medium ${trade.side === 'buy' ? 't-up' : 't-down'}`}>
        {trade.side === 'buy' ? 'BUY' : 'SELL'}
      </span>
      <span className="tnum w-20 shrink-0 font-bold text-fg">{trade.ticker}</span>
      <span className="min-w-0 flex-1 truncate text-fg/70">
        {trade.pilotName}
        <span className="hidden text-muted-2 sm:inline"> · {trade.assetName}</span>
      </span>
      <span className="tnum w-24 shrink-0 text-right text-fg">{usd(trade.notional, { decimals: 2 })}</span>
      <span className="tnum w-20 shrink-0 text-right text-muted">{usd(fee, { decimals: 2 })}</span>
      <span className="tnum w-20 shrink-0 text-right text-xs text-muted-2">{ago(trade.at)}</span>
    </div>
  )
}

function ago(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (s < 5) return 'now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-surface p-5">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-2">{label}</div>
      <div className="tnum mt-1.5 text-xl" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-2">{sub}</div>}
    </div>
  )
}

function PositionRow({ position }: { position: FakePosition }) {
  const { pilot } = position
  // market P&L before fees: value = deployed + P&L - fees, per row
  const pnlAbs = position.value - position.allocation + position.feesAccrued
  const pnlPct = (pnlAbs / position.allocation) * 100

  return (
    <div className="card card-hover rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link to={`/pilot/${pilot.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
          <Avatar pilot={pilot} size={46} />
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-medium text-fg">{pilot.name}</div>
            <div className="tnum text-xs text-muted">{pilot.category}</div>
          </div>
        </Link>

        <Sparkline data={position.spark} width={96} height={34} />

        <div className="grid grid-cols-4 gap-5 sm:gap-7">
          <Col label="Deployed" value={usd(position.allocation)} />
          <Col label="Value" value={usd(position.value)} />
          <Col
            label="P&L"
            value={`${pnlAbs >= 0 ? '+' : ''}${usd(pnlAbs)}`}
            sub={pct(pnlPct)}
            accent={pnlAbs >= 0 ? 'var(--color-up)' : 'var(--color-down)'}
          />
          <Col
            label="Trades · fees"
            value={num(position.tradeCount)}
            sub={usd(position.feesAccrued, { decimals: 2 })}
          />
        </div>

        <div className="flex shrink-0 gap-2">
          <Link to={`/pilot/${pilot.id}`} className={btn('secondary', 'px-3.5 py-2 text-xs')}>
            Add
          </Link>
          <button className={btn('ghost', 'px-3.5 py-2 text-xs text-down hover:bg-down/10')}>Stop</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 text-xs text-muted-2">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" />
          autopilot live · {position.copyMode} copy
        </span>
        {position.stopLoss > 0 && <span>stop-loss −{position.stopLoss}%</span>}
      </div>
    </div>
  )
}

function Col({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-2">{label}</div>
      <div className="tnum mt-0.5 text-sm text-fg" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && (
        <div className="tnum text-xs" style={accent ? { color: accent } : undefined}>
          {sub}
        </div>
      )}
    </div>
  )
}
