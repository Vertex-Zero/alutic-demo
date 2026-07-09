/**
 * Real on-chain deposits.
 *
 * Every account gets its own Solana deposit address (a server-held
 * keypair, custodial-exchange style). A watcher polls the chain; when
 * SOL or USDC arrives at a deposit address, the account balance is
 * credited in USD at the live price and the deposit shows up in the
 * account ledger. Works on devnet out of the box; point SOLANA_RPC at
 * mainnet-beta to accept real value.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { config } from './solana.js'
import { priceOf } from './prices.js'
import { getAccount, creditDeposit } from './engine.js'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DEPOSITS_PATH = path.join(ROOT, 'deposits.json')
const POLL_MS = 30_000

const USDC_MINT = config.rpc.includes('devnet')
  ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' // Circle devnet USDC
  : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // mainnet USDC

// userAddress -> { secretKey: number[], seenSol: lamports, seenUsdc: number }
let book = {}
try {
  if (fs.existsSync(DEPOSITS_PATH)) book = JSON.parse(fs.readFileSync(DEPOSITS_PATH, 'utf8'))
} catch {
  /* start fresh */
}

let dirty = false
function persist() {
  if (!dirty) return
  dirty = false
  fs.writeFile(DEPOSITS_PATH, JSON.stringify(book), { mode: 0o600 }, () => {})
}

function keypairFor(userAddress) {
  let entry = book[userAddress]
  if (!entry) {
    const kp = Keypair.generate()
    entry = { secretKey: [...kp.secretKey], seenSol: 0, seenUsdc: 0 }
    book[userAddress] = entry
    dirty = true
    persist()
  }
  return Keypair.fromSecretKey(Uint8Array.from(entry.secretKey))
}

export function depositAddressFor(userAddress) {
  return {
    depositAddress: keypairFor(userAddress).publicKey.toBase58(),
    network: config.rpc.includes('devnet') ? 'devnet' : 'mainnet',
    accepts: ['SOL', 'USDC'],
  }
}

/**
 * Real withdrawal: send SOL from the user's deposit account back to their
 * own wallet. Capped by what's actually on-chain; the watcher's baseline
 * is updated so the outflow isn't misread as a new deposit later.
 */
export async function withdrawToWallet(userAddress, lamports) {
  const entry = book[userAddress]
  if (!entry) throw Object.assign(new Error('no deposit account for this address'), { status: 404 })
  const kp = Keypair.fromSecretKey(Uint8Array.from(entry.secretKey))
  const connection = new Connection(config.rpc, 'confirmed')

  const onchain = await connection.getBalance(kp.publicKey)
  const feeBuffer = 10_000
  if (onchain < lamports + feeBuffer) {
    throw Object.assign(
      new Error(
        `only ${(Math.max(0, onchain - feeBuffer) / LAMPORTS_PER_SOL).toFixed(6)} SOL is on-chain in your deposit account; withdrawals are capped by real funds`,
      ),
      { status: 400 },
    )
  }

  const { SystemProgram, Transaction } = await import('@solana/web3.js')
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(userAddress), lamports }),
  )
  const sig = await connection.sendTransaction(tx, [kp])
  await connection.confirmTransaction(sig, 'confirmed')

  entry.seenSol = await connection.getBalance(kp.publicKey)
  dirty = true
  persist()
  return sig
}

async function usdcBalance(connection, owner) {
  try {
    const res = await connection.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(USDC_MINT) })
    return res.value.reduce((s, a) => s + (a.account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0)
  } catch {
    return null
  }
}

async function sweep() {
  const users = Object.keys(book)
  if (users.length === 0) return
  const connection = new Connection(config.rpc, 'confirmed')

  for (const user of users) {
    const entry = book[user]
    const account = getAccount(user)
    if (!account) continue
    const kp = Keypair.fromSecretKey(Uint8Array.from(entry.secretKey))

    try {
      const lamports = await connection.getBalance(kp.publicKey)
      if (lamports > (entry.seenSol ?? 0)) {
        const deltaSol = (lamports - (entry.seenSol ?? 0)) / LAMPORTS_PER_SOL
        const usd = deltaSol * priceOf('SOL')
        entry.seenSol = lamports
        dirty = true
        creditDeposit(user, usd, { asset: 'SOL', amount: deltaSol })
        console.log(`[deposits] ${user.slice(0, 8)}… +${deltaSol} SOL ($${usd.toFixed(2)})`)
      }

      const usdc = await usdcBalance(connection, kp.publicKey)
      if (usdc !== null && usdc > (entry.seenUsdc ?? 0)) {
        const delta = usdc - (entry.seenUsdc ?? 0)
        entry.seenUsdc = usdc
        dirty = true
        creditDeposit(user, delta, { asset: 'USDC', amount: delta })
        console.log(`[deposits] ${user.slice(0, 8)}… +${delta} USDC`)
      }
    } catch {
      /* RPC hiccup; retry next sweep */
    }
  }
  persist()
}

export function startDepositWatcher() {
  setInterval(() => sweep().catch(() => {}), POLL_MS)
  sweep().catch(() => {})
  console.log(`[deposits] watching on ${config.rpc.includes('devnet') ? 'devnet' : 'mainnet'} (USDC ${USDC_MINT.slice(0, 6)}…)`)
}
