import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tokenizedUniverse } from '../data/pilots'
import { useStore, TRADE_FEE_BPS } from '../lib/store'
import { SectionLabel } from '../components/Reveal'
import { btn } from '../components/ui'
import { usd } from '../lib/format'

interface Row {
  ticker: string
  weight: number
}

export function CreateVault() {
  const { connected, connect, createVault, prices } = useStore()
  const navigate = useNavigate()
  const universe = useMemo(() => tokenizedUniverse(), [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<Row[]>([
    { ticker: 'NVDAx', weight: 50 },
    { ticker: 'AAPLx', weight: 50 },
  ])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const total = rows.reduce((s, r) => s + (r.weight || 0), 0)
  const used = new Set(rows.map((r) => r.ticker))
  const valid = name.trim().length >= 3 && rows.length >= 2 && total >= 95 && total <= 105

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addRow = () => {
    const next = universe.find((u) => !used.has(u.ticker))
    if (next) setRows((rs) => [...rs, { ticker: next.ticker, weight: 0 }])
  }
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i))

  const submit = async () => {
    setError('')
    setSaving(true)
    try {
      const vault = await createVault({ name, description, allocations: rows })
      navigate(`/pilot/${vault.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not create vault')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <SectionLabel>Community vaults</SectionLabel>
      <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3rem)] text-navy">Create your vault</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted">
        Build a portfolio from tokenized stocks. When people copy it, their autopilot mirrors your allocation and{' '}
        <b className="text-accent">you earn half of every trade fee they pay</b> ({TRADE_FEE_BPS / 200}% of each
        trade), credited straight to your balance. Free to create.
      </p>

      <div className="card mt-8 rounded-3xl p-6 sm:p-8">
        <label className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">Vault name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="e.g. Big Tech & Chill"
          className="mt-2 w-full rounded-xl border-2 border-line bg-white px-4 py-3 text-[15px] font-bold text-fg placeholder:font-semibold placeholder:text-muted-2 focus:border-blue focus:outline-none"
        />

        <label className="mt-5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">
          Description <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="What's the thesis?"
          className="mt-2 w-full rounded-xl border-2 border-line bg-white px-4 py-3 text-[15px] font-semibold text-fg placeholder:text-muted-2 focus:border-blue focus:outline-none"
        />

        <div className="mt-7 flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">Allocation</span>
          <span className={`tnum text-sm font-extrabold ${total >= 95 && total <= 105 ? 'text-accent' : 'text-down'}`}>
            {total}% / 100%
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((row, i) => {
            const q = prices[row.ticker]
            return (
              <div key={i} className="flex items-center gap-2.5">
                <select
                  value={row.ticker}
                  onChange={(e) => setRow(i, { ticker: e.target.value })}
                  className="w-44 rounded-xl border-2 border-line bg-white px-3 py-2.5 text-sm font-bold text-fg focus:border-blue focus:outline-none"
                >
                  {universe
                    .filter((u) => u.ticker === row.ticker || !used.has(u.ticker))
                    .map((u) => (
                      <option key={u.ticker} value={u.ticker}>
                        {u.ticker} · {u.name}
                      </option>
                    ))}
                </select>
                <span className="tnum hidden w-20 text-right text-xs text-muted sm:block">
                  {q ? usd(q.price, { decimals: 2 }) : ''}
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={row.weight || ''}
                  onChange={(e) => setRow(i, { weight: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  className="tnum w-20 rounded-xl border-2 border-line bg-white px-3 py-2.5 text-right text-sm text-fg focus:border-blue focus:outline-none"
                />
                <span className="text-sm font-bold text-muted-2">%</span>
                <button
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 2}
                  className="grid h-9 w-9 place-items-center rounded-xl text-muted-2 hover:bg-down/10 hover:text-down disabled:opacity-30"
                  aria-label="Remove asset"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>

        {rows.length < 12 && (
          <button onClick={addRow} className="mt-3 text-sm font-extrabold text-blue hover:underline">
            + Add asset
          </button>
        )}

        {error && <p className="mt-4 text-sm font-bold text-down">{error}</p>}

        <div className="mt-7">
          {!connected ? (
            <button className={btn('primary', 'w-full py-3.5')} onClick={connect}>
              Connect wallet to create
            </button>
          ) : (
            <button className={btn('accent', 'w-full py-3.5')} disabled={!valid || saving} onClick={submit}>
              {saving ? 'Creating…' : 'Create vault'}
            </button>
          )}
          {!valid && connected && (
            <p className="mt-2.5 text-center text-xs text-muted-2">
              {name.trim().length < 3 ? 'Name your vault (3+ characters). ' : ''}
              {total < 95 || total > 105 ? 'Weights must add up to 100%.' : ''}
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-2">
        Your vault is public: anyone can see its allocation and copy it. Performance is computed from the real market
        history of its holdings. You can't edit allocations after creation (copiers rely on them), so double-check
        the mix.
      </p>
    </div>
  )
}
