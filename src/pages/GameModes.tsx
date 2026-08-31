import { useNavigate, useParams } from 'react-router-dom'

export default function GameModes() {
  const navigate = useNavigate()
  const { gameName } = useParams()

  const game = decodeURIComponent(gameName ?? 'Jeu')

  return (
    <div className="app-shell">
      <main className="page-content">
        <div className="page-title">
          <span className="eyebrow">ARENA</span>
          <h1>{game}</h1>
          <p>Choisis comment tu veux jouer.</p>
        </div>

        <div className="auth-card">

          <button
            type="button"
            className="secondary-button full-button"
            onClick={() =>
              navigate(`/create-match?game=${encodeURIComponent(game)}`)
            }
          >
            🤝 Match amical
            <small>Affronte un joueur en 1v1</small>
          </button>

          <button
            type="button"
            className="secondary-button full-button"
            onClick={() =>
              navigate(`/competition/create?game=${encodeURIComponent(game)}`)
            }
          >
            ⚔️ Compétition
            <small>Organise une compétition entre plusieurs joueurs</small>
          </button>

          <button
            type="button"
            className="secondary-button full-button"
            onClick={() =>
              navigate(`/tournament/create?game=${encodeURIComponent(game)}`)
            }
          >
            🏆 Tournoi
            <small>Crée un tournoi avec élimination jusqu'à la finale</small>
          </button>

          <button
            type="button"
            className="auth-link"
            onClick={() => navigate('/games')}
          >
            ← Retour aux jeux
          </button>

        </div>
      </main>
    </div>
  )
}
