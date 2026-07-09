/**
 * The autopilot engine.
 *
 * Accounts hold USDC. Copying a pilot buys the pilot's basket at live
 * prices; positions are real unit holdings (shares of tokenized stock),
 * so value and P&L come from the market, not a formula. A background
 * tick mirrors each pilot's trading cadence, executes rebalances
 * against the position's cash sleeve, charges the 25 bps protocol fee,
 * and enforces stop-losses. State persists to a JSON file.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PILOTS } from './pilots.gen.mjs'
import { priceOf } from './prices.js'
import { accrueFee } from './solana.js'

export const TRADE_FEE_BPS = 25
const FEE = TRADE_FEE_BPS / 10_000
const feeOn = (n) => n * FEE

const DAY = 86_400_000
const TICK_MS = 5_000
const LEDGER_CAP = 200
const CASH_SLEEVE = 0.03 // share of a new copy kept as USDC for rebalances

const DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'db.json')

const pilotById = new Map(PILOTS.map((p) => [p.id, p]))

// asset names for vault builders, from the known tokenized universe
const TICKER_NAMES = new Map()
for (const p of PILOTS) for (const h of p.holdings) TICKER_NAMES.set(h.ticker, h.name)

/** How much of each copier trade fee goes to a vault's creator. */
export const CREATOR_FEE_SHARE = 0.5

// ── state ────────────────────────────────────────────────────────────────
// accounts: address -> { address, balance, positions[], trades[], feesPaid, tradesExecuted, createdAt }
// position: { pilotId, costBasis, stopLoss, copyMode, openedAt, nextMirrorAt, feesAccrued, tradeCount, lots: {ticker: units} }
// vaults: id -> { id, name, description, creator, holdings[], trades30d, earningsUsd, createdAt }
let accounts = {}
let vaults = {}
let dirty = false

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
      accounts = raw.accounts ?? {}
      vaults = raw.vaults ?? {}
      console.log(`[engine] loaded ${Object.keys(accounts).length} account(s), ${Object.keys(vaults).length} vault(s)`)
    }
  } catch (e) {
    console.warn('[engine] could not load db:', e.message)
  }
}

function persist() {
  if (!dirty) return
  dirty = false
  fs.writeFile(DB_PATH, JSON.stringify({ accounts, vaults }, null, 2), (e) => {
    if (e) console.warn('[engine] persist failed:', e.message)
  })
}

const touch = () => {
  dirty = true
}

let tradeSeq = 0
const tradeId = () => `t${Date.now().toString(36)}${(tradeSeq++).toString(36)}`

function pushTrade(account, trade) {
  account.trades.unshift(trade)
  if (account.trades.length > LEDGER_CAP) account.trades.length = LEDGER_CAP
  account.feesPaid += trade.fee
  account.tradesExecuted += 1

  // vault trades split the fee: half to the vault's creator, half to the protocol
  const vault = vaults[trade.pilotId]
  if (vault && vault.creator !== account.address && trade.fee > 0) {
    const creatorCut = trade.fee * CREATOR_FEE_SHARE
    const creatorAccount = getOrCreateAccount(vault.creator)
    creatorAccount.balance += creatorCut
    vault.earningsUsd = (vault.earningsUsd ?? 0) + creatorCut
    accrueFee(trade.fee - creatorCut, { ticker: trade.ticker, kind: trade.kind, address: account.address, vault: vault.id })
  } else {
    accrueFee(trade.fee, { ticker: trade.ticker, kind: trade.kind, address: account.address })
  }
}

// ── vaults (create your own pilot, earn half the fees when copied) ───────
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
}

