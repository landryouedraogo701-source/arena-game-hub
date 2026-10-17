import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Game = {
  id: string
  name: string
  short_name: string | null
}

export default function CreateMatch() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const gameName = searchParams.get('game') ?? ''

  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [format, setFormat] = useState('1v1')
  const [error, setError] = useState('')

  useEffect(() => {
    loadGame()
  }, [gameName])

  async function loadGame() {
    setLoading(true)
    setError('')

    if (!gameName) {
      setError('Aucun jeu sélectionné.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('games')
      .select('id, name, short_name')
      .eq('name', gameName)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data) {
      setError('Jeu introuvable.')
      setLoading(false)
      return
    }

    setGame(data)
    setLoading(false)
  }

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''

    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }

    return code
  }

  async function createMatch() {
    setError('')

    if (!game) {
      setError('Aucun jeu sélectionné.')
      return
    }

    setCreating(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setCreating(false)
      setError('Tu dois être connecté pour créer un match.')
      return
    }

    const roomCode = generateRoomCode()

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        match_type: 'friendly',
        game_id: game.id,
        created_by: user.id,
        status: 'waiting',
        format,
        room_code: roomCode,
      })
      .select('id')
      .single()

    if (matchError || !match) {
      setCreating(false)
      setError(matchError?.message ?? 'Impossible de créer le match.')
      return
    }

    const { error: playerError } = await supabase
      .from('match_players')
      .insert({
        match_id: match.id,
        user_id: user.id,
        status: 'joined',
      })

    if (playerError) {
      await supabase
        .from('matches')
        .delete()
        .eq('id', match.id)

      setCreating(false)
      setError(playerError.message)
      return
    }

    navigate(`/matches/${match.id}`)
  }

  function getGameIcon(name: string) {
    const value = name.toLowerCase()

    if (value.includes('free fire')) return '🔥'
    if (value.includes('pubg')) return '🎯'
    if (value.includes('call of duty')) return '🔫'
    if (value.includes('fc')) return '⚽'
    if (value.includes('efootball')) return '⚽'

    return '🎮'
  }

  return (
    <div className="app-shell">
      <main className="page-content">

        <div className="page-title">
          <span className="eyebrow">MATCH AMICAL</span>

          <h1>
            {loading ? 'Chargement...' : game?.name ?? 'Jeu'}
          </h1>

          <p>
            Affronte un autre joueur en 1v1.
          </p>
        </div>

        <div className="auth-card">

          {loading ? (
            <p>Chargement du jeu...</p>
          ) : error ? (
            <div className="auth-error">
              {error}
            </div>
          ) : game ? (
            <>
              <div
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '42px' }}>
                  {getGameIcon(game.name)}
                </div>

                <h2 style={{ margin: '10px 0 4px' }}>
                  {game.name}
                </h2>

                <p style={{ margin: 0, opacity: 0.7 }}>
                  Match amical • {format}
                </p>
              </div>

              <label htmlFor="match-format" style={{ display: 'block', marginBottom: '8px' }}>
                Format du match
              </label>
              <select
                id="match-format"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                disabled={creating}
                style={{ width: '100%', marginBottom: '16px' }}
              >
                <option value="1v1">1 contre 1 — 2 joueurs</option>
                <option value="2v2">2 contre 2 — 4 joueurs en équipes</option>
                <option value="FFA-3">Chacun pour soi — 3 joueurs</option>
                <option value="FFA-4">Chacun pour soi — 4 joueurs</option>
                <option value="FFA-8">Chacun pour soi — 8 joueurs</option>
              </select>

              <button
                type="button"
                className="primary-button full-button"
                onClick={createMatch}
                disabled={creating}
              >
                {creating
                  ? 'Création du match...'
                  : '⚔️ Créer le match'}
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="auth-link"
            onClick={() => navigate(`/games/${encodeURIComponent(gameName)}`)}
            disabled={creating}
          >
            ← Retour aux modes
          </button>

        </div>

      </main>
    </div>
  )
}
