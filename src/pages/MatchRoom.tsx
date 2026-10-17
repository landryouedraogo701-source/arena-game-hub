import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { registerPlugin } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import MatchLivePanel from '../components/MatchLivePanel'

type GameLauncherPlugin = {
  openGame(options: {
    packageName: string
  }): Promise<{
    installed: boolean
    packageName: string
  }>
}

const GameLauncher = registerPlugin<GameLauncherPlugin>('GameLauncher')

type Match = {
  id: string
  match_type: string
  format: string
  status: string
  room_code: string | null
  created_by: string
  preparation_started_at: string | null
  started_at: string | null
  game: {
    name: string
    short_name: string | null
    android_package: string | null
    ios_url_scheme: string | null
  } | null
}

type Player = {
  id: string
  user_id: string
  team: string | null
  status: string
  joined_at: string
}

type Message = {
  id: string
  match_id: string
  sender_id: string
  message: string
  created_at: string
}

function getMatchCapacity(format: string | null | undefined): number {
  if (!format) return 2
  const value = format.trim().toUpperCase()
  if (value === '1V1') return 2
  if (value === '2V2') return 4
  const ffa = value.match(/^FFA-(\\d+)$/)
  if (ffa) {
    const capacity = Number(ffa[1])
    if (Number.isInteger(capacity) && capacity >= 2 && capacity <= 16) return capacity
  }
  // Unknown legacy formats keep the previous 1v1 behavior.
  return 2
}

