import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNav } from './Home'
import { supabase } from '../lib/supabase'

type ProfileData = {
  username: string
  display_name: string
}

export default function Profile() {
  const navigate = useNavigate()

  const [user, setUser] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!mounted) return

      setUser(
        profile ?? {
          username: session.user.email?.split('@')[0] ?? 'joueur',
          display_name: session.user.email?.split('@')[0] ?? 'Joueur',
        },
      )

      setLoading(false)
    }

    loadProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleLogout() {
    setLoggingOut(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Erreur de déconnexion:', error)
      setLoggingOut(false)
      return
    }

    setUser(null)
    setLoggingOut(false)
    navigate('/profile', { replace: true })
  }

  if (loading) {
    return (
      <div className="app-shell">
        <main className="page-content">
          <div className="profile-hero">
            <div className="avatar">A</div>
            <div>
              <span className="eyebrow">JOUEUR</span>
              <h1>Chargement...</h1>
              <p>Vérification de ta connexion.</p>
            </div>
          </div>
        </main>

        <BottomNav />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-shell">
        <main className="page-content">
          <div className="profile-hero">
            <div className="avatar">A</div>
            <div>
              <span className="eyebrow">JOUEUR</span>
              <h1>Mon profil</h1>
              <p>Connecte-toi pour accéder à ton espace.</p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              marginTop: '24px',
            }}
          >
            <Link
              to="/login"
              className="primary-button full-button"
              style={{ textAlign: 'center' }}
            >
              Se connecter
            </Link>

            <Link
              to="/register"
              className="secondary-button full-button"
              style={{ textAlign: 'center' }}
            >
              Créer un compte
            </Link>
          </div>
        </main>

        <BottomNav />
      </div>
    )
  }

  const displayName = user.display_name || user.username
  const firstLetter = displayName.charAt(0).toUpperCase()

  return (
    <div className="app-shell">
      <main className="page-content">
        <div className="profile-hero">
          <div className="avatar">{firstLetter}</div>

          <div>
            <span className="eyebrow">JOUEUR</span>
            <h1>{displayName}</h1>
            <p>@{user.username}</p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginTop: '28px',
          }}
        >
          <Link
            to="/games"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '22px 20px',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '18px',
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <span>◈ &nbsp; Mes jeux</span>
            <b>›</b>
          </Link>

          <Link
            to="/matches"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '22px 20px',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '18px',
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <span>⚔ &nbsp; Mes matchs</span>
            <b>›</b>
          </Link>

          <Link
            to="/settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '22px 20px',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '18px',
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <span>⚙ &nbsp; Paramètres</span>
            <b>›</b>
          </Link>
        </div>

        <button
          type="button"
          className="secondary-button full-button"
          onClick={handleLogout}
          disabled={loggingOut}
          style={{ marginTop: '28px' }}
        >
          {loggingOut ? 'Déconnexion...' : 'Se déconnecter'}
        </button>
      </main>

      <BottomNav />
    </div>
  )
}
