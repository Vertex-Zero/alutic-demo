import { SectionLabel } from '../components/Reveal'
import { TRADE_FEE_BPS } from '../lib/store'

const SECTIONS = [
  {
    id: 'disclosures',
    title: 'Disclosures',
    body: [
      'Alutic is in early access. Deposits and market data are live; order execution currently runs in simulation at real market prices while onchain settlement is finalized.',
      'Nothing on this site is investment advice. Copy-trading carries risk of loss, and past performance does not guarantee future results.',
      'Politician and fund portfolios approximate the most recent public filings (STOCK Act periodic transaction reports and quarterly 13F filings) and are subject to disclosure lag: you act on delayed, public information, never real-time. Copying public disclosures is legal and is not insider trading.',
      'All displayed statistics (returns, Sharpe, drawdown, win rate) are computed from the real market price history of each portfolio’s holdings. Copier counts and assets under copy are actual platform numbers.',
      'Alutic is not affiliated with, sponsored by, or endorsed by any named individual, fund, or model provider. Tokenized-asset availability is subject to eligibility and jurisdiction; xStocks are restricted in some jurisdictions.',
    ],
  },
  {
    id: 'terms',
    title: 'Terms',
    body: [
      `Fees: Alutic charges ${TRADE_FEE_BPS / 100}% of the notional value of each executed trade (entry, auto-mirrored, and exit trades). There is no subscription, deposit, withdrawal, or account fee. Community vault creators receive half of the trade fee paid by their copiers.`,
      'Autopilot authorization: connecting a Solana wallet and signing the authorization message permits Alutic’s engine to execute copy trades for your account without further prompts. You can revoke this at any time by disconnecting.',
      'Custody: deposit addresses are held by the Alutic server on your behalf. Do not deposit more than you are prepared to lose while the service is in early access.',
      'The service is provided as-is, without warranty. You are responsible for compliance with the laws of your jurisdiction.',
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy',
    body: [
      'Alutic stores your wallet address, account balances, positions, and trade history to operate the service. No personal information beyond the wallet address is collected.',
      'On-chain activity (deposits, fee settlements) is public by the nature of blockchains.',
      'No analytics trackers or third-party advertising cookies are used.',
    ],
  },
]

export function Legal() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      <SectionLabel>The fine print</SectionLabel>
      <h1 className="mt-4 font-display text-[clamp(2rem,5vw,3rem)] text-navy">Legal</h1>
      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="mt-10">
          <h2 className="font-display text-xl text-navy">{s.title}</h2>
          <div className="mt-3 space-y-3">
            {s.body.map((p, i) => (
              <p key={i} className="text-sm leading-7 text-muted">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
