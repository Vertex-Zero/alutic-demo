import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Reveal, SectionLabel } from '../components/Reveal'
import { btn } from '../components/ui'

const STEPS = [
  {
    n: '01',
    title: 'Connect your wallet',
    body: 'Connect Phantom in one click, with more wallets on the way. There is nothing to bridge and no brokerage paperwork, because Alutic runs on Solana, where nearly all tokenized-stock volume already trades.',
  },
  {
    n: '02',
    title: 'Fund with USDC, free',
    body: 'Deposits and withdrawals cost nothing beyond network gas, which is typically under a cent. Alutic never charges you for moving your own money or for simply having an account.',
  },
  {
    n: '03',
    title: 'Choose your pilots',
    body: 'Politicians under the STOCK Act, hedge-fund legends via 13F filings, and AI models with published decision logs. Every pilot shows return, risk, drawdown, Sharpe and live copier count.',
  },
  {
    n: '04',
    title: 'Authorize the autopilot, once',
    body: 'You sign one message. That single approval lets the engine execute trades for you: no popup per trade, no confirmations at 3am. It is scoped to trading only, capped at your allocation, and revocable anytime.',
  },
  {
    n: '05',
    title: 'The autopilot trades for you',
    body: 'When a new filing lands or a model rebalances, the engine batches one transaction and executes it proportionally across every copier. Each execution takes a 0.25% protocol fee, that’s how Alutic earns, and the only way.',
  },
  {
    n: '06',
    title: 'Watch it live. Leave whenever.',
    body: 'Every trade and every fee is logged on your dashboard and verifiable onchain. Stop a copy and the basket sells back to USDC in your account in seconds. No lock-up, no exit penalty beyond the 0.25% on the exit trade itself.',
  },
]

const ARCH = [
  {
    title: 'Built on Solana, not our chain',
    body: 'Alutic deliberately has no token and no blockchain of its own. A new L1 would add nothing but risk, and a platform token would just be a fee with extra steps. Your money stays as USDC on Solana, the network where 95%+ of tokenized-stock volume already trades.',
  },
  {
    title: 'xStocks do the work',
    body: 'Each position is an xStock: a Solana token backed 1:1 by the real share held with a regulated custodian. They trade 24/7 on Solana exchanges through Jupiter, in fractions, settling in seconds, which is what makes $0-minimum, always-on copy-trading possible.',
  },
  {
    title: 'One approval makes it automatic',
    body: 'Auto-trading normally means a wallet popup for every trade. Solana token delegation breaks that trade-off: you approve the autopilot once, capped at your allocation, and the engine trades within that approval. Never a withdrawal, revocable anytime.',
  },
]

const FAQ = [
  {
    q: 'How is Alutic free when Autopilot charges a subscription and a $500 minimum per portfolio?',
    a: 'Legacy copy-trading apps route through a US brokerage, which forces a funded account per portfolio and a subscription to cover per-trade brokerage costs. Alutic replaces the brokerage with tokenized stocks onchain, fractional by default, settled peer-to-contract. With no broker to pay, the only fee left is ours: 0.25% of each executed trade, charged in USDC at execution.',
  },
  {
    q: 'So what does copying actually cost?',
    a: 'Deploy $1,000 on a pilot and the entry basket costs $2.50 in fees. After that, a typical auto-mirrored trade moves $10-60 of a $1,000 position, so each costs 3-15 cents. A pilot who trades ~11 times a month costs you roughly a dollar a month, and a pilot who doesn’t trade costs you $0.',
  },
  {
    q: 'Why don’t you have your own token or blockchain?',
    a: 'Because neither would make copying better. A platform token would add regulatory risk and force you to hold a volatile asset just to use the product; a proprietary chain would trade real security for marketing. Charging a transparent USDC fee per trade keeps the product simple and our incentives aligned with your activity, not your lock-in.',
  },
  {
    q: 'How can it auto-trade without a wallet popup every time?',
    a: 'Solana supports token delegation: you sign one approval that lets Alutic’s engine trade up to your allocated amount, and only trade. After that single signature the autopilot executes every mirrored trade on its own, day and night. It can never withdraw your funds, and you can revoke the approval with one click.',
  },
  {
    q: 'Is copying politicians’ trades legal?',
    a: 'Yes. Members of Congress must disclose securities trades under the STOCK Act, generally within 45 days. Acting on those public filings is legal and is not insider trading, it uses public information. The trade-off is the disclosure lag: you act on delayed data, never in real time.',
  },
  {
    q: 'What are tokenized stocks?',
    a: 'A tokenized stock is an onchain token backed 1:1 by a real share held in custody (think xStocks, Ondo, Dinari). It trades 24/7, fractionally, and settles in seconds, which is what makes no-minimum, always-on copy-trading possible.',
  },
  {
    q: 'How fast does my portfolio track the pilot?',
    a: 'For AI pilots, mirroring is near-instant on each rebalance. For politician and hedge-fund pilots, you’re bound by the disclosure schedule, STOCK Act filings (≤45 days) and quarterly 13Fs, so expect a lag measured in days to weeks. Alutic executes the moment a filing becomes public.',
  },
]

