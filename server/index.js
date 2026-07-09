/**
 * Alutic backend: REST API + live price feed + the autopilot engine.
 *
 *   npm run server          -> API on :8787
 *   npm run dev             -> vite (:5173, proxies /api) + this server
 *   npm run start           -> production: builds and serves dist/ + API
 *
 * Identity is the wallet address (sent by the client after a real
 * EIP-1193 wallet connect). Signature-based auth (SIWE) is the obvious
 * next hardening step before real money ever moves.
 */

import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startPriceFeed, snapshot, feedStatus, priceOf } from './prices.js'
import {
  startEngine,
  getOrCreateAccount,
  getAccount,
  accountView,
  recordWithdrawal,
  copy,
  stop,
  TRADE_FEE_BPS,
} from './engine.js'
import { revenueStatus, settleFees, treasuryBalance, authMessage, verifySignature, config } from './solana.js'
import { pilotHistory, accountHistory, realStats } from './history.js'
import { PILOTS } from './pilots.gen.mjs'
import { allVaults, vaultAsPilot, createVault, pilotPlatformStats, recentActivity } from './engine.js'
import { depositAddressFor, startDepositWatcher, withdrawToWallet } from './deposits.js'
import { resolveUniverse, venueStatus, quoteBuy } from './jupiter.js'
import { startFilingsWatcher, filingFor } from './filings.js'

const PORT = process.env.PORT || 8787
const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(ROOT, '..', 'dist')

const app = express()
app.use(express.json())

// Solana base58 pubkeys (Phantom) or EVM 0x addresses (MetaMask fallback)
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const EVM_RE = /^0x[0-9a-fA-F]{40}$/

function requireAddress(req, res) {
  const address = (req.body?.address ?? req.query?.address ?? '').toString()
  if (!SOL_RE.test(address) && !EVM_RE.test(address)) {
    res.status(400).json({ error: 'a valid wallet address is required' })
    return null
  }
  return address
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, feeBps: TRADE_FEE_BPS, prices: feedStatus() })
})

app.get('/api/prices', (_req, res) => {
  res.json({ prices: snapshot(), status: feedStatus() })
})

/**
 * Every pilot (built-in + community vaults) with stats computed from
 * real market history and real platform numbers, so nothing displayed
 * is fabricated: returns/Sharpe/drawdown/win-rate from actual prices,
 * copiers/AUM from actual accounts.
 */
app.get('/api/pilots', async (_req, res) => {
  try {
    const defs = [...PILOTS, ...allVaults().map(vaultAsPilot)]
    const out = await Promise.all(
      defs.map(async (p) => {
        const stats = await realStats(p.id).catch(() => null)
        const platform = pilotPlatformStats(p.id)
        return {
          ...p,
          ...(stats
            ? { roi: stats.roi, sharpe: stats.sharpe, maxDrawdown: stats.maxDrawdown, winRate: stats.winRate, spark: stats.spark }
            : {}),
          copiers: platform.copiers,
          aum: platform.aum,
          latestFiling: filingFor(p.id),
        }
      }),
    )
    res.json({ pilots: out })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/** Create a community vault. Creator earns half the fee on every copier trade. */
app.post('/api/vaults', (req, res) => {
  const address = requireAddress(req, res)
  if (!address) return
  try {
    getOrCreateAccount(address)
    const vault = createVault(address, {
      name: req.body?.name,
      description: req.body?.description ?? '',
      allocations: req.body?.allocations,
    })
    res.json({ vault: vaultAsPilot(vault) })
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message })
  }
})

/**
 * Real chart data. ?pilotId= gives the weighted composite of that pilot's
 * holdings' actual price histories; ?address= gives the same across an
 * account's positions. range: d7 | d30 | d90 | all
 */
app.get('/api/history', async (req, res) => {
  const range = ['d7', 'd30', 'd90', 'all'].includes(req.query.range) ? req.query.range : 'd90'
  try {
    if (req.query.pilotId) {
      const h = await pilotHistory(String(req.query.pilotId), range)
      if (!h) return res.status(404).json({ error: 'unknown pilot' })
      return res.json(h)
    }
    const address = requireAddress(req, res)
    if (!address) return
    const account = getAccount(address)
    if (!account) return res.status(404).json({ error: 'no account for that address' })
    res.json(await accountHistory(account, range))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/portfolio/connect', (req, res) => {
  const address = requireAddress(req, res)
  if (!address) return
  const account = getOrCreateAccount(address)

  // one-time autopilot authorization: a Solana wallet signs one message
  // at connect and never sees another popup; trades execute server-side.
  const { signature, nonce } = req.body ?? {}
  if (signature && nonce && SOL_RE.test(address)) {
    if (verifySignature(address, authMessage(address, String(nonce)), String(signature))) {
      account.authorized = true
      account.authorizedAt = Date.now()
    }
  }
  res.json({ account: accountView(account), authorized: account.authorized === true })
})

/** The exact message the wallet should sign (client fetches, wallet signs once). */
app.get('/api/auth/message', (req, res) => {
  const address = requireAddress(req, res)
  if (!address) return
  const nonce = Math.random().toString(36).slice(2, 10)
  res.json({ nonce, message: authMessage(address, nonce) })
})

/** Recent real trades across the platform, anonymized. */
app.get('/api/activity', (_req, res) => {
  res.json({ activity: recentActivity(20) })
})

/** Your personal on-chain deposit address (real SOL/USDC deposits credit automatically). */
app.get('/api/deposit-address', (req, res) => {
  const address = requireAddress(req, res)
  if (!address) return
  getOrCreateAccount(address)
  res.json({ ...depositAddressFor(address), rpc: config.rpc })
})

/** Execution venue status: real xStock mints resolved on Jupiter + trading mode. */
app.get('/api/execution/status', (_req, res) => {
  res.json(venueStatus())
})

/** Real Jupiter router quote for buying a tokenized stock with USDC. */
app.get('/api/execution/quote', async (req, res) => {
  try {
    const { quote: _q, ...rest } = await quoteBuy(String(req.query.ticker), Number(req.query.usd) || 100)
    res.json(rest)
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message })
  }
})

