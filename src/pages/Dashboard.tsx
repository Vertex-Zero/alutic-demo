import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, depositFromWallet, type Position, type Trade } from '../lib/store'
import { AreaChart, Sparkline } from '../components/Chart'
import { Avatar, btn } from '../components/ui'
import { NumberTicker } from '../components/effects'
import { Reveal, SectionLabel } from '../components/Reveal'
import { usd, pct, shortAddr, compact, num } from '../lib/format'

export function Dashboard() {
  const store = useStore()
  const { connected, address, authorized, balance, positions, deployed, portfolioValue, totalPnl, trades, feesPaid, tradesExecuted } = store
  const [hist, setHist] = useState<{ series: number[]; dates?: number[] }>({ series: [] })

  // real portfolio chart: composite of the positions' actual price history
  useEffect(() => {
    if (!connected || positions.length === 0) {
      setHist({ series: [] })
      return
    }
    let alive = true
    fetch(`/api/history?address=${address}&range=d90`)
      .then((r) => r.json())
      .then((h) => {
        if (alive && Array.isArray(h.series) && h.series.length > 1) setHist(h)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [connected, address, positions.length])

  if (!connected) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 text-center">
        <div className="liquid-glass grid h-16 w-16 place-items-center rounded-2xl">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.8">
            <rect x="2" y="6" width="20" height="13" rx="3" />
            <path d="M16 12h2M2 10h20" />
          </svg>
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium">Connect your wallet</h1>
        <p className="mt-3 text-muted">
          Connect a wallet to open your dashboard, put your autopilot on a pilot, and watch it trade.
        </p>
        <button className={btn('primary', 'mt-7 px-6 py-3')} onClick={store.connect}>
          Connect wallet
        </button>
      </div>
    )
  }

  // the portfolio chart only ever shows real market history
  const agg = hist.series

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
              {shortAddr(address)} · connected
              {authorized && (
                <span className="rounded-full bg-accent/[0.1] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-accent">
                  ✓ Autopilot authorized · no signatures needed
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button className={btn('ghost', 'px-4 py-2.5')} onClick={store.disconnect}>
              Disconnect
            </button>
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
                  className={`tnum mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm ${
                    totalPnl.abs >= 0 ? 'pill-up' : 'pill-down'
                  }`}
                >
                  {totalPnl.abs >= 0 ? '▲' : '▼'} {usd(Math.abs(totalPnl.abs))} ({pct(totalPnl.pct)})
                </div>
              </div>
              {agg.length > 1 && <Sparkline data={agg} width={160} height={56} stroke="var(--color-accent)" strokeWidth={2} />}
            </div>
            {agg.length > 1 && (
              <div className="mt-4">
                <AreaChart data={agg} dates={hist.dates} height={150} stroke="var(--color-accent)" />
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="grid h-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            <Tile label="Available USDC" value={usd(balance)} />
            <Tile label="Deployed" value={usd(deployed)} />
            <Tile
              label="Trades executed"
              value={num(tradesExecuted)}
              sub="by your autopilot"
            />
            <Tile
              label="Fees paid · 0.25%/trade"
              value={usd(feesPaid, { decimals: 2 })}
              accent="var(--color-accent)"
            />
          </div>
        </Reveal>
      </div>

      {/* real on-chain deposits */}
      <DepositCard address={address} />

      {/* your vaults */}
      <YourVaults address={address} />

      {/* positions */}
      <Reveal className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Copied pilots</h2>
          <Link to="/explore" className={btn('secondary', 'px-4 py-2')}>
            + Copy a pilot
          </Link>
        </div>
      </Reveal>

      {positions.length === 0 ? (
        <div className="card mt-5 rounded-2xl p-12 text-center">
          <p className="text-muted">You aren't copying any pilots yet.</p>
          {balance <= 0 && (
            <p className="mt-1 text-sm text-muted-2">Deposit USDC, then copy a pilot. Trades will start appearing below.</p>
          )}
          <Link to="/explore" className={btn('primary', 'mt-5 px-5 py-2.5')}>
            Explore pilots
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {positions.map((p) => (
            <PositionRow key={p.pilotId} position={p} />
          ))}
        </div>
      )}

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

      {trades.length === 0 ? (
        <div className="card mt-5 rounded-2xl p-10 text-center text-sm text-muted">
          No trades yet. Copy a pilot and your autopilot's executions will stream in here.
        </div>
      ) : (
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
      )}
    </div>
  )
}

function DepositCard({ address }: { address: string }) {
  const [info, setInfo] = useState<{ depositAddress: string; network: string; rpc: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [amount, setAmount] = useState('0.1')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (!address) return
    fetch(`/api/deposit-address?address=${address}`)
      .then((r) => r.json())
      .then((d) => d.depositAddress && setInfo(d))
      .catch(() => {})
  }, [address])

  if (!info) return null

  const copy = () => {
    void navigator.clipboard.writeText(info.depositAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const send = async () => {
    const sol = Number(amount)
    if (!(sol > 0)) return
    setSending(true)
    setStatus(null)
    try {
      const sig = await depositFromWallet(info.depositAddress, sol, info.rpc)
      setStatus({ ok: true, msg: `Sent ${sol} SOL. It will credit within ~30 seconds. Signature ${sig.slice(0, 16)}…` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'transfer failed'
      setStatus({
        ok: false,
        msg:
          info.network === 'devnet'
            ? `${msg}, note: the app is on devnet right now, so your wallet needs devnet SOL (Phantom: Settings > Developer Settings > Testnet Mode, then use a faucet).`
            : msg,
      })
    }
    setSending(false)
  }

  return (
    <div className="card mt-6 rounded-2xl px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
            Deposit funds · on-chain
            <span className={`rounded-full px-2 py-0.5 ${info.network === 'mainnet' ? 'bg-accent/[0.1] text-accent' : 'bg-gold/[0.1] text-gold'}`}>
              {info.network}
            </span>
          </div>
          <div className="tnum mt-1 break-all text-sm text-fg">{info.depositAddress}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border-2 border-line bg-white px-3 py-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="tnum w-16 bg-transparent text-right text-sm text-fg focus:outline-none"
            />
            <span className="text-xs font-extrabold text-muted-2">SOL</span>
          </div>
          <button onClick={() => void send()} disabled={sending} className={btn('accent', 'px-4 py-2 text-xs')}>
            {sending ? 'Check Phantom…' : 'Deposit from Phantom'}
          </button>
          <button onClick={copy} className={btn('secondary', 'px-4 py-2 text-xs')}>
            {copied ? '✓ Copied' : 'Copy address'}
          </button>
        </div>
      </div>
      {status && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${status.ok ? 'bg-accent/[0.08] text-accent' : 'bg-down/[0.08] text-down'}`}>
          {status.msg}
        </p>
      )}
      <p className="mt-3 text-xs leading-5 text-muted-2">
        Use the button, or send SOL/USDC to the address from any wallet. Deposits credit automatically at the live
        price within ~30 seconds, free of charge. To cash out, stop any active copies so the money is back in your
        balance, then withdraw below.
      </p>
      <WithdrawRow />
    </div>
  )
}

function WithdrawRow() {
  const { address, balance } = useStore()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  const withdraw = async () => {
    const usd = Number(amount)
    if (!(usd > 0)) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, amount: usd }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'withdrawal failed')
      setStatus({ ok: true, msg: `Sent ${json.sol.toFixed(4)} SOL to your wallet. Signature ${json.sig.slice(0, 16)}…` })
      setAmount('')
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : 'withdrawal failed' })
    }
    setBusy(false)
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">Withdraw to your wallet</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border-2 border-line bg-white px-3 py-2">
            <span className="text-xs font-extrabold text-muted-2">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder={balance > 0 ? balance.toFixed(2) : '0.00'}
              className="tnum w-20 bg-transparent text-right text-sm text-fg focus:outline-none"
            />
          </div>
          <button
            onClick={() => setAmount(balance.toFixed(2))}
            className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-fg/70 hover:border-line-2"
          >
            Max
          </button>
          <button onClick={() => void withdraw()} disabled={busy || !(Number(amount) > 0)} className={btn('primary', 'px-4 py-2 text-xs')}>
            {busy ? 'Sending…' : 'Withdraw'}
          </button>
        </div>
      </div>
      {status && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-bold ${status.ok ? 'bg-accent/[0.08] text-accent' : 'bg-down/[0.08] text-down'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}

function YourVaults({ address }: { address: string }) {
  const { pilots } = useStore()
  const mine = pilots.filter((p) => p.category === 'Community' && p.creator === address)

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-medium">Your vaults</h2>
        <Link to="/create" className={btn('accent', 'px-4 py-2')}>
          + Create a vault
        </Link>
      </div>
      {mine.length === 0 ? (
        <div className="card mt-5 rounded-2xl p-8 text-center text-sm text-muted">
          Build your own portfolio and earn <b className="text-accent">half of every trade fee</b> when people copy
          it. No cost to create.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {mine.map((v) => (
            <Link key={v.id} to={`/pilot/${v.id}`} className="card card-hover block rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-lg text-fg">{v.name}</div>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted">{v.tagline}</div>
                </div>
                <span
                  className="tnum shrink-0 text-lg"
                  style={{ color: v.roi.d30 >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}
                >
                  {pct(v.roi.d30)}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-5 border-t border-line pt-3 text-xs text-muted">
                <span>
                  <b className="tnum text-fg">{num(v.copiers)}</b> copiers
                </span>
                <span>
                  <b className="tnum text-fg">{usd(v.aum)}</b> copied
                </span>
                <span className="ml-auto rounded-full bg-accent/[0.1] px-2.5 py-1 font-extrabold text-accent">
                  earned {usd(v.earningsUsd ?? 0, { decimals: 2 })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const KIND_STYLE: Record<Trade['kind'], [string, string]> = {
  copy: ['COPY', 'text-accent bg-accent/[0.08] border-accent/25'],
  mirror: ['AUTO', 'text-blue bg-blue/[0.08] border-blue/25'],
  exit: ['EXIT', 'text-down bg-down/[0.07] border-down/25'],
  deposit: ['FUND', 'text-gold bg-gold/[0.08] border-gold/30'],
  withdraw: ['OUT', 'text-navy bg-navy/[0.06] border-navy/20'],
}

function TradeRow({ trade }: { trade: Trade }) {
  const { getPilot } = useStore()
  const pilot = getPilot(trade.pilotId)
  const [kindLabel, kindCls] = KIND_STYLE[trade.kind]
  const fresh = Date.now() - trade.at < 12_000
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm ${fresh ? 'feed-in' : ''}`}>
      <span className={`w-16 shrink-0`}>
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.08em] ${kindCls}`}>{kindLabel}</span>
      </span>
      <span className={`w-12 shrink-0 font-medium ${trade.side === 'buy' ? 't-up' : 't-down'}`}>
        {trade.side === 'buy' ? 'BUY' : 'SELL'}
      </span>
      <span className="tnum w-20 shrink-0 font-bold text-fg">{trade.ticker}</span>
      <span className="min-w-0 flex-1 truncate text-fg/70">
        {pilot?.name ?? trade.assetName}
        <span className="hidden text-muted-2 sm:inline"> · {trade.assetName}</span>
      </span>
      <span className="tnum w-24 shrink-0 text-right text-fg">{usd(trade.notional, { decimals: 2 })}</span>
      <span className="tnum w-20 shrink-0 text-right text-muted">{usd(trade.fee, { decimals: 2 })}</span>
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

function PositionRow({ position }: { position: Position }) {
  const store = useStore()
  const pilot = store.getPilot(position.pilotId)
  if (!pilot) return null
  const value = store.positionValue(position)
  const pnl = store.positionPnl(position)

  return (
    <div className="card card-hover rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link to={`/pilot/${pilot.id}`} className="flex min-w-0 flex-1 items-center gap-3.5">
          <Avatar pilot={pilot} size={46} />
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-medium text-fg">{pilot.name}</div>
            <div className="tnum text-xs text-muted">
              {compact(pilot.copiers)} copiers · {pilot.category}
            </div>
          </div>
        </Link>

        {pilot.spark && pilot.spark.length > 1 && <Sparkline data={pilot.spark} width={96} height={34} />}

        <div className="grid grid-cols-4 gap-5 sm:gap-7">
          <Col label="Deployed" value={usd(position.allocation)} />
          <Col label="Value" value={usd(value)} />
          <Col
            label="P&L"
            value={`${pnl.abs >= 0 ? '+' : ''}${usd(pnl.abs)}`}
            sub={pct(pnl.pct)}
            accent={pnl.abs >= 0 ? 'var(--color-up)' : 'var(--color-down)'}
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
          <button
            className={btn('ghost', 'px-3.5 py-2 text-xs text-down hover:bg-down/10')}
            onClick={() => store.stop(position.pilotId)}
          >
            Stop
          </button>
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

