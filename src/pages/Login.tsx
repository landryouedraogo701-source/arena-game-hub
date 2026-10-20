import { FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginUser, loginWithGoogle } from '../lib/auth'
import { getAuthErrorMessage } from '../lib/authMessages'
import ArenaBrand from '../components/ArenaBrand'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const state = location.state as { message?: string } | null

    if (state?.message) {
      setMessage(state.message)

      navigate(location.pathname, {
        replace: true,
        state: {},
      })
    }
  }, [location, navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const { error } = await loginUser(email, password)

    setLoading(false)

    if (error) {
      setError(getAuthErrorMessage(error, 'login'))
      return
    }

    navigate('/')
  }

  async function handleGoogle() {
    setError('')
    setMessage('')
    setLoading(true)

    const { error } = await loginWithGoogle()

    if (error) {
      setLoading(false)
      setError(getAuthErrorMessage(error, 'google'))
    }
  }

  return (
    <div className="auth-page">
      <ArenaBrand />

      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">BIENVENUE</span>

        <h1>Connexion</h1>

        <p>Retrouve ton espace Arena.</p>

        <button
          type="button"
          className="secondary-button full-button"
          onClick={handleGoogle}
          disabled={loading}
        >
          Continuer avec Google
        </button>

        <div className="auth-divider">
          ou avec ton email
        </div>

        <label>Email</label>

        <input
          type="email"
          placeholder="toi@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>Mot de passe</label>

        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {message && (
          <div className="auth-success">
            {message}
          </div>
        )}

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="primary-button full-button"
          disabled={loading}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        <Link to="/register" className="auth-link">
          Créer un compte
        </Link>
      </form>
    </div>
  )
}
