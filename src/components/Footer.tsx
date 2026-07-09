import { Link } from 'react-router-dom'
import { TRADE_FEE_BPS } from '../lib/store'

export function Footer() {
  return (
    <footer className="relative bg-navy">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white shadow-[0_3px_0_var(--color-accent-shadow)]">
                <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
                  <path d="M5 19 L11 5 L13 5 L19 19 L16.4 19 L15.1 15.6 L8.9 15.6 L7.6 19 Z M9.7 13.4 L14.3 13.4 L12 7.6 Z" fill="currentColor" />
                </svg>
              </span>
              <span className="font-display text-[22px] text-white">alutic</span>
            </span>
            <p className="mt-4 max-w-xs text-sm font-semibold leading-6 text-white/55">
              Auto copy-trade the smart money onchain. You pay {TRADE_FEE_BPS / 100}% when a trade actually
              executes, and that's the whole bill.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              ['Explore pilots', '/explore'],
              ['Create a vault', '/create'],
              ['How it works', '/how-it-works'],
              ['Dashboard', '/dashboard'],
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              ['Disclosures', '/legal#disclosures'],
              ['Terms', '/legal#terms'],
              ['Privacy', '/legal#privacy'],
            ]}
          />
        </div>

        <div className="mt-12 border-t-2 border-white/10 pt-6">
          <p className="text-xs leading-6 text-white/35">
            Alutic is in early access; trade execution currently runs in simulation while onchain settlement is being
            finalized. Nothing here is investment advice. Copy-trading carries risk of loss; past performance does not
            guarantee future results. Politician and fund portfolios are reconstructed from public filings (STOCK Act,
            13F) and are subject to disclosure lag, so you act on delayed, public information, never real-time. Alutic
            is not affiliated with or endorsed by any named individual, fund, or model provider. Tokenized-asset
            availability is subject to eligibility and jurisdiction.
          </p>
          <p className="mt-4 text-xs text-white/35">© 2026 Alutic. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-[11px] font-extrabold uppercase tracking-[2px] text-white/30">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} className="text-sm font-bold text-white/60 transition-colors hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
