import { useNavigate } from 'react-router-dom'
import { BottomNav } from './Home'

const games = [
  ['Free Fire', 'FF', 'game-card-green'],
  ['eFootball', 'EF', 'game-card-blue'],
  ['EA Sports FC 26', 'FC', 'game-card-purple'],
  ['Call of Duty Mobile', 'COD', 'game-card-red'],
  ['PUBG Mobile', 'PUBG', 'game-card-orange'],
]

export default function Games() {
  const navigate = useNavigate()

  function openGame(name: string) {
    navigate(`/games/${encodeURIComponent(name)}`)
  }

  return (
    <div className="app-shell">
      <main className="page-content">
        <div className="page-title">
          <span className="eyebrow">ARENA</span>
          <h1>Jeux</h1>
          <p>Choisis ton terrain de jeu.</p>
        </div>

        <div className="games-list">
          {games.map(([name, short, className]) => (
            <button
              type="button"
              className={`large-game-card ${className}`}
              key={name}
              onClick={() => openGame(name)}
            >
              <span className="large-game-symbol">{short}</span>

              <span>
                <strong>{name}</strong>
                <small>Disponible sur Arena</small>
              </span>

              <b>›</b>
            </button>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