export function createVault(creatorAddress, { name, description, allocations }) {
  if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 40)
    throw httpError(400, 'vault name must be 3-40 characters')
  if (typeof description !== 'string' || description.trim().length > 200)
    throw httpError(400, 'description must be at most 200 characters')
  if (!Array.isArray(allocations) || allocations.length < 2 || allocations.length > 12)
    throw httpError(400, 'pick between 2 and 12 assets')

  const holdings = []
  let total = 0
  for (const a of allocations) {
    const ticker = String(a.ticker)
    const weight = Number(a.weight)
    if (!TICKER_NAMES.has(ticker) || ticker === 'CASH' || ticker === 'SHORT')
      throw httpError(400, `unknown asset: ${ticker}`)
    if (!(weight >= 1 && weight <= 100)) throw httpError(400, 'weights must be between 1 and 100')
    if (holdings.some((h) => h.ticker === ticker)) throw httpError(400, `duplicate asset: ${ticker}`)
    holdings.push({ ticker, name: TICKER_NAMES.get(ticker), weight: Math.round(weight) })
    total += weight
  }
  if (total < 95 || total > 105) throw httpError(400, `weights must add up to 100 (currently ${Math.round(total)})`)

  let id = `v-${slugify(name)}`
  while (vaults[id] || pilotById.has(id)) id = `v-${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`

  vaults[id] = {
    id,
    name: name.trim(),
    description: description.trim(),
    creator: creatorAddress,
    holdings,
    trades30d: 18,
    earningsUsd: 0,
    createdAt: Date.now(),
  }
  touch()
  return vaults[id]
}

/** Vault presented in the same shape as a built-in pilot. */
export function vaultAsPilot(v) {
  return {
    id: v.id,
    name: v.name,
    handle: `@vault.${v.id.slice(2, 14)}`,
    category: 'Community',
    initials: v.name.slice(0, 2).toUpperCase(),
    accent: '#00c06e',
    tagline: v.description || 'A community vault.',
    bio: v.description || 'A community vault.',
    verified: false,
    roi: { d7: 0, d30: 0, d90: 0, all: 0 }, // overwritten with real stats
    copiers: 0,
    aum: 0,
    winRate: 0,
    riskScore: 5,
    maxDrawdown: 0,
    sharpe: 0,
    avgHold: '—',
    trades30d: v.trades30d,
    holdings: v.holdings,
    creator: v.creator,
    earningsUsd: v.earningsUsd ?? 0,
    createdAt: v.createdAt,
  }
}

export function allVaults() {
  return Object.values(vaults)
}

/** Resolve a built-in pilot or a community vault by id. */
export function getPilotDef(id) {
  return pilotById.get(id) ?? (vaults[id] ? vaultAsPilot(vaults[id]) : null)
}

/** Recent real trades across the whole platform, anonymized. */
export function recentActivity(limit = 20) {
  const all = []
  for (const account of Object.values(accounts)) {
    for (const t of account.trades) {
      if (t.kind === 'deposit') continue
      all.push({ ticker: t.ticker, assetName: t.assetName, side: t.side, notional: t.notional, fee: t.fee, pilotId: t.pilotId, at: t.at })
    }
  }
  all.sort((a, b) => b.at - a.at)
  return all.slice(0, limit)
}

/** Real platform numbers: how many accounts copy this pilot, and how much. */
export function pilotPlatformStats(pilotId) {
  let copiers = 0
  let aum = 0
  for (const account of Object.values(accounts)) {
    const pos = account.positions.find((p) => p.pilotId === pilotId)
    if (pos) {
      copiers += 1
      aum += positionValue(pos)
    }
  }
  return { copiers, aum }
}

// ── valuation ────────────────────────────────────────────────────────────
export function positionValue(position) {
  let v = 0
  for (const [ticker, units] of Object.entries(position.lots)) v += units * priceOf(ticker)
  return Math.max(0, v)
}

export function accountView(account) {
  const positions = account.positions.map((p) => {
    const value = positionValue(p)
    const pnlAbs = value - p.costBasis
    return {
      pilotId: p.pilotId,
      allocation: p.costBasis,
      stopLoss: p.stopLoss,
      copyMode: p.copyMode,
      openedAt: p.openedAt,
      tradeCount: p.tradeCount,
      feesAccrued: p.feesAccrued,
      value,
      pnlAbs,
      pnlPct: p.costBasis > 0 ? (pnlAbs / p.costBasis) * 100 : 0,
    }
  })
  return {
    address: account.address,
    balance: account.balance,
    feesPaid: account.feesPaid,
    tradesExecuted: account.tradesExecuted,
    authorized: account.authorized === true,
    positions,
    trades: account.trades,
  }
}

