import { Link } from 'react-router-dom'
import { Hero } from '../components/Hero'
import { TickerTape } from '../components/TickerTape'
import { Reveal, SectionLabel } from '../components/Reveal'
import { Sparkline } from '../components/Chart'
import { Avatar, CategoryBadge, btn } from '../components/ui'
import { pct, compact, usd } from '../lib/format'
import { feeOn, useStore } from '../lib/store'

const UNLOCK = [
  { label: 'Monthly subscription', then: '$29 - $100 / mo', now: '$0' },
  { label: 'Deposit & withdrawal fees', then: 'Wire + brokerage fees', now: '$0' },
  { label: 'Minimum to follow a portfolio', then: '$500 per portfolio', now: '$0, fractional' },
  { label: 'What Alutic earns', then: 'Your fee, win or lose', now: '0.25% per executed trade' },
  { label: 'What you need', then: 'A funded US brokerage', now: 'A wallet' },
  { label: 'Settlement', then: 'T+1, market hours only', now: '24/7, seconds, onchain' },
]

const STEPS = [
  ['01', 'Connect your wallet', 'One click with Phantom and you are in. Alutic runs on Solana, where nearly all tokenized-stock trading already happens, so there is nothing to bridge and nobody asking for brokerage paperwork.'],
  ['02', 'Pick your pilots', 'Politicians, hedge-fund legends and AI models, reconstructed from public disclosures. Sort by return, risk, Sharpe or copiers.'],
  ['03', 'Approve the autopilot, once', 'You sign a single authorization. After that there are no popups, ever: trades execute automatically and you can revoke access anytime.'],
  ['04', 'It trades. You watch.', 'Every new filing or model rebalance executes across every copier automatically, each trade logged with its 0.25% fee, live on your dashboard.'],
]

const FEATURED = ['pelosi', 'deepseek', 'buffett']

