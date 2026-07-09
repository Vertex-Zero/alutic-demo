import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PILOTS as STATIC_PILOTS, type Pilot } from '../data/pilots'

/**
 * API-backed store. The backend owns accounts, executes the autopilot
 * at live market prices, charges the 25 bps per-trade fee, and enforces
 * stop-losses. This client connects a real wallet, calls the REST API,
 * and polls for the latest portfolio and prices.
 */

export const TRADE_FEE_BPS = 25
export const TRADE_FEE_RATE = TRADE_FEE_BPS / 10_000
export const feeOn = (notional: number) => notional * TRADE_FEE_RATE

export type TradeKind = 'copy' | 'mirror' | 'exit' | 'deposit'

export interface Trade {
  id: string
  pilotId: string
  ticker: string
  assetName: string
  side: 'buy' | 'sell'
  notional: number
  fee: number
  at: number
  kind: TradeKind
}

export interface Position {
  pilotId: string
  allocation: number // cost basis (USD deployed)
  stopLoss: number
  copyMode: 'proportional' | 'fixed'
  openedAt: number
  tradeCount: number
  feesAccrued: number
  value: number // computed server-side at live prices
  pnlAbs: number
  pnlPct: number
}

export interface Quote {
  price: number
  changePct: number
  live: boolean
}

interface Account {
  address: string
  balance: number
  feesPaid: number
  tradesExecuted: number
  authorized: boolean
  positions: Position[]
  trades: Trade[]
}

const PORTFOLIO_POLL_MS = 6_000
const PRICES_POLL_MS = 30_000
const ADDR_KEY = 'alutic.address'

interface StoreApi {
  connected: boolean
  address: string
  authorized: boolean
  /** All pilots (built-in + community vaults) with real stats from the server. */
  pilots: Pilot[]
  getPilot: (id: string) => Pilot | undefined
  refreshPilots: () => void
  createVault: (input: { name: string; description: string; allocations: { ticker: string; weight: number }[] }) => Promise<Pilot>
  balance: number
  positions: Position[]
  trades: Trade[]
  feesPaid: number
  tradesExecuted: number
  deployed: number
  portfolioValue: number
  totalPnl: { abs: number; pct: number }
  prices: Record<string, Quote>
  pricesLive: boolean
  positionValue: (p: Position) => number
  positionPnl: (p: Position) => { abs: number; pct: number }
  connect: () => void
  walletModalOpen: boolean
  closeWalletModal: () => void
  connectWith: (option: WalletOption) => Promise<boolean>
  disconnect: () => void
  addFunds: (n: number) => void
  copy: (pilotId: string, allocation: number, opts?: { stopLoss?: number; copyMode?: Position['copyMode'] }) => void
  stop: (pilotId: string) => void
  isCopying: (pilotId: string) => boolean
}

const Ctx = createContext<StoreApi | null>(null)

function randomAddr(): string {
  const hex = '0123456789abcdef'
  let out = '0x'
  let seed = Date.now()
  for (let i = 0; i < 40; i++) {
    seed = (seed * 16807) % 2147483647
    out += hex[seed % 16]
  }
  return out
}

interface SolanaProvider {
  connect: () => Promise<{ publicKey?: { toString: () => string } } | boolean | void>
  publicKey?: { toString: () => string } | null
  signMessage: (msg: Uint8Array, encoding?: 'utf8') => Promise<{ signature: Uint8Array } | Uint8Array>
  isPhantom?: boolean
  isSolflare?: boolean
  isOkxWallet?: boolean
  isOKExWallet?: boolean
}

export interface WalletOption {
  id: string
  name: string
  kind: 'solana' | 'standard' | 'evm' | 'session'
  detected: boolean
  installUrl?: string
  icon?: string
}

type AnyWindow = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/* ── Wallet Standard discovery ─────────────────────────────────────────
 * Every modern Solana wallet (Phantom, Solflare, Backpack, OKX, ...)
 * registers itself through the wallet-standard events. Unlike the old
 * window.solana slot, wallets can't override each other here, so what
 * you see is what's genuinely installed. */

interface StandardWallet {
  name: string
  icon?: string
  chains?: readonly string[]
  features: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  accounts?: readonly { address: string }[]
}

const standardWallets = new Map<string, StandardWallet>()

function registerStandard(wallet: StandardWallet) {
  if (wallet?.name && wallet.chains?.some((c) => c.startsWith('solana:'))) {
    standardWallets.set(wallet.name.toLowerCase(), wallet)
  }
}

if (typeof window !== 'undefined') {
  const api = { register: (...ws: StandardWallet[]) => ws.forEach(registerStandard) }
  window.addEventListener('wallet-standard:register-wallet', ((e: CustomEvent) => {
    try {
      ;(e.detail as (a: typeof api) => void)(api)
    } catch {
      /* misbehaving wallet */
    }
  }) as EventListener)
  try {
    window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }))
  } catch {
    /* older browsers */
  }
}

