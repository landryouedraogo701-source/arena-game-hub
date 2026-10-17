import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from './Home'
import { supabase } from '../lib/supabase'

type LiveSession = {
  id: string
  match_id: string | null
  title: string | null
  description: string | null
  status: string
  stream_state: string | null
  last_heartbeat_at: string | null
  provider: string | null
  room_name: string | null
  viewer_count: number | null
  game: { name: string; short_name: string | null } | null
}

const HEARTBEAT_MAX_AGE_MS = 45_000
const REFRESH_INTERVAL_MS = 15_000

export default function Lives() {
  const navigate = useNavigate()
  const [lives, setLives] = useState<LiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadLives = useCallback(async () => {
    setError('')
    const cutoff = new Date(Date.now() - HEARTBEAT_MAX_AGE_MS).toISOString()
    const { data, error: liveError } = await supabase
      .from('live_sessions')
      .select(`
        id,
        match_id,
        title,
        description,
        status,
        stream_state,
        last_heartbeat_at,
        provider,
        room_name,
        viewer_count,
        game:games ( name, short_name )
      `)
      .eq('status', 'live')
      .eq('stream_state', 'live')
      .gte('last_heartbeat_at', cutoff)
      .order('started_at', { ascending: false })

    if (liveError) {
      setError("Impossible de vérifier les diffusions actives. Réessaie dans un instant.")
      setLoading(false)
      return
    }

    const formatted = (data ?? []).map((item) => ({
      ...item,
      game: Array.isArray(item.game) ? (item.game[0] ?? null) : item.game,
    })) as LiveSession[]

    setLives(formatted)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadLives()
    const interval = window.setInterval(() => void loadLives(), REFRESH_INTERVAL_MS)
    const channel = supabase
      .channel('public-live-session-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        void loadLives()
      })
      .subscribe()

    return () => {
      window.clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [loadLives])

  return (
    <div className="app-shell">
      <main className="page-content">
        <div className="page-title">
          <span className="eyebrow">DIRECT</span>
          <h1>Lives</h1>
          <p>Diffusions actives vérifiées à partir de l’état de la session.</p>
        </div>

        {error && (
          <div className="empty-card" role="alert">
            <strong>Vérification indisponible</strong>
            <p>{error}</p>
          </div>
        )}

        {loading && (
          <div className="empty-card" aria-live="polite">
            <strong>Vérification des Lives...</strong>
          </div>
        )}

        {!loading && !error && lives.length === 0 && (
          <>
            <div className="live-banner">
              <div className="live-dot">●</div>
              <div>
                <strong>Aucune diffusion confirmée</strong>
                <p>Un match marqué « en cours » n’apparaît ici que si sa session LIVE est active et son signal récent.</p>
              </div>
            </div>
            <div className="empty-card">
              <span>◉</span>
              <strong>Aucun Live actuellement</strong>
              <p>Reviens plus tard : les sessions actives apparaîtront ici.</p>
            </div>
          </>
        )}

        {!loading && !error && lives.length > 0 && (
          <div style={{ display: 'grid', gap: '14px' }}>
            {lives.map((live) => (
              <div
                key={live.id}
                className="auth-card"
                style={{ position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,60,60,0.35)' }}
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
                  🔴 LIVE CONFIRMÉ
                </div>
                <h2 style={{ margin: '14px 0 4px' }}>
                  {live.title || live.game?.name || 'Diffusion Arena'}
                </h2>
                {live.description && <p>{live.description}</p>}
                <p style={{ margin: 0 }}>
                  {live.game?.name ?? 'Jeu'} · {live.viewer_count ?? 0} spectateur(s)
                </p>
                <p style={{ fontSize: '12px', opacity: 0.75 }}>
                  Session active · signal récent
                </p>
                {live.match_id ? (
                  <button
                    type="button"
                    className="primary-button full-button"
                    style={{ marginTop: '14px' }}
                    onClick={() => navigate(`/matches/${live.match_id}`)}
                  >
                    ▶️ Ouvrir la salle du match
                  </button>
                ) : (
                  <p>Cette diffusion n’est pas liée à un match consultable.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
