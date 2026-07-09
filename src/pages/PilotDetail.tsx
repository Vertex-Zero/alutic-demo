import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AreaChart } from '../components/Chart'
import { CopyPanel } from '../components/CopyPanel'
import { Avatar, CategoryBadge, VerifiedTick, Stat } from '../components/ui'
import { useStore } from '../lib/store'
import { compact, compactUsd, pct, usd, shortAddr } from '../lib/format'
import { NotFound } from './NotFound'

type Range = 'd7' | 'd30' | 'd90' | 'all'

const RANGES: { key: Range; label: string; points: number }[] = [
  { key: 'd7', label: '7D', points: 14 },
  { key: 'd30', label: '30D', points: 30 },
  { key: 'd90', label: '90D', points: 90 },
  { key: 'all', label: '1Y', points: 180 },
]

/** Real underlying symbol for a tokenized ticker (null = not a listed stock). */
function stockSymbol(ticker: string): string | null {
  if (ticker === 'CASH' || ticker === 'SHORT' || ticker === 'MROx') return null
  if (ticker === 'VIXy') return '^VIX'
  return ticker.endsWith('x') ? ticker.slice(0, -1) : ticker
}

export function PilotDetail() {
  const { id } = useParams()
  const { trades, isCopying, prices, pricesLive, getPilot } = useStore()
  const pilot = id ? getPilot(id) : undefined
  const [range, setRange] = useState<Range>('d90')
  const [hist, setHist] = useState<{ series: number[]; dates?: number[]; changePct: number; live: boolean } | null>(null)

  // real chart: weighted composite of the holdings' actual price history
  useEffect(() => {
    if (!id) return
    let alive = true
    setHist(null)
    fetch(`/api/history?pilotId=${id}&range=${range}`)
      .then((r) => r.json())
      .then((h) => {
        if (alive && Array.isArray(h.series) && h.series.length > 1) setHist(h)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id, range])

  if (!pilot) {
    // vaults arrive from the server; show a beat of loading before 404ing
    if (id?.startsWith('v-')) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center text-sm font-bold text-muted">
          Loading vault…
        </div>
      )
    }
    return <NotFound />
  }

  const rangeReturn = hist ? hist.changePct : pilot.roi[range]
  const up = rangeReturn >= 0
  const copying = isCopying(pilot.id)
  const myTrades = trades.filter((t) => t.pilotId === pilot.id).slice(0, 8)

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Back to the board
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* main column */}
        <div>
          {/* header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar pilot={pilot} size={60} />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-medium sm:text-3xl">{pilot.name}</h1>
                  {pilot.verified && <VerifiedTick size={18} />}
                </div>
                <div className="tnum mt-1 flex items-center gap-3 text-sm text-muted">
                  <span>{pilot.handle}</span>
                  <CategoryBadge category={pilot.category} />
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">1Y return</div>
              <div className="tnum text-3xl" style={{ color: pilot.roi.all >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                {pct(pilot.roi.all)}
              </div>
            </div>
          </div>

          {pilot.category === 'Community' && pilot.creator && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full bg-accent/[0.1] px-2.5 py-0.5 font-extrabold uppercase tracking-wide text-accent">
                Community vault
              </span>
              created by <span className="tnum">{shortAddr(pilot.creator)}</span> · creator earns half of every
              copier's trade fee
            </p>
          )}

          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-fg/75">{pilot.bio}</p>

          {/* chart */}
          <div className="card mt-7 rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
                  {RANGES.find((r) => r.key === range)!.label} performance
                  {hist?.live && (
                    <span className="flex items-center gap-1 text-accent">
                      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                      real market data
                    </span>
                  )}
                </div>
                <div className="tnum mt-1 text-2xl" style={{ color: up ? 'var(--color-up)' : 'var(--color-down)' }}>
                  {pct(rangeReturn)}
                </div>
              </div>
              <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key as typeof range)}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      range === r.key ? 'bg-accent text-white' : 'text-fg/55 hover:text-fg'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              {hist ? (
                <AreaChart data={hist.series} dates={hist.dates} height={240} stroke={up ? 'var(--color-up)' : 'var(--color-down)'} />
              ) : (
                <div className="flex h-[240px] items-center justify-center text-sm font-bold text-muted-2">
                  Loading market data…
                </div>
              )}
            </div>
          </div>

          {/* stats */}
          <div className="card mt-5 grid grid-cols-2 gap-x-6 gap-y-6 rounded-2xl p-6 sm:grid-cols-4">
            <Stat label="Copiers" value={compact(pilot.copiers)} />
            <Stat label="AUM" value={compactUsd(pilot.aum)} />
            <Stat label="Win rate" value={`${pilot.winRate}%`} />
            <Stat label="Sharpe" value={pilot.sharpe.toFixed(2)} />
            <Stat label="Max drawdown (1Y)" value={pct(pilot.maxDrawdown, false)} accent="var(--color-down)" />
            <Stat label="Avg. hold" value={pilot.avgHold} />
            <Stat label="Trades / 30D" value={String(pilot.trades30d)} />
            <Stat label="7D return" value={pct(pilot.roi.d7)} accent={pilot.roi.d7 >= 0 ? 'var(--color-up)' : 'var(--color-down)'} />
          </div>

          {/* your autopilot trades on this pilot */}
          {copying && myTrades.length > 0 && (
            <div className="card mt-5 overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <h3 className="flex items-center gap-2 font-display text-lg font-medium">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" />
                  Your autopilot on {pilot.name}
                </h3>
                <span className="tnum text-xs text-muted-2">0.25% / trade</span>
              </div>
              <div className="divide-y divide-line">
                {myTrades.map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-6 py-3 text-sm">
                    <span className={`w-14 shrink-0 font-medium ${t.side === 'buy' ? 't-up' : 't-down'}`}>
                      {t.side === 'buy' ? 'BUY' : 'SELL'}
                    </span>
                    <span className="tnum w-20 shrink-0 font-bold text-fg">{t.ticker}</span>
                    <span className="flex-1 truncate text-fg/70">{t.assetName}</span>
                    <span className="tnum shrink-0 text-fg">{usd(t.notional, { decimals: 2 })}</span>
                    <span className="tnum w-24 shrink-0 text-right text-xs text-muted-2">
                      fee {usd(t.fee, { decimals: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* holdings, priced live */}
          <div className="card mt-5 overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h3 className="font-display text-lg font-medium">Current holdings</h3>
              {pricesLive ? (
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[1px] text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                  Live market prices
                </span>
              ) : (
                <span className="text-xs text-muted-2">Tokenized · {pilot.holdings.length} positions</span>
              )}
            </div>
            <div className="divide-y divide-line">
              {pilot.holdings.map((h) => {
                const q = prices[h.ticker]
                const change = q ? q.changePct : h.change
                const symbol = stockSymbol(h.ticker)
                const inner = (
                  <>
                    <span className="tnum w-20 shrink-0 text-sm font-bold text-fg">{h.ticker}</span>
                    <span className="flex flex-1 items-center gap-1.5 truncate text-sm text-fg/80">
                      {h.name}
                      {symbol && (
                        <svg className="shrink-0 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M7 17L17 7M9 7h8v8" />
                        </svg>
                      )}
                    </span>
                    <div className="hidden w-32 shrink-0 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent/60" style={{ width: `${h.weight}%` }} />
                      </div>
                    </div>
                    <span className="tnum w-12 shrink-0 text-right text-sm text-fg">{h.weight}%</span>
                    <span className="tnum hidden w-20 shrink-0 text-right text-sm text-fg sm:block">
                      {q && h.ticker !== 'CASH' && h.ticker !== 'SHORT' ? usd(q.price, { decimals: 2 }) : '·'}
                    </span>
                    <span
                      className="tnum w-16 shrink-0 text-right text-sm"
                      style={{ color: change >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}
                    >
                      {pct(change)}
                    </span>
                  </>
                )
                return symbol ? (
                  <a
                    key={h.ticker}
                    href={`https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-accent/[0.04]"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={h.ticker} className="flex items-center gap-4 px-6 py-3.5">
                    {inner}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* copy panel */}
        <div className="lg:sticky lg:top-[74px] lg:self-start">
          <CopyPanel pilot={pilot} />
        </div>
      </div>
    </div>
  )
}
