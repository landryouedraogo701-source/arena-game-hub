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
      .select('id, status, created_by')
      .eq('room_code', code)
      .maybeSingle()

    if (matchError) {
      setLoading(false)
      setError(matchError.message)
      return
    }

    if (!match) {
      setLoading(false)
      setError('Salle introuvable.')
      return
    }

    if (match.created_by === user.id) {
      setLoading(false)
      navigate(`/matches/${match.id}`)
      return
    }

    if (match.status !== 'waiting') {
      setLoading(false)
      setError('Cette salle est déjà pleine ou le match a commencé.')
      return
    }

    const { error: joinError } = await supabase.rpc('join_match', {
      p_match_id: match.id,
    })

    if (joinError) {
      setLoading(false)
      setError(joinError.message)
      return
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
              ? 'Connexion...'
              : '⚔️ Rejoindre la salle'}
          </button>

        </div>
      </main>
    </div>
  )
}
