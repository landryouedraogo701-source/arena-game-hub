import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MatchSearch() {
  const navigate = useNavigate()

  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function joinMatch() {
    setError('')

    const code = roomCode.trim().toUpperCase()

    if (code.length !== 6) {
      setError('Entre un code de salle à 6 caractères.')
      return
    }

    setLoading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setLoading(false)
      setError('Tu dois être connecté pour rejoindre une salle.')
      return
    }

    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, status, format, created_by')
      .eq('room_code', code)
      .eq('status', 'waiting')
      .maybeSingle()

    if (matchError) {
      setLoading(false)
      setError(matchError.message)
      return
    }

    if (!match) {
      setLoading(false)
      setError('Salle introuvable ou déjà pleine.')
      return
    }

    if (match.created_by === user.id) {
      setLoading(false)
      navigate(`/matches/${match.id}`)
      return
    }

    const { data: existingPlayer, error: existingError } = await supabase
      .from('match_players')
      .select('id')
      .eq('match_id', match.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) {
      setLoading(false)
      setError(existingError.message)
      return
    }

    if (!existingPlayer) {
      const { error: joinError } = await supabase
        .from('match_players')
        .insert({
          match_id: match.id,
          user_id: user.id,
          status: 'joined',
        })

      if (joinError) {
        setLoading(false)
        setError(joinError.message)
        return
      }
    }

    const { data: players, error: playersError } = await supabase
      .from('match_players')
      .select('id, user_id')
      .eq('match_id', match.id)

    if (playersError) {
      setLoading(false)
      setError(playersError.message)
      return
    }

    if ((players?.length ?? 0) >= 2) {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ status: 'ready' })
        .eq('id', match.id)

      if (updateError) {
        setLoading(false)
        setError(updateError.message)
        return
      }
    }

    setLoading(false)
    navigate(`/matches/${match.id}`)
  }

  return (
    <div className="app-shell">
      <main className="page-content">

        <button
          type="button"
          className="auth-link"
          onClick={() => navigate('/matches')}
        >
          ← Retour aux matchs
        </button>

        <div className="page-title">
          <span className="eyebrow">SALLE DE MATCH</span>
          <h1>Rechercher une salle</h1>
          <p>
            Entre le code partagé par ton adversaire.
          </p>
        </div>

        <div className="auth-card">

          <label htmlFor="room-code">
            Code de salle
          </label>

          <input
            id="room-code"
            type="text"
            value={roomCode}
            onChange={(event) =>
              setRoomCode(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 6)
              )
            }
            placeholder="Ex : A7K9P2"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            style={{
              marginTop: '8px',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '5px',
            }}
          />

          {error && (
            <div
              className="auth-error"
              style={{ marginTop: '14px' }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            className="primary-button full-button"
            style={{ marginTop: '18px' }}
            onClick={joinMatch}
            disabled={loading}
          >
            {loading
              ? 'Recherche...'
              : '⚔️ Rejoindre la salle'}
          </button>

        </div>
      </main>
    </div>
  )
}