async function standardSession(wallet: StandardWallet): Promise<WalletSession | null> {
  try {
    const connectFeature = wallet.features['standard:connect']
    const res = connectFeature ? await connectFeature.connect() : { accounts: wallet.accounts }
    const account = res?.accounts?.[0] ?? wallet.accounts?.[0]
    if (!account?.address) return null
    const address = account.address
    try {
      const { message, nonce } = await api<{ message: string; nonce: string }>(`/api/auth/message?address=${address}`)
      const signFeature = wallet.features['solana:signMessage']
      if (signFeature) {
        const outputs = await signFeature.signMessage({ account, message: new TextEncoder().encode(message) })
        const sig = outputs?.[0]?.signature
        if (sig) return { address, signature: toBase58(sig), nonce }
      }
      return { address }
    } catch {
      return { address } // connected; user declined the authorization signature
    }
  } catch {
    return null // user rejected the connect prompt
  }
}

function solanaProviderFor(id: string): SolanaProvider | null {
  const w = window as unknown as AnyWindow
  const okx = w.okxwallet?.solana ?? null
  switch (id) {
    case 'phantom': {
      // Other extensions (OKX among them) impersonate Phantom by injecting
      // window.solana / window.phantom. Only accept a provider that claims
      // isPhantom AND is not the same object another wallet injected.
      const candidate = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null)
      if (!candidate?.isPhantom) return null
      if (okx && candidate === okx) return null
      if (w.solflare && candidate === w.solflare) return null
      if (candidate.isOkxWallet || candidate.isOKExWallet) return null
      return candidate
    }
    case 'solflare':
      return w.solflare?.isSolflare ? w.solflare : (w.solflare ?? null)
    case 'okx':
      return okx
    case 'backpack':
      return w.backpack?.isBackpack ? w.backpack : null
    default:
      return null
  }
}

/**
 * Phantom-only for now (more wallets later). Detection prefers Phantom's
 * own Wallet Standard registration, which other extensions cannot fake,
 * and falls back to the legacy injected provider.
 */
export function detectWallets(): WalletOption[] {
  const standard = standardWallets.get('phantom')
  if (standard) {
    return [{ id: 'std:phantom', name: 'Phantom', kind: 'standard', detected: true, icon: standard.icon }]
  }
  return [
    {
      id: 'phantom',
      name: 'Phantom',
      kind: 'solana',
      detected: !!solanaProviderFor('phantom'),
      installUrl: 'https://phantom.app/download',
    },
  ]
}

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function toBase58(bytes: Uint8Array): string {
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  let out = ''
  while (n > 0n) {
    out = B58_ALPHABET[Number(n % 58n)] + out
    n /= 58n
  }
  for (const b of bytes) {
    if (b !== 0) break
    out = '1' + out
  }
  return out
}

interface WalletSession {
  address: string
  signature?: string
  nonce?: string
}

/**
 * Connect through a specific wallet. Solana wallets sign ONE autopilot
 * authorization message; after that there are no popups, ever — trades
 * execute server-side.
 */
