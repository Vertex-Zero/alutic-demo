import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, detectWallets, type WalletOption } from '../lib/store'

const GLYPH: Record<string, string> = {
  phantom: '👻',
  solflare: '🔆',
  okx: '⭕',
  backpack: '🎒',
  metamask: '🦊',
  coinbase: '🔵',
  session: '🧪',
}

function WalletIcon({ id, icon, dim }: { id: string; icon?: string; dim?: boolean }) {
  if (icon) {
    return <img src={icon} alt="" className={`h-6 w-6 rounded-md ${dim ? 'grayscale' : ''}`} />
  }
  return <span className={dim ? 'grayscale' : ''}>{GLYPH[id] ?? '👛'}</span>
}

const isMobile = () =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod|android/i.test(navigator.userAgent)

/** Universal link that reopens this page inside Phantom's in-app browser,
 *  where the wallet is available and connect works like on desktop. */
const phantomDeepLink = () =>
  `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`

export function WalletModal() {
  const { walletModalOpen, closeWalletModal, connectWith } = useStore()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const wallets = useMemo(() => (walletModalOpen ? detectWallets() : []), [walletModalOpen])
  const available = wallets.filter((w) => w.detected)
  const missing = wallets.filter((w) => !w.detected)

  const pick = async (w: WalletOption) => {
    setBusy(true)
    setError('')
    const okConnect = await connectWith(w)
    setBusy(false)
    if (okConnect) {
      navigate('/dashboard') // something visibly happens after the wallet confirms
    } else {
      setError('Connection didn’t complete. Approve both prompts in your wallet, then try again.')
    }
  }

  return (
    <AnimatePresence>
      {walletModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-navy/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={closeWalletModal}
        >
          <motion.div
            initial={{ y: 32, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="w-full max-w-md rounded-3xl border-2 border-line bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-xl text-navy">Connect a wallet</h3>
                <p className="mt-1 text-sm text-muted">
                  Connect and approve once, then your autopilot runs without ever interrupting you. Phantom for
                  now, with more wallets on the way.
                </p>
              </div>
              <button
                onClick={closeWalletModal}
                className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-fg/5"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-xl bg-down/[0.08] px-3 py-2 text-xs font-bold text-down">{error}</p>
            )}

            <div className="mt-5 space-y-2">
              {busy && <p className="px-1 pb-1 text-xs font-bold text-muted">Check your wallet for the prompts…</p>}
              {available.map((w) => (
                <button
                  key={w.id}
                  disabled={busy}
                  onClick={() => void pick(w)}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-line px-4 py-3 text-left transition-all hover:border-accent hover:bg-accent/[0.05] disabled:opacity-50"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-paper-2 text-lg">
                    <WalletIcon id={w.id} icon={w.icon} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-extrabold text-fg">{w.name}</span>
                  </span>
                  <span className="rounded-full bg-accent/[0.1] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-accent">
                    Available
                  </span>
                </button>
              ))}
            </div>

            {missing.length > 0 && isMobile() && (
              <div className="mt-2 space-y-2">
                <a
                  href={phantomDeepLink()}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-accent bg-accent/[0.05] px-4 py-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-paper-2 text-lg">
                    <WalletIcon id="phantom" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-extrabold text-fg">Open in Phantom</span>
                    <span className="block text-xs text-muted-2">Continues in the Phantom app's browser</span>
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-wide text-accent">Open →</span>
                </a>
                <p className="px-1 pt-1 text-xs leading-5 text-muted-2">
                  On phones, wallets live inside their own apps. This reopens Alutic inside Phantom, where you can
                  connect normally. Don't have Phantom yet?{' '}
                  <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="font-bold text-accent underline">
                    Get it here.
                  </a>
                </p>
              </div>
            )}

            {missing.length > 0 && !isMobile() && (
              <div className="mt-2 space-y-2">
                {missing.map((w) => (
                  <a
                    key={w.id}
                    href={w.installUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-line px-4 py-3 transition-colors hover:border-accent hover:bg-accent/[0.05]"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-paper-2 text-lg">
                      <WalletIcon id={w.id} icon={w.icon} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-extrabold text-fg">Install {w.name}</span>
                      <span className="block text-xs text-muted-2">Not detected in this browser</span>
                    </span>
                    <span className="text-xs font-extrabold uppercase tracking-wide text-accent">Install →</span>
                  </a>
                ))}
                <p className="px-1 pt-1 text-xs leading-5 text-muted-2">
                  After installing the extension, refresh this page and Phantom will show as available here.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
