import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type LiveSession = {
  id: string
  match_id: string
  host_id: string
  status: string
  stream_state: string | null
  title: string
  room_name: string | null
  last_heartbeat_at: string | null
}

type LiveKitModule = {
  Room: new (options?: Record<string, unknown>) => any
  RoomEvent: Record<string, string>
  createLocalTracks: (options: { audio: boolean; video: boolean }) => Promise<any[]>
}

const LIVEKIT_MODULE_URL = 'https://esm.sh/livekit-client@2.15.0'

export default function MatchLivePanel({
  matchId,
  matchType,
  matchStatus,
  currentUserId,
  isParticipant,
  designatedHostId,
}: {
  matchId: string
  matchType: string
  matchStatus: string
  currentUserId: string | null
  isParticipant: boolean
  designatedHostId: string | null
}) {
  const [session, setSession] = useState<LiveSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [role, setRole] = useState<'publisher' | 'viewer' | null>(null)
  const roomRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioContainerRef = useRef<HTMLDivElement | null>(null)

  async function loadSession() {
    const { data, error: queryError } = await supabase
      .from('live_sessions')
      .select('id, match_id, host_id, status, stream_state, title, room_name, last_heartbeat_at')
      .eq('match_id', matchId)
      .in('status', ['waiting', 'live'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryError) {
      setError('Impossible de vérifier la session Live : ' + queryError.message)
      return
    }
    setSession(data as LiveSession | null)
  }

  useEffect(() => {
    if (matchType !== 'tournament' || !matchId) return
    void loadSession()
    const channel = supabase
      .channel('live-session-' + matchId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'live_sessions', filter: 'match_id=eq.' + matchId,
      }, () => void loadSession())
      .subscribe()
    const timer = window.setInterval(() => void loadSession(), 10000)
    return () => {
      window.clearInterval(timer)
      void supabase.removeChannel(channel)
      void disconnect()
    }
  }, [matchId, matchType])

  async function disconnect() {
    const room = roomRef.current
    roomRef.current = null
    if (room) {
      try { await room.disconnect() } catch { /* no-op */ }
    }
    setConnected(false)
    setRole(null)
  }

  async function joinLive(asPublisher: boolean, liveSession: LiveSession) {
    if (!currentUserId) {
      setError('Connecte-toi pour rejoindre le Live.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: { live_session_id: liveSession.id, role: asPublisher ? 'publisher' : 'viewer' },
      })
      if (tokenError) throw new Error(tokenError.message)
      if (!tokenData?.token || !tokenData?.livekit_url) {
        throw new Error(tokenData?.error || 'Le serveur n’a pas fourni de jeton LiveKit.')
      }

      // Load the browser SDK only when the user explicitly joins a Live.
      const livekit = await import(/* @vite-ignore */ LIVEKIT_MODULE_URL) as unknown as LiveKitModule
      const room = new livekit.Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      const attachTrack = (track: any) => {
        if (track.kind === 'video' && videoRef.current) {
          track.attach(videoRef.current)
          videoRef.current.play().catch(() => undefined)
        } else if (track.kind === 'audio' && audioContainerRef.current) {
          const element = track.attach()
          element.autoplay = true
          audioContainerRef.current.appendChild(element)
        }
      }
      const detachTrack = (track: any) => {
        track.detach().forEach((element: HTMLElement) => element.remove())
      }
      room.on(livekit.RoomEvent.TrackSubscribed, (_track: any, publication: any) => attachTrack(_track || publication?.track))
      room.on(livekit.RoomEvent.TrackUnsubscribed, (track: any) => detachTrack(track))
      room.on(livekit.RoomEvent.Disconnected, () => setConnected(false))

      await room.connect(tokenData.livekit_url, tokenData.token)
      if (asPublisher) {
        const tracks = await livekit.createLocalTracks({ audio: true, video: true })
        for (const track of tracks) {
          await room.localParticipant.publishTrack(track)
          attachTrack(track)
        }
        const { error: startError } = await supabase.rpc('start_live_session', {
          p_match_id: matchId,
          p_live_session_id: liveSession.id,
        })
        if (startError) throw new Error(startError.message)
        const { error: activateError } = await supabase.rpc('activate_match_live', {
          p_match_id: matchId,
          p_live_session_id: liveSession.id,
        })
        if (activateError) throw new Error(activateError.message)
        setNotice('Diffusion connectée. Autorise la caméra et le micro si le téléphone le demande.')
      } else {
        setNotice('Connecté au Live. En attente de la vidéo de l’hôte…')
      }
      setRole(asPublisher ? 'publisher' : 'viewer')
      setConnected(true)
      await loadSession()
    } catch (e) {
      await disconnect()
      const message = e instanceof Error ? e.message : 'Erreur de connexion au Live.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  if (matchType !== 'tournament') return null

  const isDesignatedHost = !!currentUserId && currentUserId === designatedHostId
  const canHost = isParticipant && isDesignatedHost && matchStatus === 'stream_connecting'

  async function beginStreamConnection() {
    if (!isParticipant || !isDesignatedHost) {
      setError('Seul l’hôte désigné par Arena peut préparer ce Live.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data, error: beginError } = await supabase.rpc('start_match_stream', {
        p_match_id: matchId,
      })
      if (beginError) throw new Error(beginError.message)
      if (data?.success === false) throw new Error(data?.message || 'Le serveur refuse de démarrer le Live.')
      setNotice('Connexion du Live préparée. Tu peux maintenant démarrer la caméra.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de préparer la connexion Live.')
    } finally {
      setBusy(false)
    }
  }

  async function prepareAndPublish() {
    if (!currentUserId || !isParticipant || !isDesignatedHost) {
      setError('Seul l’hôte désigné par Arena peut démarrer ce Live.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data, error: prepareError } = await supabase.rpc('prepare_match_live_session', {
        p_match_id: matchId,
      })
      if (prepareError) throw new Error(prepareError.message)
      const liveSessionId = data?.live_session_id
      if (!liveSessionId) throw new Error('La base n’a pas retourné de session Live.')
      const { data: row, error: rowError } = await supabase
        .from('live_sessions')
        .select('id, match_id, host_id, status, stream_state, title, room_name, last_heartbeat_at')
        .eq('id', liveSessionId)
        .single()
      if (rowError || !row) throw new Error(rowError?.message || 'Session Live introuvable.')
      setSession(row as LiveSession)
      setBusy(false)
      await joinLive(true, row as LiveSession)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de préparer le Live.')
      setBusy(false)
    }
  }

  return (
    <section className="auth-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>🔴 Live du match</h2>
      <p style={{ opacity: 0.8 }}>
        Diffusion audio/vidéo LiveKit. Ce lecteur diffuse la caméra et le micro du téléphone ; il ne capture pas automatiquement l’écran d’un autre jeu.
      </p>
      {session ? (
        <p style={{ fontSize: 13, opacity: 0.8 }}>
          État : {session.status === 'live' && session.stream_state === 'live' ? 'diffusion active' : 'session en attente de connexion'}
        </p>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.8 }}>Aucune session Live créée pour ce match.</p>
      )}
      <video ref={videoRef} playsInline autoPlay muted={role === 'publisher'} style={{ width: '100%', minHeight: 180, background: '#080b12', borderRadius: 12, objectFit: 'contain' }} />
      <div ref={audioContainerRef} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {!connected && isParticipant && matchStatus === 'capture' && isDesignatedHost && (
          <button className="primary-button" type="button" disabled={busy} onClick={beginStreamConnection}>
            {busy ? 'Préparation…' : '📡 Préparer la connexion Live'}
          </button>
        )}
        {!connected && isParticipant && matchStatus === 'capture' && !isDesignatedHost && (
          <p role="status">Arena a désigné l’autre joueur comme hôte du Live. Tu peux regarder la diffusion une fois démarrée.</p>
        )}
        {!connected && canHost && (
          <button className="primary-button" type="button" disabled={busy} onClick={prepareAndPublish}>
            {busy ? 'Connexion…' : '🎥 Démarrer le Live'}
          </button>
        )}
        {!connected && session?.status === 'live' && (
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void joinLive(false, session)}>
            {busy ? 'Connexion…' : '▶ Regarder le Live'}
          </button>
        )}
        {connected && role === 'publisher' && (
          <button className="secondary-button" type="button" disabled={busy} onClick={async () => {
            setBusy(true)
            setError('')
            try {
              const { error: stopError } = await supabase.rpc('stop_match_live_session', {
                p_match_id: matchId,
                p_live_session_id: session?.id,
                p_reason: 'host_stopped',
              })
              if (stopError) throw new Error(stopError.message)
              await disconnect()
              await loadSession()
              setNotice('Le Live a été terminé.')
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Impossible de terminer le Live.')
            } finally {
              setBusy(false)
            }
          }}>
            Terminer le Live
          </button>
        )}
        {connected && (
          <button className="secondary-button" type="button" onClick={() => void disconnect()}>
            Quitter le lecteur
          </button>
        )}
      </div>
      {notice && <p role="status" style={{ marginBottom: 0 }}>{notice}</p>}
      {error && <p role="alert" className="auth-error" style={{ marginTop: 12 }}>{error}</p>}
    </section>
  )
}