export function HowItWorks() {
  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden px-5 py-20 sm:px-8">
        <div className="glow-accent pointer-events-none absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2" />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <div className="flex justify-center"><SectionLabel>How it works</SectionLabel></div>
          <h1 className="mt-5 font-display text-[clamp(2.4rem,7vw,4.4rem)] font-medium leading-[1.04] tracking-[-0.02em]">
            Copy-trading, <em className="text-accent">rebuilt onchain</em>
          </h1>
          <p className="text-balance mx-auto mt-6 max-w-xl text-base leading-7 text-muted">
            We took the model behind subscription copy-trading apps and removed the brokerage, the minimum and the
            monthly fee. What's left is one number: 0.25% per executed trade.
          </p>
        </Reveal>
      </section>

      {/* steps */}
      <section className="mx-auto max-w-5xl px-5 pb-8 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={(i % 2) * 0.06} className="h-full">
              <div className="flex h-full gap-5 bg-surface p-7">
                <div className="tnum text-lg text-accent">{s.n}</div>
                <div>
                  <h3 className="font-display text-lg font-medium">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* architecture: why no token, no L1 */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <div className="card rounded-3xl p-8 sm:p-12">
          <Reveal>
            <SectionLabel>The architecture</SectionLabel>
            <h2 className="mt-5 max-w-2xl font-display text-[clamp(1.8rem,4vw,2.6rem)] font-medium tracking-[-0.01em]">
              Why we never launched a token <em className="text-accent">(or our own chain)</em>
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {ARCH.map((a, i) => (
              <Reveal key={a.title} delay={i * 0.06}>
                <div>
                  <div className="font-display text-lg font-medium text-accent">{a.title}</div>
                  <p className="mt-2 text-sm leading-6 text-muted">{a.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-10 border-t border-line pt-6 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
              <span><b className="text-accent">0.25%</b> per executed trade, the whole model</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <Reveal>
          <h2 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-medium tracking-[-0.01em]">
            Frequently asked
          </h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {FAQ.map((f, i) => (
            <Faq key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8">
        <Reveal>
          <h2 className="font-display text-[clamp(1.8rem,5vw,3rem)] font-medium tracking-[-0.01em]">
            Ready to put your money on autopilot?
          </h2>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/explore" className={btn('primary', 'px-7 py-3.5')}>
              Explore pilots
            </Link>
            <Link to="/dashboard" className={btn('secondary', 'px-7 py-3.5')}>
              Open dashboard
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="font-medium text-fg">{q}</span>
        <svg
          className={`shrink-0 text-accent transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm leading-7 text-muted">{a}</p>
        </div>
      </div>
    </div>
  )
}