export function Landing() {
  const { getPilot } = useStore()
  return (
    <div>
      <Hero />

      <TickerTape />

      {/* the unlock: broadsheet then/now table */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <SectionLabel>The unlock</SectionLabel>
              <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.1rem)] font-medium leading-[1.06] tracking-[-0.01em]">
                Copy-trading was gated for decades. <em className="text-accent">Tokenized assets opened it.</em>
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-7 text-muted">
                Tokenized stocks settle onchain, fractionally, around the clock. That single change removes the
                brokerage, the minimum, and the monthly fee. What's left is one honest number.
              </p>
              <Link to="/how-it-works" className={btn('secondary', 'mt-7 px-5 py-2.5')}>
                Read the thesis
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="grid gap-5 sm:grid-cols-2">
              {/* the old way */}
              <div className="rounded-3xl bg-paper-2 p-6 sm:p-7">
                <div className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-muted-2">The old way</div>
                <ul className="mt-5 space-y-5">
                  {UNLOCK.map((r) => (
                    <li key={r.label}>
                      <div className="text-xs font-bold uppercase tracking-wide text-muted-2">{r.label}</div>
                      <div className="mt-0.5 text-[15px] font-bold text-muted">{r.then}</div>
                    </li>
                  ))}
                </ul>
              </div>
              {/* alutic */}
              <div className="rounded-3xl bg-accent p-6 text-white shadow-[0_5px_0_var(--color-accent-shadow)] sm:p-7">
                <div className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-white/70">With Alutic</div>
                <ul className="mt-5 space-y-5">
                  {UNLOCK.map((r) => (
                    <li key={r.label}>
                      <div className="text-xs font-bold uppercase tracking-wide text-white/60">{r.label}</div>
                      <div className="tnum mt-0.5 text-[15px] text-white">{r.now}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* the fee, the whole business model (green panel) */}
      <section className="bg-accent">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-[auto_1fr] md:gap-16">
          <Reveal>
            <div className="font-display text-[clamp(4.5rem,15vw,10rem)] leading-none text-white">
              0.25<span className="text-[0.55em]">%</span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div>
              <p className="max-w-lg text-balance font-display text-2xl leading-9 text-white">
                per executed trade. that's the entire business model.
              </p>
              <p className="mt-4 max-w-lg text-[15px] font-semibold leading-7 text-white/75">
                There's no subscription and we never take a cut of your profits. Alutic only earns when your
                autopilot actually trades, which keeps us focused on executing your pilots' moves faithfully
                instead of locking you in.
              </p>
              <div className="mt-7 max-w-lg rounded-2xl border-2 border-white/25 bg-white/[0.12] p-5">
                <div className="text-[10px] font-extrabold uppercase tracking-[2px] text-white/60">Worked example</div>
                <div className="mt-3 space-y-2 text-sm">
                  <FeeRow label={`Copy Pelosi Tracker with ${usd(1000)}`} value={`${usd(feeOn(1000), { decimals: 2 })} entry fee`} />
                  <FeeRow label="Each auto-mirrored trade (~$10-60)" value="3 - 15¢" />
                  <FeeRow label="Monthly cost at her pace (11 trades)" value="≈ $1 total" />
                  <FeeRow label="If she never trades" value="$0.00" accent />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* featured pilots */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel>The roster</SectionLabel>
              <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.1rem)] font-medium tracking-[-0.01em]">
                Names you already follow
              </h2>
            </div>
            <Link to="/explore" className={btn('secondary', 'px-5 py-2.5')}>
              View the full board →
            </Link>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURED.map((id, i) => {
            const p = getPilot(id)
            if (!p) return null
            return (
              <Reveal key={id} delay={i * 0.07}>
                <Link to={`/pilot/${p.id}`} className="card card-hover block rounded-2xl p-6">
                  <div className="flex items-start justify-between">
                    <Avatar pilot={p} size={52} />
                    <CategoryBadge category={p.category} />
                  </div>
                  <h3 className="mt-4 font-display text-xl font-medium text-fg">{p.name}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">{p.tagline}</p>
                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-2">30D return</div>
                      <div className="tnum mt-0.5 text-2xl" style={{ color: p.roi.d30 >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
                        {pct(p.roi.d30)}
                      </div>
                    </div>
                    {p.spark && p.spark.length > 1 && <Sparkline data={p.spark} width={110} height={40} />}
                  </div>
                  <div className="mt-4 border-t border-line pt-3 text-xs text-muted-2">
                    <span className="tnum">{compact(p.copiers)}</span> copiers · <span className="tnum">{p.trades30d}</span> trades / 30D
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* how it works: numbered editorial list */}
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <Reveal>
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-5 max-w-xl font-display text-[clamp(2rem,4.5vw,3.1rem)] font-medium tracking-[-0.01em]">
            From wallet to autopilot in under a minute
          </h2>
        </Reveal>

        <div className="mt-12">
          <div className="rule-double" />
          {STEPS.map(([n, title, body], i) => (
            <Reveal key={n} delay={(i % 2) * 0.05}>
              <div className="group grid items-start gap-4 border-t border-line py-8 transition-colors first-of-type:border-t-0 hover:bg-fg/[0.015] md:grid-cols-[110px_1fr_2fr] md:gap-10">
                <div className="tnum text-2xl text-muted-2 transition-colors group-hover:text-accent">{n}</div>
                <h3 className="font-display text-xl font-medium text-fg">{title}</h3>
                <p className="max-w-xl text-[15px] leading-7 text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
          <div className="rule-double" />
        </div>
      </section>

      {/* final CTA */}
      <section className="relative overflow-hidden px-5 pb-28 pt-8 sm:px-8">
        <div className="glow-accent pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[760px] -translate-x-1/2 -translate-y-1/2" />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[clamp(2.4rem,7vw,4.4rem)] font-medium leading-[1.04] tracking-[-0.02em]">
            The smart money discloses.
            <br />
            <em className="text-accent">Your wallet can act on it.</em>
          </h2>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/explore" className={btn('primary', 'px-7 py-3.5 text-[15px]')}>
              Open the board
            </Link>
            <Link to="/dashboard" className={btn('secondary', 'px-7 py-3.5 text-[15px]')}>
              Open dashboard
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

function FeeRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-semibold text-white/75">{label}</span>
      <span className={`tnum shrink-0 text-white ${accent ? 'underline decoration-2 underline-offset-4' : ''}`}>{value}</span>
    </div>
  )
}
