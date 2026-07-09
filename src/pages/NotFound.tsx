import { Link } from 'react-router-dom'
import { btn } from '../components/ui'

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-5 text-center">
      <div className="tnum font-display text-7xl font-semibold text-accent">404</div>
      <h1 className="mt-4 font-display text-2xl font-semibold">This pilot took off without us</h1>
      <p className="mt-3 text-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <Link to="/explore" className={btn('primary', 'mt-7 px-6 py-3')}>
        Back to leaderboard
      </Link>
    </div>
  )
}
