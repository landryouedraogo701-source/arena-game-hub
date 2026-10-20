export function getAuthErrorMessage(error: unknown, action: 'login' | 'register' | 'google'): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const message = raw.toLowerCase()

  if (/invalid login credentials|invalid email or password/.test(message)) {
    return 'Email ou mot de passe incorrect. Vérifie tes informations puis réessaie.'
  }
  if (/email not confirmed|email_not_confirmed/.test(message)) {
    return 'Ton adresse email doit être confirmée avant la connexion. Vérifie ta boîte de réception.'
  }
  if (/user already registered|already been registered|email address is already/.test(message)) {
    return 'Un compte utilise déjà cette adresse email. Essaie de te connecter.'
  }
  if (/password should be at least|weak password|password is too short/.test(message)) {
    return 'Choisis un mot de passe plus robuste (au moins 6 caractères).'
  }
  if (/too many requests|rate limit|over_email_send_rate_limit/.test(message)) {
    return 'Trop de tentatives en peu de temps. Attends quelques minutes puis réessaie.'
  }
  if (/network|fetch failed|failed to fetch|load failed/.test(message)) {
    return 'Connexion impossible au serveur. Vérifie Internet puis réessaie.'
  }
  if (action === 'google') {
    return 'La connexion Google n’a pas abouti. Réessaie ou utilise ton adresse email.'
  }
  if (action === 'register') {
    return 'La création du compte a échoué. Vérifie les informations et réessaie.'
  }
  return 'La connexion a échoué. Vérifie tes informations et réessaie.'
}
