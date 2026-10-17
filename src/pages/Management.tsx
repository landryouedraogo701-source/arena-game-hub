import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BottomNav } from './Home'

type Role = 'player' | 'organizer' | 'referee' | 'moderator' | 'admin'

const roleLabels: Record<string, string> = {
  player: 'Joueur',
  organizer: 'Organisateur',
  referee: 'Arbitre',
  moderator: 'Modérateur',
  admin: 'Administrateur',
}

export default function Management() {
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<Role[]>([])
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadAccess() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (!active) return
      const user = sessionData.session?.user
      setSignedIn(Boolean(user))
      if (sessionError) setError('Impossible de vérifier la session. Réessaie.')
      if (user) {
        const { data, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
        if (!active) return
        if (roleError) setError('Impossible de vérifier tes autorisations. Vérifie les règles d’accès Supabase.')
        else setRoles((data ?? []).map((item: { role: string }) => item.role as Role))
      }
      if (active) setLoading(false)
    }
    void loadAccess()
    return () => { active = false }
  }, [])

  if (!loading && !signedIn) return <Navigate to="/login" replace />

  const isAdmin = roles.includes('admin')
  const isOrganizer = isAdmin || roles.includes('organizer')
  const isReferee = isAdmin || roles.includes('referee') || roles.includes('moderator')

  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand-name"><span className="brand-mark">A</span> Arena</Link>
      <Link to="/profile" className="profile-button" aria-label="Profil">●</Link>
    </header>
    <main className="page-content">
      <div className="page-title">
        <span className="eyebrow">CENTRE DE CONTRÔLE</span>
        <h1>Gestion Arena</h1>
        <p>Un seul espace pour organiser les compétitions, superviser les preuves et suivre les activités selon tes autorisations.</p>
      </div>
      {loading ? <div className="empty-card">Vérification des autorisations…</div> : <>
        {error && <div className="notice-card" role="alert">{error}</div>}
        <section className="section">
          <div className="section-heading"><h2>Mes autorisations</h2></div>
          <div className="steps-card">
            {roles.length ? <p>{roles.map(role => roleLabels[role] ?? role).join(' · ')}</p> : <p>Joueur — aucun rôle de gestion spécial détecté.</p>}
            <p className="muted-note">L’affichage de cette page ne remplace pas les contrôles de sécurité côté serveur : chaque action doit aussi être autorisée par Supabase.</p>
          </div>
        </section>
        <section className="section">
          <div className="section-heading"><h2>Organisation</h2></div>
          <div className="feature-grid">
            <Link to="/tournaments" className="feature-card"><span>🏆</span><div><strong>Tournois</strong><small>Créer un brouillon, publier les inscriptions et gérer le tirage</small></div></Link>
            <Link to="/championship" className="feature-card"><span>✓</span><div><strong>Résultats & arbitrage</strong><small>Examiner les preuves et suivre les validations</small></div></Link>
            <Link to="/matches" className="feature-card"><span>⚔</span><div><strong>Matchs</strong><small>Consulter les matchs et leur activité</small></div></Link>
          </div>
        </section>
        {!isOrganizer && <div className="notice-card">La création et la gestion des tournois sont réservées aux organisateurs et administrateurs autorisés.</div>}
        {!isReferee && <div className="notice-card">La validation officielle des résultats est réservée aux arbitres, modérateurs et administrateurs autorisés.</div>}
        {isAdmin && <section className="section"><div className="section-heading"><h2>Administration</h2></div><div className="steps-card"><p><strong>Contrôle des comptes et des rôles</strong><br/>L’attribution des rôles doit rester une opération réservée aux administrateurs, protégée par une politique serveur. Aucun outil d’attribution de rôle n’est exposé ici tant que son flux sécurisé n’a pas été vérifié.</p><p><strong>Jeux, signalements et paramètres</strong><br/>Ces outils nécessitent des écrans dédiés et des permissions testées avant d’être activés.</p></div></section>}
      </>}
    </main>
    <BottomNav />
  </div>
}