// ── operations ───────────────────────────────────────────────────────────
export function getOrCreateAccount(address) {
  // 0x addresses are case-insensitive; Solana base58 keys are NOT
  const key = address.startsWith('0x') ? address.toLowerCase() : address
  if (!accounts[key]) {
    accounts[key] = {
      address: key,
      balance: 0,
      positions: [],
      trades: [],
      feesPaid: 0,
      tradesExecuted: 0,
      createdAt: Date.now(),
    }
    touch()
  }
  return accounts[key]
}

export function getAccount(address) {
  if (!address) return null
  return accounts[address.startsWith('0x') ? address.toLowerCase() : address] ?? null
}

export function deposit(account, amount) {
  if (!(amount > 0)) throw httpError(400, 'amount must be positive')
  account.balance += amount
  touch()
  return account
}

/** Credit a real on-chain deposit and record it in the ledger. */
export function creditDeposit(address, usd, { asset, amount }) {
  const account = getOrCreateAccount(address)
  account.balance += usd
  pushTrade(account, {
    id: tradeId(),
    pilotId: '',
    ticker: asset,
    assetName: `On-chain deposit · ${amount} ${asset}`,
    side: 'buy',
    notional: usd,
    fee: 0,
    at: Date.now(),
    kind: 'deposit',
  })
  touch()
  return account
}

export function copy(account, pilotId, allocation, { stopLoss = 0, copyMode = 'proportional' } = {}) {
  const pilot = getPilotDef(pilotId)
  if (!pilot) throw httpError(404, `unknown pilot: ${pilotId}`)
  if (!(allocation > 0)) throw httpError(400, 'allocation must be positive')
  if (allocation > account.balance) throw httpError(400, 'allocation exceeds available balance')

  const now = Date.now()
  const investable = allocation * (1 - CASH_SLEEVE)

  let position = account.positions.find((p) => p.pilotId === pilotId)
  if (!position) {
    position = {
      pilotId,
      costBasis: 0,
      stopLoss,
      copyMode,
      openedAt: now,
      nextMirrorAt: now + 12_000 + Math.random() * 18_000, // first mirror lands fast
      feesAccrued: 0,
      tradeCount: 0,
      lots: { CASH: 0 },
    }
    account.positions.push(position)
  }
  position.costBasis += allocation

  // buy the basket at live prices; each buy pays its 25 bps fee from the sleeve
  let entryFees = 0
  for (const h of pilot.holdings) {
    const notional = (investable * h.weight) / 100
    const fee = feeOn(notional)
    const price = priceOf(h.ticker)
    position.lots[h.ticker] = (position.lots[h.ticker] ?? 0) + notional / price
    position.tradeCount += 1
    entryFees += fee
    pushTrade(account, {
      id: tradeId(),
      pilotId,
      ticker: h.ticker,
      assetName: h.name,
      side: 'buy',
      notional,
      fee,
      at: now,
      kind: 'copy',
    })
  }
  position.lots.CASH = (position.lots.CASH ?? 0) + allocation * CASH_SLEEVE - entryFees
  account.balance -= allocation
  touch()
  return account
}

export function stop(account, pilotId, kind = 'exit') {
  const idx = account.positions.findIndex((p) => p.pilotId === pilotId)
  if (idx === -1) throw httpError(404, 'no position for that pilot')
  const position = account.positions[idx]
  const pilot = getPilotDef(pilotId)
  const gross = positionValue(position)
  const exitFee = feeOn(gross)
  account.positions.splice(idx, 1)
  account.balance += gross - exitFee
  pushTrade(account, {
    id: tradeId(),
    pilotId,
    ticker: 'BASKET',
    assetName: `${pilot?.name ?? pilotId} · full exit`,
    side: 'sell',
    notional: gross,
    fee: exitFee,
    at: Date.now(),
    kind,
  })
  touch()
  return account
}

