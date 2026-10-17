import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BottomNav } from './Home'

type Result = {
  id: string
  match_id: string
  status: string
  evidence: unknown
  created_at: string
  submitted_by: string
}

export default function Championship() {
  const [results, setResults] = useState<Result[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) {
        setNotice('Connecte-toi pour consulter tes résultats et les preuves de match.')
        setLoading(false)
        return
      }
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
      const admin = (roles ?? []).some((row: { role: string }) => ['admin', 'referee', 'moderator'].includes(row.role))
      setIsAdmin(admin)
      let query = supabase.from('match_results').select('id,match_id,status,evidence,created_at,submitted_by').order('created_at', { ascending: false }).limit(50)
      if (!admin) query = query.eq('submitted_by', user.id)
      const { data, error } = await query
      if (error) setNotice('Les résultats ne peuvent pas être chargés. Vérifie les autorisations Supabase.')
      else setResults((data ?? []) as Result[])
      setLoading(false)
    }
    void load()
  }, [])

  return <div className="app-shell">
    <header className="topbar"><Link to="/" className="brand-name"><span className="brand-mark">A</span> Arena</Link><Link to="/profile" className="profile-button" aria-label="Profil">●</Link></header>
    <main className="page-content">
      <div className="page-title"><span className="eyebrow">RÉSULTATS OFFICIELS</span><h1>Championnat</h1><p>Les résultats sont confirmés après examen des preuves et des éventuelles contestations.</p></div>
      {isAdmin && <div className="notice-card">Mode arbitrage : tu peux consulter les résultats soumis. La décision de validation doit passer par les fonctions sécurisées de l’arbitrage.</div>}
      {notice && <div className="notice-card" role="status">{notice}</div>}
      <section className="section"><div className="section-heading"><h2>{isAdmin ? 'Résultats soumis' : 'Mes résultats'}</h2></div>
        {loading ? <div className="empty-card">Chargement…</div> : results.length === 0 ? <div className="empty-card"><span>🏆</span><strong>Aucun résultat à afficher</strong><p>Les résultats envoyés apparaîtront ici avec leur état de validation.</p></div> :
          <div className="tournament-list">{results.map(result => <article className="tournament-card" key={result.id}>
            <div className="tournament-card-top"><span className="eyebrow">Match · {result.match_id.slice(0, 8)}</span><span className="status-pill">{result.status}</span></div>
            <p>Soumis le {new Date(result.created_at).toLocaleString('fr-FR')}</p>
            <strong>Preuve envoyée</strong>
            <pre className="evidence-preview">{JSON.stringify(result.evidence, null, 2)}</pre>
            {result.status === 'disputed' && <p>Ce résultat est contesté et nécessite un examen par un arbitre autorisé.</p>}
          </article>)}</div>}
      </section>
      <div className="steps-card"><p><strong>Important</strong><br/>Une capture d’écran est un élément de preuve, pas une garantie qu’elle est authentique. En cas de doute, l’arbitre doit comparer les informations du match et conserver la trace de sa décision.</p></div>
    </main><BottomNav />
  </div>
}
