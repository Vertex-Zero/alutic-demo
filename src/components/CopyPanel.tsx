import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Pilot } from '../data/pilots'
import { useStore, feeOn, TRADE_FEE_BPS } from '../lib/store'
import { btn } from './ui'
import { usd } from '../lib/format'

const STOP_OPTIONS = [0, 5, 10, 20, 30]

export function CopyPanel({ pilot }: { pilot: Pilot }) {
  const { connected, balance, connect, copy, isCopying } = useStore()
  const [amount, setAmount] = useState(500)
  const [stopLoss, setStopLoss] = useState(10)
  const [mode, setMode] = useState<'proportional' | 'fixed'>('proportional')
  const [done, setDone] = useState(false)

  const copying = isCopying(pilot.id)
  const tooMuch = amount > balance
  const canCopy = connected && balance > 0 && amount > 0 && !tooMuch
  const entryFee = feeOn(amount)
  // typical auto-mirror trade is 1-6% of the allocation
  const perTradeLow = feeOn(amount * 0.01)
  const perTradeHigh = feeOn(amount * 0.06)

  const onCopy = () => {
    copy(pilot.id, amount, { stopLoss, copyMode: mode })
    setDone(true)
    setTimeout(() => setDone(false), 2600)
  }

  return (
    <div className="card relative overflow-hidden rounded-2xl p-6">
      <div className="glow-accent pointer-events-none absolute -right-16 -top-16 h-48 w-48" />
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-medium">Copy this pilot</h3>
        <span className="rounded-full border border-accent/25 bg-accent/[0.08] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-accent">
          $0 / month
        </span>
      </div>

      {/* allocation */}
      <label className="mt-6 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
        Allocation (USDC)
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-3.5 py-3">
        <span className="text-muted">$</span>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          className="tnum w-full bg-transparent text-lg text-fg focus:outline-none"
        />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {[100, 500, 1000, 5000].map((v) => (
          <button
            key={v}
            onClick={() => setAmount(v)}
            className="rounded-full border border-line px-2.5 py-1 text-xs text-fg/70 transition-colors hover:border-line-2 hover:text-fg"
          >
            ${v.toLocaleString()}
          </button>
        ))}
        {connected && balance > 0 && (
          <button
            onClick={() => setAmount(Math.floor(balance))}
            className="rounded-full border border-accent/30 bg-accent/[0.08] px-2.5 py-1 text-xs text-accent"
          >
            Max
          </button>
        )}
      </div>
      {connected && balance > 0 && tooMuch && (
        <p className="mt-2 text-xs font-bold text-down">Amount exceeds your available balance.</p>
      )}

      {/* copy mode */}
      <div className="mt-5">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">Copy mode</div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-surface-2/70 p-1">
          {(['proportional', 'fixed'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg py-2 text-sm capitalize transition-colors ${
                mode === m ? 'bg-accent text-white' : 'text-fg/70 hover:text-fg'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* stop loss */}
      <div className="mt-5">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">Copy stop-loss</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STOP_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStopLoss(s)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                stopLoss === s ? 'bg-fg/[0.08] text-fg ring-1 ring-line-2' : 'text-fg/60 hover:text-fg'
              }`}
            >
              {s === 0 ? 'Off' : `-${s}%`}
            </button>
          ))}
        </div>
      </div>

      {/* the fee math, spelled out */}
      <div className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
        <Row label="You deploy" value={usd(amount)} />
        <Row label={`Entry fee (${TRADE_FEE_BPS / 100}%)`} value={usd(entryFee, { decimals: 2 })} />
        <Row
          label="Each auto-mirrored trade"
          value={`${usd(perTradeLow, { decimals: 2 })} - ${usd(perTradeHigh, { decimals: 2 })}`}
        />
        <Row label="Subscription · deposit fee" value="$0 · $0" accent />
      </div>
      {/* action */}
      <div className="mt-5">
        {!connected ? (
          <button className={btn('primary', 'w-full py-3')} onClick={connect}>
            Connect wallet to copy
          </button>
        ) : balance <= 0 ? (
          <div>
            <Link to="/dashboard" className={btn('accent', 'w-full py-3')}>
              Deposit funds to start
            </Link>
            <p className="mt-2 text-center text-xs text-muted-2">
              Send SOL or USDC from your wallet on the dashboard; it credits automatically.
            </p>
          </div>
        ) : (
          <button className={btn('accent', 'w-full py-3')} disabled={!canCopy} onClick={onCopy}>
            {copying ? `Add ${usd(amount)} to copy` : `Start autopilot · ${usd(amount)}`}
          </button>
        )}
        {connected && (
          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-2">
            <span>Available: {usd(balance)}</span>
            <Link to="/dashboard" className="text-accent hover:underline">
              Manage in dashboard →
            </Link>
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-muted-2">
        Not investment advice. {pilot.disclosureLag ? pilot.disclosureLag + '. ' : ''}You act on delayed, public
        information. Capital at risk.
      </p>

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 whitespace-nowrap rounded-full border border-accent/40 bg-surface px-5 py-3 text-sm shadow-2xl"
          >
            <span className="text-accent">✓</span> Autopilot engaged for {pilot.name} ·{' '}
            <Link to="/dashboard" className="underline">
              watch it trade
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tnum ${accent ? 'text-accent' : 'text-fg'}`}>{value}</span>
    </div>
  )
}
