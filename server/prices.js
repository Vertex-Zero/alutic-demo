/**
 * Live price feed for the tokenized tickers.
 *
 * Sources, in order:
 *   1. Yahoo Finance chart API (real-time-ish, no API key)
 *   2. Stooq CSV (15-min delayed, no API key)
 *   3. Synthetic random walk (keeps the product working offline)
 *
 * Prices are cached in memory and refreshed on a loop. Everything is
 * keyed by the tokenized ticker (e.g. "NVDAx"), so callers never deal
 * with underlying symbols.
 */

import { PILOTS } from './pilots.gen.mjs'

const REFRESH_MS = 60_000
const FETCH_TIMEOUT_MS = 8_000
const CONCURRENCY = 6

// tokenized ticker -> real symbol overrides (null = no real market data)
const SPECIAL = {
  CASH: null, // USDC sleeve, always $1
  SHORT: null, // synthetic short basket
  VIXy: '^VIX',
  MROx: null, // Marathon Oil was absorbed into ConocoPhillips; no live symbol
  SOL: 'SOL-USD', // used to convert fee settlements to SOL
}

export function tickerToSymbol(ticker) {
  if (ticker in SPECIAL) return SPECIAL[ticker]
  return ticker.endsWith('x') ? ticker.slice(0, -1) : ticker
}

/** All tokenized tickers used across every pilot's book, plus SOL. */
export function allTickers() {
  const set = new Set(['SOL'])
  for (const p of PILOTS) for (const h of p.holdings) set.add(h.ticker)
  return [...set]
}

// ── cache ────────────────────────────────────────────────────────────────
// ticker -> { symbol, price, changePct, source: 'yahoo'|'stooq'|'synthetic', at }
const cache = new Map()

export function priceOf(ticker) {
  if (ticker === 'CASH') return 1
  const hit = cache.get(ticker)
  if (hit) return hit.price
  return syntheticQuote(ticker).price
}

export function quoteOf(ticker) {
  if (ticker === 'CASH') return { price: 1, changePct: 0, source: 'cash', at: Date.now() }
  return cache.get(ticker) ?? syntheticQuote(ticker)
}

export function snapshot() {
  const out = {}
  for (const t of allTickers()) {
    const q = quoteOf(t)
    out[t] = { price: round(q.price), changePct: round(q.changePct), live: q.source === 'yahoo' || q.source === 'stooq' }
  }
  return out
}

export function feedStatus() {
  let live = 0
  let total = 0
  let at = 0
  for (const t of allTickers()) {
    if (t === 'CASH') continue
    total++
    const q = cache.get(t)
    if (q && q.source !== 'synthetic') {
      live++
      at = Math.max(at, q.at)
    }
  }
  return { live, total, updatedAt: at || null }
}

const round = (n) => Math.round(n * 100) / 100

// ── synthetic fallback ───────────────────────────────────────────────────
// Deterministic per-symbol base price + slow random walk so the app is
// fully usable with no internet.
const synthetic = new Map()

function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function syntheticQuote(ticker) {
  let s = synthetic.get(ticker)
  if (!s) {
    const base = 25 + (hashCode(ticker) % 4750) / 10 // $25 .. $500
    s = { price: base, open: base, at: Date.now() }
    synthetic.set(ticker, s)
  }
  return { symbol: null, price: s.price, changePct: ((s.price - s.open) / s.open) * 100, source: 'synthetic', at: s.at }
}

function driftSynthetic() {
  for (const t of allTickers()) {
    if (t === 'CASH' || cache.has(t)) continue
    const q = syntheticQuote(t)
    const s = synthetic.get(t)
    s.price = Math.max(1, q.price * (1 + (Math.random() - 0.495) * 0.004))
    s.at = Date.now()
  }
}

// ── live fetchers ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (alutic price feed)', accept: '*/*', ...opts.headers },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`yahoo ${res.status}`)
  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice
  const prev = meta?.chartPreviousClose ?? meta?.previousClose
  if (typeof price !== 'number' || price <= 0) throw new Error('yahoo: no price')
  const changePct = typeof prev === 'number' && prev > 0 ? ((price - prev) / prev) * 100 : 0
  return { price, changePct }
}

async function fetchStooqBatch(symbols) {
  // stooq wants lowercase with a market suffix for US equities
  const ids = symbols.map((s) => (s.startsWith('^') ? s.toLowerCase() : `${s.toLowerCase()}.us`))
  const url = `https://stooq.com/q/l/?s=${ids.join('+')}&f=sd2t2ohlcv&h&e=csv`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`stooq ${res.status}`)
  const text = await res.text()
  const rows = text.trim().split('\n').slice(1)
  const out = new Map()
  rows.forEach((row, i) => {
    const cols = row.split(',')
    const open = Number(cols[3])
    const close = Number(cols[6])
    if (Number.isFinite(close) && close > 0) {
      out.set(symbols[i], { price: close, changePct: Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : 0 })
    }
  })
  return out
}

async function refreshOnce() {
  const tickers = allTickers().filter((t) => t !== 'CASH' && tickerToSymbol(t))
  const misses = []

  // primary: yahoo, a few at a time
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (t) => {
        const symbol = tickerToSymbol(t)
        try {
          const { price, changePct } = await fetchYahoo(symbol)
          cache.set(t, { symbol, price, changePct, source: 'yahoo', at: Date.now() })
        } catch {
          misses.push(t)
        }
      }),
    )
  }

  // fallback: stooq for whatever yahoo missed
  if (misses.length > 0) {
    try {
      const got = await fetchStooqBatch(misses.map(tickerToSymbol))
      misses.forEach((t) => {
        const q = got.get(tickerToSymbol(t))
        if (q) cache.set(t, { symbol: tickerToSymbol(t), ...q, source: 'stooq', at: Date.now() })
      })
    } catch {
      /* keep whatever we have */
    }
  }

  driftSynthetic()
  const { live, total } = feedStatus()
  console.log(`[prices] refreshed: ${live}/${total} live quotes`)
}

export function startPriceFeed() {
  refreshOnce().catch((e) => console.warn('[prices] initial refresh failed:', e.message))
  setInterval(() => refreshOnce().catch((e) => console.warn('[prices] refresh failed:', e.message)), REFRESH_MS)
}
