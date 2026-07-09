/**
 * Jupiter venue integration: real xStocks on Solana mainnet.
 *
 * - Resolves each tokenized ticker (AAPLx, NVDAx, ...) to its actual
 *   xStock mint via Jupiter's token search.
 * - Fetches real swap quotes (USDC <-> xStock) from Jupiter's router.
 * - Can EXECUTE those swaps with the custody treasury keypair, but only
 *   when LIVE_TRADING=yes: flipping that flag moves real money on
 *   mainnet, so it stays off until custody is funded and you've done
 *   the legal work.
 */

import { Connection, VersionedTransaction } from '@solana/web3.js'
import { treasury, config } from './solana.js'
import { allTickers } from './prices.js'

const USDC_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const SEARCH_URL = 'https://lite-api.jup.ag/tokens/v2/search?query='
const QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote'
const SWAP_URL = 'https://lite-api.jup.ag/swap/v1/swap'

export const LIVE_TRADING = process.env.LIVE_TRADING === 'yes'

// ticker -> { mint, decimals, name, usdPrice, holderCount } | null
const mints = new Map()

async function jfetch(url, opts) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 9_000)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, headers: { accept: 'application/json', ...opts?.headers } })
    if (!res.ok) throw new Error(`jupiter ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Find the real xStock mint for a tokenized ticker. */
async function resolveMint(ticker) {
  try {
    const results = await jfetch(SEARCH_URL + encodeURIComponent(ticker))
    const hit = Array.isArray(results)
      ? results.find((t) => t.symbol === ticker && t.name?.toLowerCase().includes('xstock'))
      : null
    if (!hit) return null
    return {
      mint: hit.id,
      decimals: hit.decimals,
      name: hit.name,
      usdPrice: hit.usdPrice ?? null,
      holderCount: hit.holderCount ?? null,
    }
  } catch {
    return null
  }
}

/** Resolve the whole universe (a few at a time, gently). */
export async function resolveUniverse() {
  const tickers = allTickers().filter((t) => t.endsWith('x'))
  for (let i = 0; i < tickers.length; i += 4) {
    await Promise.all(
      tickers.slice(i, i + 4).map(async (t) => {
        if (!mints.has(t)) mints.set(t, await resolveMint(t))
      }),
    )
  }
  const resolved = [...mints.values()].filter(Boolean).length
  console.log(`[jupiter] resolved ${resolved}/${tickers.length} xStock mints on Solana mainnet`)
}

export function venueStatus() {
  const entries = [...mints.entries()]
  return {
    venue: 'jupiter',
    mode: LIVE_TRADING ? 'live' : 'paper',
    network: 'solana-mainnet',
    xstocksResolved: entries.filter(([, v]) => v).length,
    xstocksTotal: entries.length,
    tokens: Object.fromEntries(
      entries.filter(([, v]) => v).map(([t, v]) => [t, { mint: v.mint, onchainPrice: v.usdPrice, holders: v.holderCount }]),
    ),
  }
}

/** Real Jupiter router quote: buy `usd` worth of a tokenized stock with USDC. */
export async function quoteBuy(ticker, usd) {
  const token = mints.get(ticker) ?? (await resolveMint(ticker))
  if (!token) throw Object.assign(new Error(`${ticker} is not tradable on Jupiter`), { status: 404 })
  mints.set(ticker, token)
  const amount = Math.round(usd * 1e6) // USDC has 6 decimals
  const q = await jfetch(`${QUOTE_URL}?inputMint=${USDC_MAINNET}&outputMint=${token.mint}&amount=${amount}&slippageBps=50`)
  return {
    ticker,
    mint: token.mint,
    inUsd: usd,
    outAmount: Number(q.outAmount) / 10 ** token.decimals,
    pricePerShare: usd / (Number(q.outAmount) / 10 ** token.decimals),
    priceImpactPct: Number(q.priceImpactPct ?? 0),
    route: q.routePlan?.map((r) => r.swapInfo?.label).filter(Boolean) ?? [],
    quote: q, // full quote, needed to execute
  }
}

/**
 * Execute a quoted swap with the custody treasury. HARD-GATED:
 * requires LIVE_TRADING=yes and a funded treasury on mainnet.
 */
export async function executeSwap(quote) {
  if (!LIVE_TRADING) {
    throw Object.assign(
      new Error('live trading is disabled (set LIVE_TRADING=yes with a funded mainnet treasury to enable)'),
      { status: 403 },
    )
  }
  const { swapTransaction } = await jfetch(SWAP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteResponse: quote, userPublicKey: treasury.publicKey.toBase58(), wrapAndUnwrapSol: true }),
  })
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'))
  tx.sign([treasury])
  const connection = new Connection(config.rpc.includes('devnet') ? 'https://api.mainnet-beta.solana.com' : config.rpc, 'confirmed')
  const sig = await connection.sendTransaction(tx)
  await connection.confirmTransaction(sig, 'confirmed')
  return { sig }
}
