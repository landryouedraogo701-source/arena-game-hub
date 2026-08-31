import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginWithGoogle, registerUser } from '../lib/auth'

export default function Register() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    if (username.trim().length < 3) {
      setError('Le pseudo doit contenir au moins 3 caractères.')
      return
    }

    setLoading(true)

    const { error } = await registerUser(
      email,
      password,
      username,
    )

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    navigate('/login', {
      state: {
        message:
          'Compte créé avec succès. Vérifie ton email si une confirmation est demandée, puis connecte-toi.',
      },
    })
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)

    const { error } = await loginWithGoogle()

    setLoading(false)

    if (error) {
      setError(error.message)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo"><span>A</span> Arena</div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">NOUVEAU JOUEUR</span>
        <h1>Créer un compte</h1>
        <p>Entre dans l'arène.</p>

        <button
          type="button"
          className="secondary-button full-button"
          onClick={handleGoogle}
          disabled={loading}
        >
          Continuer avec Google
        </button>

        <div className="auth-divider">ou avec ton email</div>

        <label>Pseudo</label>
        <input
          type="text"
          placeholder="Ton pseudo"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

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

        <label>Confirmer le mot de passe</label>
        <input
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <button
          type="submit"
          className="primary-button full-button"
          disabled={loading}
        >
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>

        <Link to="/login" className="auth-link">
          J'ai déjà un compte
        </Link>
      </form>
    </div>
  )
}
