import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Footer } from './components/Footer'
import { WalletModal } from './components/WalletModal'
import { DEMO_MODE } from './lib/store'
import { Landing } from './pages/Landing'
import { Explore } from './pages/Explore'
import { CreateVault } from './pages/CreateVault'
import { PilotDetail } from './pages/PilotDetail'
import { Dashboard } from './pages/Dashboard'
import { HowItWorks } from './pages/HowItWorks'
import { Legal } from './pages/Legal'
import { NotFound } from './pages/NotFound'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function App() {
  return (
    <div className="min-h-screen bg-paper">
      <ScrollToTop />
      <Navbar />
      {DEMO_MODE && (
        <div className="bg-gold/[0.12] px-4 py-1.5 text-center text-[11px] font-extrabold uppercase tracking-[1px] text-gold">
          Demo · simulated balances and fills at real market prices · no real funds move
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/create" element={<CreateVault />} />
          <Route path="/pilot/:id" element={<PilotDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <WalletModal />
    </div>
  )
}
