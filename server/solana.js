/**
 * Solana layer: protocol fee treasury + signed autopilot authorization.
 *
 * Fee flow (the "best way" for micro-fees):
 *   1. Every executed trade accrues its 0.25% fee to the protocol
 *      revenue ledger (accrueFee), off-chain accounting, instant, free.
 *   2. Fees settle ON-CHAIN in batches: settleFees() sends the accrued
 *      USD amount as SOL (converted at the live SOL price) from the
 *      server's treasury keypair to YOUR address. Batching matters:
 *      a 3-cent fee should not pay a network fee per trade.
 *
 * Configuration (server/config.json or env):
 *   FEE_RECIPIENT  your Solana address (where settled fees land)
 *   SOLANA_RPC     RPC url (defaults to devnet; set mainnet-beta to go live)
 *
 * The treasury keypair is auto-generated at server/treasury.json.
 * Fund it (devnet: `solana airdrop`) and settlement transfers are real.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.join(ROOT, 'config.json')
const TREASURY_PATH = path.join(ROOT, 'treasury.json')
const REVENUE_PATH = path.join(ROOT, 'revenue.json')

// ── config ───────────────────────────────────────────────────────────────
function loadConfig() {
  let file = {}
  try {
    if (fs.existsSync(CONFIG_PATH)) file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    /* ignore */
  }
  return {
    feeRecipient: process.env.FEE_RECIPIENT ?? file.feeRecipient ?? '',
    rpc: process.env.SOLANA_RPC ?? file.rpc ?? 'https://api.devnet.solana.com',
  }
}
export const config = loadConfig()

if (!fs.existsSync(CONFIG_PATH)) {
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ feeRecipient: '', rpc: 'https://api.devnet.solana.com' }, null, 2),
  )
}

// ── treasury keypair ─────────────────────────────────────────────────────
function loadTreasury() {
  try {
    if (fs.existsSync(TREASURY_PATH)) {
      const raw = JSON.parse(fs.readFileSync(TREASURY_PATH, 'utf8'))
      return Keypair.fromSecretKey(Uint8Array.from(raw))
    }
  } catch {
    /* fall through to fresh keypair */
  }
  const kp = Keypair.generate()
  fs.writeFileSync(TREASURY_PATH, JSON.stringify([...kp.secretKey]), { mode: 0o600 })
  return kp
}
export const treasury = loadTreasury()

// ── protocol revenue ledger ──────────────────────────────────────────────
// { accruedUsd, settledUsd, settlements: [{sig, usd, sol, at}], entries: capped }
let revenue = { accruedUsd: 0, settledUsd: 0, settlements: [], entries: [] }
try {
  if (fs.existsSync(REVENUE_PATH)) revenue = { ...revenue, ...JSON.parse(fs.readFileSync(REVENUE_PATH, 'utf8')) }
} catch {
  /* start fresh */
}

let revenueDirty = false
setInterval(() => {
  if (!revenueDirty) return
  revenueDirty = false
  fs.writeFile(REVENUE_PATH, JSON.stringify(revenue, null, 2), () => {})
}, 10_000)

/** Called by the engine on every executed trade. */
export function accrueFee(usd, meta = {}) {
  revenue.accruedUsd += usd
  revenue.entries.unshift({ usd, at: Date.now(), ...meta })
  if (revenue.entries.length > 500) revenue.entries.length = 500
  revenueDirty = true
}

export function revenueStatus() {
  return {
    feeRecipient: config.feeRecipient || null,
    rpc: config.rpc,
    treasuryAddress: treasury.publicKey.toBase58(),
    accruedUsd: revenue.accruedUsd,
    settledUsd: revenue.settledUsd,
    pendingUsd: revenue.accruedUsd - revenue.settledUsd,
    settlements: revenue.settlements.slice(0, 20),
    recentFees: revenue.entries.slice(0, 20),
  }
}

/**
 * Settle pending fees on-chain: transfer SOL worth the pending USD from
 * the treasury to the configured fee recipient. Real transaction.
 */
export async function settleFees(solPriceUsd) {
  const pendingUsd = revenue.accruedUsd - revenue.settledUsd
  if (pendingUsd <= 0) throw new Error('nothing to settle')
  if (!config.feeRecipient) throw new Error('FEE_RECIPIENT is not configured (server/config.json)')
  if (!(solPriceUsd > 0)) throw new Error('no live SOL price available')

  const recipient = new PublicKey(config.feeRecipient)
  const connection = new Connection(config.rpc, 'confirmed')
  const lamports = Math.floor((pendingUsd / solPriceUsd) * LAMPORTS_PER_SOL)
  if (lamports < 1) throw new Error('pending amount is below 1 lamport')

  const balance = await connection.getBalance(treasury.publicKey)
  if (balance < lamports + 10_000) {
    throw new Error(
      `treasury underfunded: needs ${(lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL, has ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL. Fund ${treasury.publicKey.toBase58()} on ${config.rpc.includes('devnet') ? 'devnet (solana airdrop)' : 'mainnet'}.`,
    )
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: treasury.publicKey, toPubkey: recipient, lamports }),
  )
  const sig = await connection.sendTransaction(tx, [treasury])
  await connection.confirmTransaction(sig, 'confirmed')

  revenue.settledUsd += pendingUsd
  revenue.settlements.unshift({ sig, usd: pendingUsd, sol: lamports / LAMPORTS_PER_SOL, at: Date.now() })
  revenueDirty = true
  return { sig, usd: pendingUsd, sol: lamports / LAMPORTS_PER_SOL }
}

export async function treasuryBalance() {
  try {
    const connection = new Connection(config.rpc, 'confirmed')
    return (await connection.getBalance(treasury.publicKey)) / LAMPORTS_PER_SOL
  } catch {
    return null
  }
}

// ── one-time autopilot authorization (sign once, no popups after) ────────
export function authMessage(address, nonce) {
  return `Sign in to Alutic and turn on the autopilot.\n\nThis signature lets Alutic execute copy trades for your account. It can never move or withdraw your funds.\n\nWallet: ${address}\nNonce: ${nonce}`
}

/** Verify an ed25519 signature from a Solana wallet (e.g. Phantom). */
export function verifySignature(address, message, signatureB58) {
  try {
    const pubkey = bs58.decode(address)
    const sig = bs58.decode(signatureB58)
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pubkey)
  } catch {
    return false
  }
}
