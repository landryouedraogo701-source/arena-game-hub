import { supabase } from './supabase'

export async function registerUser(
  email: string,
  password: string,
  username: string,
) {
  const cleanUsername = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)

  if (cleanUsername.length < 3) {
    return {
      data: null,
      error: new Error(
        'Le pseudo doit contenir au moins 3 caractères : lettres, chiffres ou _.',
      ),
    }
  }

  return await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: cleanUsername,
        display_name: username.trim(),
      },
    },
  })
}

export async function loginUser(
  email: string,
  password: string,
) {
  return await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
}

export async function loginWithGoogle() {
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
}

export async function logoutUser() {
  return await supabase.auth.signOut()
}
