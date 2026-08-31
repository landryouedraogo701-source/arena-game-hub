import { Link } from 'react-router-dom'

const games = [
  { name: 'Free Fire', short: 'FF', className: 'game-card-green' },
  { name: 'eFootball', short: 'EF', className: 'game-card-blue' },
  { name: 'EA Sports FC 26', short: 'FC', className: 'game-card-purple' },
  { name: 'Call of Duty Mobile', short: 'COD', className: 'game-card-red' },
  { name: 'PUBG Mobile', short: 'PUBG', className: 'game-card-orange' },
]

export default function Home() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="brand-mark">A</span>
          <span className="brand-name">Arena</span>
        </div>
        <Link to="/profile" className="profile-button">●</Link>
      </header>

      <main className="page-content">
        <section className="hero-card">
          <div>
            <span className="eyebrow">ARENA GAME HUB</span>
            <h1>Joue. Affronte. Live.</h1>
            <p>Ton univers compétitif, réuni au même endroit.</p>
            <Link to="/games" className="primary-button">Explorer les jeux</Link>
          </div>
          <div className="hero-symbol">✦</div>
        </section>

        <section className="section">
          <div className="section-heading">
            <h2>Jeux populaires</h2>
            <Link to="/games">Voir tout</Link>
          </div>

          <div className="game-grid">
            {games.map((game) => (
              <Link to="/games" className={`game-card ${game.className}`} key={game.name}>
                <span className="game-symbol">{game.short}</span>
                <strong>{game.name}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <h2>À découvrir</h2>
          </div>

          <div className="feature-grid">
            <Link to="/matches" className="feature-card">
              <span>⚔</span>
              <div>
                <strong>Matchs</strong>
                <small>Affronte d'autres joueurs</small>
              </div>
            </Link>

            <Link to="/lives" className="feature-card live-feature">
              <span>●</span>
              <div>
                <strong>Lives</strong>
                <small>Regarde les matchs en direct</small>
              </div>
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <Link to="/" className="nav-item active"><span>⌂</span><small>Accueil</small></Link>
      <Link to="/games" className="nav-item"><span>◈</span><small>Jeux</small></Link>
      <Link to="/matches" className="nav-item"><span>⚔</span><small>Matchs</small></Link>
      <Link to="/lives" className="nav-item"><span>●</span><small>Lives</small></Link>
      <Link to="/profile" className="nav-item"><span>○</span><small>Profil</small></Link>
    </nav>
  )
}