export default function MatchRoom() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [messageText, setMessageText] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [readying, setReadying] = useState(false)
  const [sending, setSending] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [error, setError] = useState('')

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!match?.preparation_started_at || match.status !== "preparing") {
      setCountdown(null)
      return
    }

    const DURATION = 10

    const updateCountdown = async () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(match.preparation_started_at!).getTime()) / 1000,
      )
      const remaining = Math.max(0, DURATION - elapsed)
      setCountdown(remaining)

      if (remaining === 0) {
        const { error } = await supabase.rpc('start_preparing_match', {
          p_match_id: match.id,
        })

        if (error) {
          setError(error.message)
          return
        }

        await loadMatch()
      }
    }

    updateCountdown()
    const timer = window.setInterval(updateCountdown, 250)

    return () => window.clearInterval(timer)
  }, [match?.preparation_started_at, match?.status])

  useEffect(() => {
    if (!id) return

    loadCurrentUser()
    loadMatch()
    loadMessages()

    const interval = window.setInterval(loadMatch, 3000)

    const channel = supabase
      .channel(`match-messages-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_messages',
          filter: `match_id=eq.${id}`,
        },
        (payload) => {
          const message = payload.new as Message

          setMessages((current) =>
            current.some((item) => item.id === message.id)
              ? current
              : [...current, message],
          )
        },
      )
      .subscribe()

    return () => {
      window.clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatOpen])

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    setCurrentUserId(user?.id ?? null)
  }

  async function loadMatch() {
    if (!id) return

    const { data, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        match_type,
        format,
        status,
        room_code,
        preparation_started_at,
        started_at,
        created_by,
        game:games (
          name,
          short_name,
          android_package,
          ios_url_scheme
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (matchError) {
      setError(matchError.message)
      setLoading(false)
      return
    }

    if (!data) {
      setError('Match introuvable.')
      setLoading(false)
      return
    }

    const { data: playerData, error: playerError } = await supabase
      .from('match_players')
      .select('id, user_id, team, status, joined_at')
      .eq('match_id', id)
      .order('joined_at', { ascending: true })
      .order('user_id', { ascending: true })

    if (playerError) {
      setError(playerError.message)
      setLoading(false)
      return
    }

    console.log('MATCH GAME DATA:', data.game)

    setMatch({
      ...data,
      game: Array.isArray(data.game)
        ? (data.game[0] ?? null)
        : data.game,
    } as Match)

    setPlayers(playerData ?? [])
    setLoading(false)
  }

  async function loadMessages() {
    if (!id) return

    const { data, error: messageError } = await supabase
      .from('match_messages')
      .select('id, match_id, sender_id, message, created_at')
      .eq('match_id', id)
      .order('created_at')

    if (messageError) {
      setError(messageError.message)
      return
    }

    setMessages(data ?? [])
  }

  async function joinMatch() {
    if (!id || joining) return

    setJoining(true)
    setError('')

    const { error: joinError } = await supabase.rpc('join_match', {
      p_match_id: id,
    })

    setJoining(false)

    if (joinError) {
      setError(joinError.message)
      return
    }

    await loadMatch()
    await loadMessages()
  }

  async function leaveMatch() {
    if (!id) return

    const { error } = await supabase.rpc('leave_match', {
      p_match_id: id,
    })

    if (error) {
      setError(error.message)
      return
    }

    navigate('/matches')
  }

  async function openGame() {
    if (!match?.game?.android_package) {
      setError("Impossible d'ouvrir ce jeu : identifiant Android manquant.")
      return
    }

    setError('')

    try {
      const result = await GameLauncher.openGame({
        packageName: match.game.android_package,
      })

      if (!result.installed) {
        setError(
          `${match.game.name} n'est pas installé sur ce téléphone.`
        )
      }
    } catch (error) {
      console.error('GAME LAUNCH ERROR:', error)

      const nativeError =
        error &&
        typeof error === 'object' &&
        'message' in error
          ? String(error.message)
          : typeof error === 'string'
            ? error
            : JSON.stringify(error)

      setError(
        nativeError ||
        `Impossible d'ouvrir ${match.game.name}.`
      )
    }
  }

  async function finishMatch() {
    if (!id) return

    const { error } = await supabase.rpc('finish_match', {
      p_match_id: id,
    })

    if (error) {
      setError(error.message)
      return
    }

    await loadMatch()
  }

  async function setReady() {
    if (!id || readying) return

    setReadying(true)
    setError('')

    const { error: readyError } = await supabase.rpc('set_match_ready', {
      p_match_id: id,
    })

    setReadying(false)

    if (readyError) {
      setError(readyError.message)
      return
    }

    await loadMatch()
  }

  async function sendMessage() {
    if (!id || !currentUserId || sending) return

    const text = messageText.trim()

    if (!text) return

    setSending(true)

    const { data, error: sendError } = await supabase
      .from('match_messages')
      .insert({
        match_id: id,
        sender_id: currentUserId,
        message: text,
      })
      .select('id, match_id, sender_id, message, created_at')
      .single()

    setSending(false)

    if (sendError) {
      setError(sendError.message)
      return
    }

    if (data) {
      setMessages((current) =>
        current.some((item) => item.id === data.id)
          ? current
          : [...current, data],
      )
    }

    setMessageText('')
  }

  async function shareMatch() {
    if (!id) return

    const url = window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Rejoins mon match Arena',
          text: 'Rejoins-moi sur Arena !',
          url,
        })
        return
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        setError('✅ Lien du match copié !')
        return
      }

      setError(`Copie ce lien : ${url}`)
    } catch {
      setError(`Copie ce lien : ${url}`)
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'waiting':
        return '🟡 En attente d’un adversaire'
      case 'ready':
        return '🟢 Match prêt'
      case 'preparing':
        return '⏱️ Préparation'
      case 'live':
        return '🔴 Match en cours'
      case 'finished':
        return '🏁 Match terminé'
      case 'cancelled':
        return '⚪ Match annulé'
      case 'disputed':
        return '⚠️ Contestation en cours'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <main className="page-content">
          <div className="auth-card">
            <p>Chargement du match...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="app-shell">
        <main className="page-content">
          <div className="auth-card">
            <div className="auth-error">
              {error || 'Match introuvable.'}
            </div>

            <button
              type="button"
              className="primary-button full-button"
              onClick={() => navigate('/matches')}
            >
              Retour aux matchs
            </button>
          </div>
        </main>
      </div>
    )
  }

  const gameName = match.game?.name ?? 'Jeu inconnu'
  const isCreator = match.created_by === currentUserId
  const isParticipant = players.some(
    (player) => player.user_id === currentUserId,
  )
  const canChat = isCreator || isParticipant
  const capacity = getMatchCapacity(match.format)\n  const full = players.length >= capacity

  const currentPlayer = players.find(
    (player) => player.user_id === currentUserId,
  )

  const currentPlayerReady = currentPlayer?.status === 'ready'

  return (
    <div className="app-shell">
      <main className="page-content">
        <button
          type="button"
          className="auth-link"
          onClick={leaveMatch}
        >
          ← Retour aux matchs
        </button>

        <div className="profile-hero">
          <div className="avatar">⚔</div>

          <div>
            <span className="eyebrow">SALLE DE MATCH</span>
            <h1>{gameName}</h1>
            <p>
              {match.match_type === 'friendly'
                ? 'Match amical'
                : 'Match de compétition'}{' '}
              • {match.format}
            </p>
          </div>
        </div>

        <div className="auth-card">
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.04)',
              textAlign: 'center',
            }}
          >
            <strong>{statusLabel(match.status)}</strong>
          </div>

          <label style={{ marginTop: '18px' }}>Joueurs</label>

          <div
            style={{
              display: 'grid',
              gap: '10px',
              marginTop: '10px',
            }}
          >
            {players.map((player, index) => (
              <div
                key={player.id}
                className="secondary-button full-button"
              >
                👤 Joueur {index + 1}
                {player.user_id === currentUserId ? ' — Toi' : ''}
              </div>
            ))}

            {!full && (
              <div
                className="secondary-button full-button"
                style={{ opacity: 0.6 }}
              >
                ⏳ Places disponibles : {players.length}/{capacity}
              </div>
            )}
          </div>

          {match.room_code && !full && (
            <div
              style={{
                marginTop: '16px',
                padding: '14px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.05)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                CODE DE SALLE
              </div>

              <strong
                style={{
                  display: 'block',
                  fontSize: '26px',
                  letterSpacing: '5px',
                  marginTop: '6px',
                }}
              >
                {match.room_code}
              </strong>
            </div>
          )}

          {!isParticipant && !isCreator && !full && (
            <button
              type="button"
              className="primary-button full-button"
              style={{ marginTop: '14px' }}
              onClick={joinMatch}
              disabled={joining}
            >
              {joining ? 'Connexion...' : '🎮 Rejoindre le match'}
            </button>
          )}

          {(isCreator || isParticipant) && !full && (
            <button
              type="button"
              className="secondary-button full-button"
              style={{ marginTop: '14px' }}
              onClick={shareMatch}
            >
              📤 Inviter un adversaire
            </button>
          )}

          {full && (
            <div
              style={{
                marginTop: '16px',
                padding: '14px',
                borderRadius: '14px',
                background: 'rgba(255,138,0,0.10)',
                border: '1px solid rgba(255,138,0,0.25)',
                textAlign: 'center',
              }}
            >
              <strong>🟢 Le match est complet ({players.length}/{capacity})</strong>
              <p style={{ marginBottom: 0 }}>
                Tous les joueurs sont présents. Vous pouvez vous préparer.
              </p>
            </div>
          )}

          {full && match.status === 'ready' && isParticipant && !currentPlayerReady && (
            <button
              type="button"
              className="primary-button full-button"
              style={{ marginTop: '14px' }}
              onClick={setReady}
              disabled={readying}
            >
              {readying ? '⏳ Confirmation...' : '✅ Je suis prêt'}
            </button>
          )}

          {full && match.status === 'ready' && currentPlayerReady && (
            <div
              style={{
                marginTop: '14px',
                padding: '14px',
                borderRadius: '14px',
                background: 'rgba(34,197,94,0.10)',
                border: '1px solid rgba(34,197,94,0.25)',
                textAlign: 'center',
              }}
            >
              <strong>✅ Tu es prêt</strong>
              <p style={{ marginBottom: 0 }}>
                ⏳ En attente des autres joueurs...
              </p>
            </div>
          )}

          {match.status === 'launching' && isParticipant && (
            <div
              style={{
                marginTop: '14px',
                padding: '20px',
                borderRadius: '14px',
                background: 'rgba(34,197,94,0.10)',
                border: '1px solid rgba(34,197,94,0.25)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>
                🎮
              </div>

              <strong style={{ fontSize: '20px' }}>
                Ouvre ton jeu
              </strong>

              <p style={{ margin: '10px 0 16px' }}>
                Lance le jeu pour commencer ta session.
                Le Live démarrera lorsque la capture sera active.
              </p>

              <button
                type="button"
                className="primary-button full-button"
                onClick={openGame}
              >
                🎮 OUVRIR LE JEU
              </button>
            </div>
          )}

          <MatchLivePanel
            matchId={match.id}
            matchType={match.match_type}
            matchStatus={match.status}
            currentUserId={currentUserId}
            isParticipant={isParticipant}
            designatedHostId={players[0]?.user_id ?? null}
          />

          {match.status === 'live' && isParticipant && (
            <button
              type="button"
              className="primary-button full-button"
              style={{ marginTop: '14px' }}
              onClick={finishMatch}
            >
              🏁 Terminer le match
            </button>
          )}

          {match.status === 'preparing' && (
            <div
              style={{
                marginTop: '14px',
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(255,138,0,0.10)',
                border: '1px solid rgba(255,138,0,0.25)',
                textAlign: 'center',
              }}
            >
              <strong>⏱️ Préparation</strong>
                {countdown !== null && <div style={{ fontSize: '42px', fontWeight: 800, margin: '12px 0' }}>{countdown}</div>}
              <p style={{ marginBottom: 0 }}>
                Les joueurs requis sont prêts.
              </p>
            </div>
          )}

          {error && (
            <div
              className="auth-error"
              style={{ marginTop: '14px' }}
            >
              {error}
            </div>
          )}
        </div>
      </main>

      {canChat && (
        <>
          <button
            type="button"
            onClick={() => setChatOpen((open) => !open)}
            style={{
              position: 'fixed',
              right: '18px',
              bottom: '82px',
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              border: 'none',
              background: '#ff8a00',
              color: '#fff',
              fontSize: '25px',
              zIndex: 100,
              boxShadow: '0 8px 25px rgba(0,0,0,0.35)',
            }}
          >
            💬
          </button>

          {chatOpen && (
            <div
              style={{
                position: 'fixed',
                right: '18px',
                bottom: '150px',
                width: 'min(360px, calc(100vw - 36px))',
                height: 'min(480px, calc(100vh - 190px))',
                background: '#111',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '20px',
                zIndex: 99,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <strong>💬 Discussion privée</strong>

                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {messages.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      opacity: 0.55,
                      padding: '25px 10px',
                    }}
                  >
                    Aucun message.
                  </div>
                )}

                {messages.map((message) => {
                  const mine =
                    message.sender_id === currentUserId

                  return (
                    <div
                      key={message.id}
                      style={{
                        alignSelf: mine
                          ? 'flex-end'
                          : 'flex-start',
                        maxWidth: '82%',
                        padding: '9px 12px',
                        borderRadius: '14px',
                        background: mine
                          ? 'rgba(255,138,0,0.18)'
                          : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {message.message}
                    </div>
                  )
                })}

                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  sendMessage()
                }}
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '10px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <input
                  value={messageText}
                  onChange={(event) =>
                    setMessageText(event.target.value)
                  }
                  placeholder="Écris un message..."
                  maxLength={500}
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                />

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    sending || !messageText.trim()
                  }
                >
                  ➤
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}
