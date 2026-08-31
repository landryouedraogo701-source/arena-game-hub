import { supabase } from './supabase'

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from('games')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('sort_order')
  
  if (error) {
    console.error('Erreur Supabase:', error)
    return
  }

  console.log('Connexion Supabase OK:', data)
}