async function sessionFor(option: WalletOption): Promise<WalletSession | null> {
  if (option.kind === 'session') return { address: randomAddr() }

  if (option.kind === 'standard') {
    const wallet = standardWallets.get(option.id.slice(4))
    return wallet ? standardSession(wallet) : null
  }

  if (option.kind === 'solana') {
    const provider = solanaProviderFor(option.id)
    if (!provider) return null
    try {
      const res = await provider.connect()
      const address =
        (typeof res === 'object' && res && 'publicKey' in res && res.publicKey?.toString()) ||
        provider.publicKey?.toString()
      if (!address) return null
      try {
        const { message, nonce } = await api<{ message: string; nonce: string }>(
          `/api/auth/message?address=${address}`,
        )
        const signed = await provider.signMessage(new TextEncoder().encode(message), 'utf8')
        const sigBytes = signed instanceof Uint8Array ? signed : signed.signature
        return { address, signature: toBase58(sigBytes), nonce }
      } catch {
        return { address } // connected but declined to authorize; still usable
      }
    } catch {
      return null // user rejected the wallet prompt
    }
  }

  const eth = (window as unknown as { ethereum?: { request?: (args: { method: string }) => Promise<string[]> } })
    .ethereum
  if (eth?.request) {
    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' })
      if (accounts && accounts[0]) return { address: accounts[0] }
    } catch {
      /* user rejected */
    }
  }
  return null
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `request failed (${res.status})`)
  return json as T
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [prices, setPrices] = useState<Record<string, Quote>>({})
  const [pricesLive, setPricesLive] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  // Fallback pilots carry identity only. Every number is zeroed so nothing
  // fabricated can ever render; real stats always come from the server.
  const [pilots, setPilots] = useState<Pilot[]>(() =>
    STATIC_PILOTS.map((p) => ({
      ...p,
      roi: { d7: 0, d30: 0, d90: 0, all: 0 },
      copiers: 0,
      aum: 0,
      winRate: 0,
      sharpe: 0,
      maxDrawdown: 0,
    })),
  )
  const addressRef = useRef<string>('')

  // pilots with real stats (and community vaults), refreshed periodically
  const refreshPilots = useCallback(() => {
    api<{ pilots: Pilot[] }>(`/api/pilots`)
      .then(({ pilots: p }) => {
        if (p.length > 0) setPilots(p)
      })
      .catch(() => {
        /* keep the static fallback */
      })
  }, [])

  useEffect(() => {
    refreshPilots()
    const id = setInterval(refreshPilots, 60_000)
    return () => clearInterval(id)
  }, [refreshPilots])

  const applyAccount = useCallback((a: Account) => {
    addressRef.current = a.address
    setAccount(a)
  }, [])

  // reconnect a previous session silently
  useEffect(() => {
    const saved = localStorage.getItem(ADDR_KEY)
    if (!saved) return
    api<{ account: Account }>(`/api/portfolio/connect`, { address: saved })
      .then(({ account: a }) => applyAccount(a))
      .catch(() => localStorage.removeItem(ADDR_KEY))
  }, [applyAccount])

  // poll the portfolio while connected
  useEffect(() => {
    const id = setInterval(() => {
      const address = addressRef.current
      if (!address) return
      api<{ account: Account }>(`/api/portfolio?address=${address}`)
        .then(({ account: a }) => setAccount(a))
        .catch(() => {
          /* transient network error: keep last snapshot */
        })
    }, PORTFOLIO_POLL_MS)
    return () => clearInterval(id)
  }, [])

  // poll live prices
  useEffect(() => {
    const pull = () =>
      api<{ prices: Record<string, Quote>; status: { live: number } }>(`/api/prices`)
        .then(({ prices: p, status }) => {
          setPrices(p)
          setPricesLive(status.live > 0)
        })
        .catch(() => {
          /* transient network error */
        })
    pull()
    const id = setInterval(pull, PRICES_POLL_MS)
    return () => clearInterval(id)
  }, [])

  const apiAction = useCallback(
    (path: string, body: Record<string, unknown>) => {
      const address = addressRef.current
      if (!address) return
      api<{ account: Account }>(path, { address, ...body })
        .then(({ account: a }) => applyAccount(a))
        .catch((e) => console.warn(`[alutic] ${path} failed:`, e.message))
    },
    [applyAccount],
  )

  const store = useMemo<StoreApi>(() => {
    const positions = account?.positions ?? []
    const deployed = positions.reduce((s, p) => s + p.allocation, 0)
    const positionsValue = positions.reduce((s, p) => s + p.value, 0)
    const balance = account?.balance ?? 0
    const pnlAbs = positionsValue - deployed

    return {
      connected: account !== null,
      address: account?.address ?? '',
      authorized: account?.authorized ?? false,
      pilots,
      getPilot: (id: string) => pilots.find((p) => p.id === id),
      refreshPilots,
      createVault: async (input) => {
        const address = addressRef.current
        if (!address) throw new Error('connect a wallet first')
        const { vault } = await api<{ vault: Pilot }>(`/api/vaults`, { address, ...input })
        refreshPilots()
        return vault
      },
      balance,
      positions,
      trades: account?.trades ?? [],
      feesPaid: account?.feesPaid ?? 0,
      tradesExecuted: account?.tradesExecuted ?? 0,
      deployed,
      portfolioValue: balance + positionsValue,
      totalPnl: { abs: pnlAbs, pct: deployed ? (pnlAbs / deployed) * 100 : 0 },
      prices,
      pricesLive,
      positionValue: (p) => p.value,
      positionPnl: (p) => ({ abs: p.pnlAbs, pct: p.pnlPct }),
      connect: () => setWalletModalOpen(true),
      walletModalOpen,
      closeWalletModal: () => setWalletModalOpen(false),
      connectWith: async (option) => {
        const session = await sessionFor(option)
        if (!session) return false // user rejected in the wallet
        try {
          const { account: a } = await api<{ account: Account }>(
            `/api/portfolio/connect`,
            session as unknown as Record<string, unknown>,
          )
          localStorage.setItem(ADDR_KEY, a.address)
          applyAccount(a)
          setWalletModalOpen(false)
          return true
        } catch (e) {
          console.warn('[alutic] connect failed:', e instanceof Error ? e.message : e)
          return false
        }
      },
      disconnect: () => {
        localStorage.removeItem(ADDR_KEY)
        addressRef.current = ''
        setAccount(null)
      },
      addFunds: (n) => apiAction('/api/deposit', { amount: n }),
      copy: (pilotId, allocation, opts) =>
        apiAction('/api/copy', { pilotId, allocation, stopLoss: opts?.stopLoss ?? 0, copyMode: opts?.copyMode }),
      stop: (pilotId) => apiAction('/api/stop', { pilotId }),
      isCopying: (pilotId) => positions.some((p) => p.pilotId === pilotId),
    }
  }, [account, prices, pricesLive, walletModalOpen, pilots, refreshPilots, apiAction, applyAccount])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): StoreApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
