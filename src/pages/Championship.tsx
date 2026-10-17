import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BottomNav } from './Home'

type Result = {
  id: string
  match_id: string
  submitted_by: string
  claimed_winner_id: string | null
  status: string
  evidence: unknown
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}


function collectEvidenceUrls(value: unknown): string[] {
  const found = new Set<string>()
  const visit = (item: unknown, depth = 0) => {
    if (depth > 5 || item == null) return
    if (typeof item === 'string') {
      const candidate = item.trim()
      if (/^https?:\/\//i.test(candidate) && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(candidate)) found.add(candidate)
      return
    }
    if (Array.isArray(item)) {
      item.forEach(entry => visit(entry, depth + 1))
      return
    }
    if (typeof item === 'object') {
      Object.entries(item as Record<string, unknown>).forEach(([key, entry]) => {
        if (/url|image|screenshot|capture|proof|evidence|photo|path/i.test(key)) visit(entry, depth + 1)
      })
    }
  }
  visit(value)
  return [...found].slice(0, 6)
}

function EvidencePreview({ evidence }: { evidence: unknown }) {
  const urls = collectEvidenceUrls(evidence)
  return <div className="evidence-block">
    {urls.length > 0 && <div className="evidence-gallery">{urls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="evidence-image-link">
      <img src={url} alt="Capture de preuve du match" loading="lazy" referrerPolicy="no-referrer" />
      <span>Ouvrir la capture ↗</span>
    </a>)}</div>}
    {urls.length === 0 && <p className="muted-note">Aucune URL d’image reconnue. La preuve reste consultable dans ses données ci-dessous.</p>}
    <details className="evidence-details">
      <summary>Afficher les données brutes de la preuve</summary>
      <pre className="evidence-preview">{JSON.stringify(evidence, null, 2)}</pre>
    </details>
  </div>
}
\nconst statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Validé',
  disputed: 'Contesté',
  rejected: 'Refusé',
}

export default function Championship() {
  const [results, setResults] = useState<Result[]>([])
  const [isReferee, setIsReferee] = useState(false)
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const loadResults = useCallback(async () => {
    setLoading(true)
    setNotice('')
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    if (!user) {
      setResults([])
      setNotice('Connecte-toi pour consulter tes résultats et les preuves de match.')
      setLoading(false)
      return
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    const referee = !rolesError && (roles ?? []).some((row: { role: string }) =>
      ['referee', 'moderator', 'admin'].includes(row.role))
    setIsReferee(referee)

    if (referee) {
      const { data, error } = await supabase.rpc('list_match_results_for_review')
      if (error) {
        setNotice('Impossible de charger la file d’arbitrage. Vérifie la migration et les autorisations Supabase.')
        setResults([])
      } else {
        setResults((data ?? []) as Result[])
      }
    } else {
      const { data, error } = await supabase
        .from('match_results')
        .select('id,match_id,submitted_by,claimed_winner_id,status,evidence,created_at,reviewed_by,reviewed_at')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        setNotice('Impossible de charger tes résultats. Vérifie les autorisations Supabase.')
        setResults([])
      } else {
        setResults((data ?? []) as Result[])
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadResults() }, [loadResults])

  async function reviewResult(id: string, decision: 'confirmed' | 'rejected') {
    setWorkingId(id)
    setNotice('')
    const { error } = await supabase.rpc('review_match_result', {
      p_result_id: id,
      p_decision: decision,
    })
    setWorkingId(null)
    if (error) {
      setNotice('Décision non enregistrée. Vérifie ton rôle d’arbitre et réessaie.')
      return
    }
    setNotice(decision === 'confirmed' ? 'Résultat validé. La progression du tournoi doit encore être vérifiée séparément.' : 'Résultat refusé et décision enregistrée.')
    await loadResults()
  }

  return <div className="app-shell">
    <header className="topbar"><Link to="/" className="brand-name"><span className="brand-mark">A</span> Arena</Link><Link to="/profile" className="profile-button" aria-label="Profil">●</Link></header>
    <main className="page-content">
      <div className="page-title"><span className="eyebrow">RÉSULTATS OFFICIELS</span><h1>Championnat</h1><p>Une validation humaine contrôle les captures avant de confirmer officiellement un résultat.</p></div>
      {isReferee && <div className="notice-card">Mode arbitrage : seuls les comptes referee, moderator ou admin peuvent valider ou refuser une preuve. Chaque décision est horodatée.</div>}
      {notice && <div className="notice-card" role="status">{notice}</div>}
      <section className="section"><div className="section-heading"><h2>{isReferee ? 'File de validation' : 'Mes résultats'}</h2><button type="button" className="secondary-button" onClick={() => void loadResults()}>Actualiser</button></div>
        {loading ? <div className="empty-card">Chargement…</div> : results.length === 0 ? <div className="empty-card"><span>🏆</span><strong>Aucun résultat à afficher</strong><p>{isReferee ? 'Aucune preuve en attente ou contestée.' : 'Tes résultats soumis apparaîtront ici avec leur état de validation.'}</p></div> :
          <div className="tournament-list">{results.map(result => <article className="tournament-card" key={result.id}>
            <div className="tournament-card-top"><span className="eyebrow">Match · {result.match_id.slice(0, 8)}</span><span className="status-pill">{statusLabels[result.status] ?? result.status}</span></div>
            <p>Soumis le {new Date(result.created_at).toLocaleString('fr-FR')}</p>
            {result.claimed_winner_id && <p>Gagnant déclaré : <code>{result.claimed_winner_id.slice(0, 8)}</code></p>}
            <strong>Preuve envoyée</strong>
            <EvidencePreview evidence={result.evidence} />
            {result.reviewed_at && <p>Examiné le {new Date(result.reviewed_at).toLocaleString('fr-FR')}</p>}
            {isReferee && ['pending', 'disputed'].includes(result.status) && <div className="review-actions"><button type="button" className="primary-button" disabled={workingId === result.id} onClick={() => void reviewResult(result.id, 'confirmed')}>{workingId === result.id ? 'Enregistrement…' : 'Valider le résultat'}</button><button type="button" className="secondary-button" disabled={workingId === result.id} onClick={() => void reviewResult(result.id, 'rejected')}>Refuser la preuve</button></div>}
          </article>)}</div>}
      </section>
      <div className="steps-card"><p><strong>À savoir</strong><br/>Une capture d’écran est un élément de preuve, pas une garantie d’authenticité. En cas de doute, refuse la preuve ou traite la contestation dans le flux d’arbitrage prévu.</p></div>
    </main><BottomNav />
  </div>
}
