import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from './Home'
import { supabase } from '../lib/supabase'

type LiveMatch = {
  id: string
  match_type: string
  format: string
  status: string
  room_code: string | null
  game: {
    name: string
    short_name: string | null
  } | null
}

export default function Lives() {
  const navigate = useNavigate()
  const [lives, setLives] = useState<LiveMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadLives() {
    const { data, error: liveError } = await supabase
      .from('matches')
      .select(`
        id,
        match_type,
        format,
        status,
        room_code,
        game:games (
          name,
          short_name
        )
      `)
      .eq('status', 'live')
      .order('created_at', { ascending: false })

    if (liveError) {
      setError(liveError.message)
      setLoading(false)
      return
    }

    const formatted = (data ?? []).map((item) => ({
      ...item,
      game: Array.isArray(item.game)
        ? (item.game[0] ?? null)
        : item.game,
    })) as LiveMatch[]

    setLives(formatted)
    setLoading(false)
  }

  useEffect(() => {
    loadLives()

    const interval = window.setInterval(loadLives, 3000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="app-shell">
      <main className="page-content">
        <div className="page-title">
          <span className="eyebrow">DIRECT</span>
          <h1>Lives</h1>
          <p>Regarde les affrontements en direct.</p>
        </div>

        {error && (
          <div className="empty-card">
            <strong>Erreur</strong>
            <p>{error}</p>
          </div>
        )}

        {loading && (
          <div className="empty-card">
            <strong>Chargement des Lives...</strong>
          </div>
        )}

        {!loading && !error && lives.length === 0 && (
          <>
            <div className="live-banner">
              <div className="live-dot">●</div>
              <div>
                <strong>Les Lives arrivent</strong>
                <p>Les diffusions Arena apparaîtront ici.</p>
              </div>
            </div>

            <div className="empty-card">
              <span>◉</span>
              <strong>Aucun Live actuellement</strong>
              <p>Lorsqu'une session sera lancée, elle sera visible ici.</p>
            </div>
          </>
        )}

        {!loading && lives.length > 0 && (
          <div style={{ display: 'grid', gap: '14px' }}>
            {lives.map((live) => (
              <div
                key={live.id}
                className="auth-card"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,60,60,0.35)',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'rgba(255,60,60,0.12)',
                    color: '#ff5b5b',
                    fontWeight: 800,
                    fontSize: '13px',
                  }}
                >
                  🔴 LIVE
                </div>

                <h2 style={{ margin: '14px 0 4px' }}>
                  {live.game?.name ?? 'Jeu'}
                </h2>

                <p style={{ margin: 0 }}>
                  {live.match_type} • {live.format}
                </p>

                <button
                  type="button"
                  className="primary-button full-button"
                  style={{ marginTop: '14px' }}
                  onClick={() => navigate(`/matches/${live.id}`)}
                >
                  ▶️ Ouvrir le match en direct
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
