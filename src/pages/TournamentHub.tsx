import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BottomNav } from './Home'

type Game = { id: string; name: string; slug: string }
type Tournament = {
  id: string
  name: string
  description: string | null
  status: string
  participant_limit: number
  starts_at: string | null
  registration_closes_at: string | null
  game_id: string
  organizer_id: string
  games?: { name: string } | null
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  registration: 'Inscriptions ouvertes',
  draw: 'Tirage en cours',
  scheduled: 'Programmé',
  live: 'En cours',
  finished: 'Terminé',
  cancelled: 'Annulé',
}

export default function TournamentHub() {
  const [games, setGames] = useState<Game[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [gameId, setGameId] = useState('')
  const [limit, setLimit] = useState('16')
  const [startsAt, setStartsAt] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id ?? null
    setCurrentUserId(userId)
    const [gameResult, tournamentResult] = await Promise.all([
      supabase.from('games').select('id,name,slug').eq('is_active', true).order('sort_order'),
      supabase.from('tournaments').select('id,name,description,status,participant_limit,starts_at,registration_closes_at,game_id,organizer_id,games(name)').in('status', ['draft', 'registration', 'draw', 'scheduled', 'live']).order('starts_at', { ascending: true }),
    ])
    if (gameResult.error) setMessage('Impossible de charger les jeux. Vérifie la configuration Supabase et les autorisations.')
    else {
      setGames(gameResult.data ?? [])
      if (!gameId && gameResult.data?.[0]) setGameId(gameResult.data[0].id)
    }
    if (tournamentResult.error) setMessage('Les tournois ne peuvent pas être chargés pour le moment. Vérifie les politiques d’accès Supabase.')
    else setTournaments((tournamentResult.data ?? []) as unknown as Tournament[])
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [])

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      setMessage('Connecte-toi avant de créer un tournoi.')
      return
    }
    if (!gameId) {
      setMessage('Aucun jeu actif n’est configuré dans le catalogue.')
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc('create_tournament', {
      p_game_id: gameId,
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_participant_limit: Number(limit),
      p_starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    })
    setSaving(false)
    if (error) {
      setMessage(error.message.includes('permission') || error.message.includes('auth')
        ? 'La création a été refusée. Vérifie ta connexion et les autorisations du compte.'
        : 'Création impossible pour le moment. Vérifie les champs et les règles Supabase.')
      return
    }
    setMessage('Tournoi créé. Il reste en brouillon tant que tu ne publies pas les inscriptions.')
    setName('')
    setDescription('')
    setStartsAt('')
    setShowCreate(false)
    await loadData()
  }

  async function publishTournament(id: string) {
    setMessage('')
    const { error } = await supabase.rpc('publish_tournament_registration', { p_tournament_id: id })
    setMessage(error ? 'Publication refusée. Vérifie que tu es l’organisateur et que le tournoi peut être publié.' : 'Inscriptions ouvertes.')
    if (!error) await loadData()
  }

  async function generateBracket(id: string) {
    setMessage('')
    const { error: closeError } = await supabase.rpc('close_tournament_registration', { p_tournament_id: id })
    if (closeError) {
      setMessage('Impossible de fermer les inscriptions. Vérifie que tu es l’organisateur et qu’au moins deux joueurs sont inscrits.')
      return
    }
    const { error } = await supabase.rpc('generate_tournament_bracket', { p_tournament_id: id })
    setMessage(error ? 'Les inscriptions sont fermées, mais le tirage a échoué. Contacte un administrateur avant de réessayer.' : 'Tirage effectué. Le tableau des matchs est créé.')
    await loadData()
  }

  async function joinTournament(id: string) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      setMessage('Connecte-toi pour t’inscrire à un tournoi.')
      return
    }
    const { error } = await supabase.rpc('register_for_tournament', { p_tournament_id: id })
    setMessage(error ? 'Inscription impossible : vérifie que les inscriptions sont ouvertes et que tu remplis les conditions.' : 'Inscription enregistrée.')
    if (!error) await loadData()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand-name"><span className="brand-mark">A</span> Arena</Link>
        <Link to="/profile" className="profile-button" aria-label="Profil">●</Link>
      </header>
      <main className="page-content">
        <div className="page-title">
          <span className="eyebrow">ARENA COMPÉTITIF</span>
          <h1>Tournois & compétitions</h1>
          <p>Inscris-toi, découvre ton adversaire et suis ta progression tour après tour.</p>
        </div>

        <div className="feature-grid">
          <Link to="/matches" className="feature-card"><span>⚔</span><div><strong>Matchs</strong><small>Matchs individuels et salles</small></div></Link>
          <Link to="/championship" className="feature-card"><span>🏆</span><div><strong>Championnat</strong><small>Résultats et preuves à valider</small></div></Link>
        </div>

        <section className="section">
          <div className="section-heading">
            <h2>Tournois disponibles</h2>
            <button className="secondary-button" type="button" onClick={() => setShowCreate(v => !v)}>{showCreate ? 'Fermer' : '+ Créer'}</button>
          </div>
          {message && <div className="notice-card" role="status">{message}</div>}
          {showCreate && <form className="form-card" onSubmit={createTournament}>
            <h3>Créer un tournoi</h3>
            <label>Nom du tournoi<input required minLength={3} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Coupe Arena du week-end" /></label>
            <label>Jeu<select required value={gameId} onChange={e => setGameId(e.target.value)}><option value="">Choisir un jeu</option>{games.map(game => <option value={game.id} key={game.id}>{game.name}</option>)}</select></label>
            <label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1500} placeholder="Format, conditions et informations utiles" /></label>
            <label>Nombre maximum de participants<select value={limit} onChange={e => setLimit(e.target.value)}>{[2,4,8,16,32,64,128,256,512,1024].map(n => <option key={n} value={n}>{n} participants</option>)}</select></label>
            <label>Date prévue (facultatif)<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
            <p className="muted-note">La création utilise la fonction sécurisée de Supabase. Le tournoi n’est pas publié automatiquement.</p>
            <button className="primary-button full-button" type="submit" disabled={saving || games.length === 0}>{saving ? 'Création…' : 'Créer le brouillon'}</button>
          </form>}
          {loading ? <div className="empty-card">Chargement des tournois…</div> :
            tournaments.length === 0 ? <div className="empty-card"><span>🏆</span><strong>Aucun tournoi publié pour le moment</strong><p>Les tournois ouverts et programmés apparaîtront ici.</p></div> :
            <div className="tournament-list">{tournaments.map(t => <article className="tournament-card" key={t.id}>
              <div className="tournament-card-top"><span className="eyebrow">{t.games?.name ?? 'Jeu Arena'}</span><span className="status-pill">{statusLabels[t.status] ?? t.status}</span></div>
              <h3>{t.name}</h3>
              {t.description && <p>{t.description}</p>}
              <div className="tournament-meta"><span>👥 Jusqu’à {t.participant_limit} joueurs</span>{t.starts_at && <span>📅 {new Date(t.starts_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>}</div>
              <button type="button" className="primary-button full-button" disabled={t.status !== 'registration'} onClick={() => void joinTournament(t.id)}>{t.status === 'registration' ? 'S’inscrire au tournoi' : 'Inscriptions indisponibles'}</button>
              {currentUserId === t.organizer_id && <div className="tournament-owner-actions">{t.status === 'draft' && <button type="button" className="secondary-button full-button" onClick={() => void publishTournament(t.id)}>Publier les inscriptions</button>}{t.status === 'registration' && <button type="button" className="secondary-button full-button" onClick={() => void generateBracket(t.id)}>Lancer le tirage au sort</button>}</div>}
            </article>)}</div>}
        </section>
        <section className="section">
          <div className="section-heading"><h2>Comment ça marche ?</h2></div>
          <div className="steps-card"><p><strong>1. Inscription</strong><br />Rejoins un tournoi dont les inscriptions sont ouvertes.</p><p><strong>2. Tirage au sort</strong><br />L’organisateur lance le tirage lorsque les conditions sont remplies.</p><p><strong>3. Match et preuve</strong><br />Joue ton match et soumets le résultat selon les règles du tournoi.</p><p><strong>4. Progression</strong><br />Le gagnant avance au tour suivant après validation du résultat.</p></div>
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