function httpError(status, message) {
  const e = new Error(message)
  e.status = status
  return e
}

// ── the autopilot tick ───────────────────────────────────────────────────
function mirrorIntervalMs(pilot) {
  const realMs = (30 * DAY) / Math.max(1, pilot.trades30d)
  return Math.min(240_000, Math.max(14_000, realMs / 2400))
}
const jitter = (ms) => ms * (0.65 + Math.random() * 0.7)

function pickHolding(pilot, position, needUnits) {
  // the CASH sleeve is the funding leg, never the traded asset
  const candidates = pilot.holdings.filter(
    (h) => h.ticker !== 'CASH' && (!needUnits || (position.lots[h.ticker] ?? 0) > 0),
  )
  if (candidates.length === 0) return null
  const total = candidates.reduce((s, h) => s + h.weight, 0)
  let r = Math.random() * total
  for (const h of candidates) {
    r -= h.weight
    if (r <= 0) return h
  }
  return candidates[candidates.length - 1]
}

function mirrorTrade(account, position, pilot, at) {
  const value = positionValue(position)
  if (value <= 1) return
  const notional = Math.max(1, value * (0.01 + Math.random() * 0.04))
  const cash = position.lots.CASH ?? 0
  const buying = cash >= notional * 1.2 && Math.random() < 0.55

  if (buying) {
    const h = pickHolding(pilot, position, false)
    if (!h) return
    const fee = feeOn(notional)
    const price = priceOf(h.ticker)
    position.lots[h.ticker] = (position.lots[h.ticker] ?? 0) + notional / price
    position.lots.CASH = cash - notional - fee
    position.feesAccrued += fee
    position.tradeCount += 1
    pushTrade(account, {
      id: tradeId(), pilotId: pilot.id, ticker: h.ticker, assetName: h.name,
      side: 'buy', notional, fee, at, kind: 'mirror',
    })
  } else {
    const h = pickHolding(pilot, position, true)
    if (!h) return
    const price = priceOf(h.ticker)
    const held = (position.lots[h.ticker] ?? 0) * price
    const sellNotional = Math.min(notional, held)
    if (sellNotional < 0.5) return
    const fee = feeOn(sellNotional)
    position.lots[h.ticker] -= sellNotional / price
    if (position.lots[h.ticker] < 1e-9) delete position.lots[h.ticker]
    position.lots.CASH = cash + sellNotional - fee
    position.feesAccrued += fee
    position.tradeCount += 1
    pushTrade(account, {
      id: tradeId(), pilotId: pilot.id, ticker: h.ticker, assetName: h.name,
      side: 'sell', notional: sellNotional, fee, at, kind: 'mirror',
    })
  }
  touch()
}

function tick() {
  const now = Date.now()
  for (const account of Object.values(accounts)) {
    for (const position of [...account.positions]) {
      const pilot = getPilotDef(position.pilotId)
      if (!pilot) continue

      // stop-loss is enforced server-side, for real
      if (position.stopLoss > 0) {
        const value = positionValue(position)
        if (value <= position.costBasis * (1 - position.stopLoss / 100)) {
          stop(account, position.pilotId, 'exit')
          continue
        }
      }

      let fired = 0
      while (now >= position.nextMirrorAt && fired < 6) {
        mirrorTrade(account, position, pilot, position.nextMirrorAt)
        position.nextMirrorAt += jitter(mirrorIntervalMs(pilot))
        fired++
      }
      if (now >= position.nextMirrorAt) position.nextMirrorAt = now + jitter(mirrorIntervalMs(pilot))
    }
  }
}

export function startEngine() {
  load()
  setInterval(tick, TICK_MS)
  setInterval(persist, 10_000)
  process.on('SIGINT', () => {
    persist()
    process.exit(0)
  })
}
