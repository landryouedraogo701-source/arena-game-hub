import { useNavigate } from 'react-router-dom'
import { BottomNav } from './Home'

export default function Matches() {
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <main className="page-content">
        <div className="page-title">
          <span className="eyebrow">COMPÉTITION</span>
          <h1>Matchs</h1>
          <p>Affronte, gagne et progresse.</p>
        </div>

        <div className="tabs">
          <button className="tab active">Tous</button>
          <button className="tab">Amicaux</button>
          <button className="tab">Classés</button>
          <button className="tab">Tournois</button>
        </div>

        <button
          type="button"
          className="primary-button full-button"
          style={{ marginTop: '18px' }}
          onClick={() => navigate('/matches/search')}
        >
          🔎 Rechercher une salle
        </button>

        <div className="empty-card">
          <span>⚔</span>
          <strong>Aucun match disponible</strong>
          <p>Les prochains matchs apparaîtront ici.</p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
