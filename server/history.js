/**
 * Real price history, and portfolio charts computed from it.
 *
 * Daily closes come from Yahoo Finance (1 year, cached ~1 hour). A pilot's
 * chart is the weighted composite of its holdings' actual histories:
 * each holding normalized to 1.0 at the window start, weighted by its
 * portfolio share, summed. An account's chart is the same composite
 * across its positions, weighted by cost basis. CASH and synthetic
 * tickers contribute a flat line, exactly like real cash does.
 */

import { tickerToSymbol } from './prices.js'
import { getPilotDef } from './engine.js'

const CACHE_MS = 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 9_000
const RANGE_POINTS = { d7: 6, d30: 22, d90: 64, all: 250 }

// symbol -> { closes: number[], at: number, live: boolean }
const cache = new Map()
const inflight = new Map()

async function fetchYahooDaily(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (alutic history)', accept: '*/*' },
    })
    if (!res.ok) throw new Error(`yahoo ${res.status}`)
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    const rawCloses = result?.indicators?.quote?.[0]?.close ?? []
    const rawTs = result?.timestamp ?? []
    const closes = []
    const timestamps = []
    rawCloses.forEach((v, i) => {
      if (typeof v === 'number' && v > 0) {
        closes.push(v)
        timestamps.push((rawTs[i] ?? 0) * 1000)
      }
    })
    if (closes.length < 10) throw new Error('too little data')
    return { closes, timestamps }
  } finally {
    clearTimeout(timer)
  }
}

/** Stooq's daily-history CSV: keyless, and reachable from cloud IPs that
 *  Yahoo blocks. Prices are end-of-day, which is fine for 1y charts. */
async function fetchStooqDaily(symbol) {
  const id = symbol.startsWith('^') ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://stooq.com/q/d/l/?s=${id}&i=d`, {
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (alutic history)' },
    })
    if (!res.ok) throw new Error(`stooq ${res.status}`)
    const rows = (await res.text()).trim().split('\n').slice(1).slice(-260)
    const closes = []
    const timestamps = []
    for (const row of rows) {
      const cols = row.split(',')
      const close = Number(cols[4])
      const ts = Date.parse(cols[0])
      if (Number.isFinite(close) && close > 0 && Number.isFinite(ts)) {
        closes.push(close)
        timestamps.push(ts)
      }
    }
    if (closes.length < 10) throw new Error('too little data')
    return { closes, timestamps }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchDaily(symbol) {
  try {
    return await fetchYahooDaily(symbol)
  } catch {
    return fetchStooqDaily(symbol)
  }
}

/** Deterministic flat fallback so unknown tickers never break a chart. */
function flatSeries(n = 250) {
  return { closes: new Array(n).fill(1), timestamps: syntheticTimestamps(n) }
}

/** Weekday-only timestamps counting back from today. */
function syntheticTimestamps(n) {
  const out = []
  const d = new Date()
  while (out.length < n) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) out.unshift(d.getTime())
    d.setDate(d.getDate() - 1)
  }
  return out
}

async function seriesFor(ticker) {
  const symbol = tickerToSymbol(ticker)
  if (!symbol) return { ...flatSeries(), live: false }
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit
  if (inflight.has(symbol)) return inflight.get(symbol)
  const p = fetchDaily(symbol)
    .then(({ closes, timestamps }) => {
      const entry = { closes, timestamps, at: Date.now(), live: true }
      cache.set(symbol, entry)
      return entry
    })
    .catch(() => {
      const entry = hit ?? { ...flatSeries(), at: Date.now(), live: false }
      cache.set(symbol, entry)
      return entry
    })
    .finally(() => inflight.delete(symbol))
  inflight.set(symbol, p)
  return p
}

/**
 * Weighted composite of real holding histories over the given range.
 * weights: [{ticker, weight}] (weights need not sum to anything specific).
 */
async function composite(weights, range) {
  const points = RANGE_POINTS[range] ?? RANGE_POINTS.d90
  const parts = await Promise.all(weights.map((w) => seriesFor(w.ticker)))
  const totalW = weights.reduce((s, w) => s + w.weight, 0) || 1

  const out = new Array(points).fill(0)
  let anyLive = false
  let dates = null
  weights.forEach((w, i) => {
    const closes = parts[i].closes
    if (parts[i].live) {
      anyLive = true
      if (!dates && parts[i].timestamps?.length >= points) dates = parts[i].timestamps.slice(-points)
    }
    const window = closes.slice(-points)
    const base = window[0] || 1
    const share = w.weight / totalW
    for (let j = 0; j < points; j++) {
      // pad short histories by holding the earliest value flat
      const v = window[Math.max(0, j - (points - window.length))] ?? base
      out[j] += (v / base) * share
    }
  })

  const series = out.map((v) => v * 100)
  const changePct = ((series[series.length - 1] - series[0]) / series[0]) * 100
  return { series, dates: dates ?? syntheticTimestamps(points), changePct, live: anyLive }
}

export async function pilotHistory(pilotId, range) {
  const pilot = getPilotDef(pilotId)
  if (!pilot) return null
  return composite(pilot.holdings.map((h) => ({ ticker: h.ticker, weight: h.weight })), range)
}

/** Account chart: the pilots' real composites, weighted by cost basis. */
export async function accountHistory(account, range) {
  if (!account.positions.length) return { series: [], changePct: 0, live: false }
  const weights = new Map()
  for (const pos of account.positions) {
    const pilot = getPilotDef(pos.pilotId)
    if (!pilot) continue
    for (const h of pilot.holdings) {
      const w = (pos.costBasis * h.weight) / 100
      weights.set(h.ticker, (weights.get(h.ticker) ?? 0) + w)
    }
  }
  return composite([...weights.entries()].map(([ticker, weight]) => ({ ticker, weight })), range)
}

// ── real statistics, derived from the actual 1y composite ────────────────
const statsCache = new Map() // pilotId -> { stats, at }
const STATS_CACHE_MS = 30 * 60 * 1000

function sliceReturn(series, points) {
  const w = series.slice(-points)
  if (w.length < 2) return 0
  return ((w[w.length - 1] - w[0]) / w[0]) * 100
}

/**
 * Everything a pilot card displays, computed from real market history:
 * range returns, Sharpe, max drawdown, win rate (share of up days).
 */
export async function realStats(pilotId) {
  const hit = statsCache.get(pilotId)
  if (hit && Date.now() - hit.at < STATS_CACHE_MS) return hit.stats

  const full = await pilotHistory(pilotId, 'all')
  if (!full) return null
  const s = full.series

  const rets = []
  for (let i = 1; i < s.length; i++) rets.push(s[i] / s[i - 1] - 1)
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1)
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1)
  const std = Math.sqrt(variance)
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0

  let peak = s[0]
  let maxDrawdown = 0
  for (const v of s) {
    peak = Math.max(peak, v)
    maxDrawdown = Math.min(maxDrawdown, ((v - peak) / peak) * 100)
  }
  const winRate = Math.round((rets.filter((r) => r > 0).length / (rets.length || 1)) * 100)

  const stats = {
    roi: {
      d7: sliceReturn(s, RANGE_POINTS.d7),
      d30: sliceReturn(s, RANGE_POINTS.d30),
      d90: sliceReturn(s, RANGE_POINTS.d90),
      all: full.changePct,
    },
    sharpe: Math.round(sharpe * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10) / 10,
    winRate,
    // last 30 trading days, for the little real sparklines
    spark: s.slice(-RANGE_POINTS.d30).map((v) => Math.round(v * 100) / 100),
    live: full.live,
  }
  statsCache.set(pilotId, { stats, at: Date.now() })
  return stats
}