/** Protocol revenue: accrued 0.25% fees and on-chain settlements to your address. */
app.get('/api/fees', async (_req, res) => {
  res.json({ ...revenueStatus(), treasurySol: await treasuryBalance(), solPrice: priceOf('SOL') })
})

/** Batch-settle pending fees on-chain (SOL transfer treasury -> FEE_RECIPIENT). */
app.post('/api/fees/settle', async (_req, res) => {
  try {
    res.json(await settleFees(priceOf('SOL')))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get('/api/portfolio', (req, res) => {
  const address = requireAddress(req, res)
  if (!address) return
  const account = getAccount(address)
  if (!account) return res.status(404).json({ error: 'no account for that address' })
  res.json({ account: accountView(account) })
})

// Practice deposits are retired: balances come only from real on-chain
// transfers detected by the deposit watcher.
app.post('/api/deposit', (_req, res) => {
  res.status(403).json({ error: 'practice deposits are disabled; send SOL/USDC to your deposit address' })
})

/**
 * Withdraw: sends SOL from the user's deposit account back to their own
 * wallet at the live price, then debits their balance. Free, capped by
 * both the account balance and the real on-chain funds.
 */
app.post('/api/withdraw', async (req, res) => {
  const address = requireAddress(req, res)
  if (!address) return
  if (!SOL_RE.test(address)) {
    return res.status(400).json({ error: 'withdrawals require a Solana wallet address' })
  }
  const usd = Number(req.body?.amount)
  const account = getAccount(address)
  if (!account) return res.status(404).json({ error: 'no account for that address' })
  if (!(usd > 0)) return res.status(400).json({ error: 'amount must be positive' })
  if (usd > account.balance + 0.01) return res.status(400).json({ error: 'amount exceeds your available balance' })
  const solPrice = priceOf('SOL')
  if (!(solPrice > 0)) return res.status(503).json({ error: 'no live SOL price available' })
  try {
    const sol = usd / solPrice
    const sig = await withdrawToWallet(address, Math.floor(sol * 1e9))
    const updated = recordWithdrawal(address, usd, { sol, sig })
    res.json({ account: accountView(updated), sig, sol })
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message })
  }
})

app.post('/api/copy', (req, res) => {
  const address = requireAddress(req, res)
  if (!address) return
  const { pilotId, allocation, stopLoss, copyMode } = req.body ?? {}
  try {
    const account = copy(getOrCreateAccount(address), String(pilotId), Number(allocation), {
      stopLoss: Number(stopLoss) || 0,
      copyMode: copyMode === 'fixed' ? 'fixed' : 'proportional',
    })
    res.json({ account: accountView(account) })
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message })
  }
})

app.post('/api/stop', (req, res) => {
  const address = requireAddress(req, res)
  if (!address) return
  try {
    const account = stop(getOrCreateAccount(address), String(req.body?.pilotId))
    res.json({ account: accountView(account) })
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.message })
  }
})

// production: serve the built SPA next to the API
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

startPriceFeed()
startEngine()
startDepositWatcher()
startFilingsWatcher()
resolveUniverse().catch((e) => console.warn('[jupiter] resolve failed:', e.message))

app.listen(PORT, () => {
  console.log(`[alutic] api listening on http://localhost:${PORT}`)
})
