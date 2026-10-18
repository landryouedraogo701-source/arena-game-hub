import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Profile = { id: string; username: string; display_name: string; avatar_url: string | null }
type DirectMessage = { id: string; sender_id: string; recipient_id: string; message: string; created_at: string }

export default function FloatingChat() {
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [position, setPosition] = useState({ right: 16, bottom: 94 })
  const [username, setUsername] = useState('')
  const [recipient, setRecipient] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const dragStart = useRef<{ x: number; y: number; right: number; bottom: number } | null>(null)
  const moved = useRef(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    void supabase.auth.getSession().then(({ data }) => { if (alive) setUserId(data.session?.user.id ?? null) })
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      setRecipient(null); setMessages([]); setOpen(false)
    })
    return () => { alive = false; auth.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!userId || !recipient) return
    let active = true
    const load = async () => {
      const { data, error } = await supabase.from('direct_messages')
        .select('id,sender_id,recipient_id,message,created_at')
        .or('and(sender_id.eq.' + userId + ',recipient_id.eq.' + recipient.id + '),and(sender_id.eq.' + recipient.id + ',recipient_id.eq.' + userId + ')')
        .order('created_at', { ascending: true }).limit(200)
      if (!active) return
      if (error) setNotice('Messagerie non disponible : ' + error.message)
      else { setMessages((data ?? []) as DirectMessage[]); setNotice('') }
    }
    void load()
    const channel = supabase.channel('direct-messages-' + [userId, recipient.id].sort().join('-'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, payload => {
        const row = payload.new as DirectMessage
        if ((row.sender_id === userId && row.recipient_id === recipient.id) || (row.sender_id === recipient.id && row.recipient_id === userId)) {
          setMessages(current => current.some(m => m.id === row.id) ? current : [...current, row])
        }
      }).subscribe()
    return () => { active = false; void supabase.removeChannel(channel) }
  }, [userId, recipient?.id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  async function findRecipient(event: React.FormEvent) {
    event.preventDefault()
    if (!userId) return
    const handle = username.trim().replace(/^@/, '').toLowerCase()
    if (!handle) return
    setBusy(true); setNotice('')
    const { data, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url').eq('username', handle).maybeSingle()
    setBusy(false)
    if (error) { setNotice('Recherche impossible : ' + error.message); return }
    if (!data) { setNotice('Aucun joueur trouvé avec ce pseudo.'); return }
    if (data.id === userId) { setNotice('Tu ne peux pas ouvrir une conversation avec toi-même.'); return }
    setRecipient(data as Profile); setUsername('')
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !userId || !recipient || busy) return
    setBusy(true); setNotice('')
    const { data, error } = await supabase.from('direct_messages')
      .insert({ sender_id: userId, recipient_id: recipient.id, message: text })
      .select('id,sender_id,recipient_id,message,created_at').single()
    setBusy(false)
    if (error) { setNotice('Envoi impossible : ' + error.message); return }
    if (data) setMessages(current => current.some(m => m.id === data.id) ? current : [...current, data as DirectMessage])
    setDraft('')
  }

  function pointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    dragStart.current = { x: event.clientX, y: event.clientY, right: position.right, bottom: position.bottom }
    moved.current = false
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const start = dragStart.current
    if (!start) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.abs(dx) + Math.abs(dy) > 8) moved.current = true
    if (moved.current) setPosition({ right: Math.max(4, Math.min(window.innerWidth - 60, start.right - dx)), bottom: Math.max(82, Math.min(window.innerHeight - 70, start.bottom - dy)) })
  }
  function pointerUp() {
    setDragging(false)
    if (!moved.current) setOpen(value => !value)
    dragStart.current = null
  }

  if (!userId) return null
  return <>
    <button type="button" aria-label={open ? 'Fermer la messagerie' : 'Ouvrir la messagerie'} title="Déplacer ou ouvrir la messagerie"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => setDragging(false)}
      style={{ position: 'fixed', right: position.right, bottom: position.bottom, width: 58, height: 58, borderRadius: '50%', border: '2px solid rgba(255,255,255,.7)', background: '#ff8a00', color: '#fff', fontSize: 25, boxShadow: '0 8px 26px #0008', zIndex: 1000, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}>
      {open ? '×' : '💬'}
    </button>
    {open && <section aria-label="Messagerie Arena" style={{ position: 'fixed', right: 12, bottom: 160, width: 'min(360px, calc(100vw - 24px))', height: 'min(470px, calc(100vh - 190px))', zIndex: 999, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 18, border: '1px solid rgba(255,255,255,.16)', background: '#10151e', color: '#f5f7fb', boxShadow: '0 12px 38px #0009' }}>
      <header style={{ padding: 13, borderBottom: '1px solid #ffffff18', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>💬 Messages Arena</strong><button type="button" onClick={() => setOpen(false)} aria-label="Fermer" style={{ background: 'transparent', color: 'inherit', border: 0 }}>✕</button></header>
      <div style={{ padding: 12, borderBottom: '1px solid #ffffff18' }}>
        {recipient ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{recipient.avatar_url ? <img src={recipient.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} /> : '👤'}<div style={{ flex: 1 }}><strong>{recipient.display_name}</strong><small style={{ display: 'block', opacity: .65 }}>@{recipient.username}</small></div><button type="button" className="secondary-button" style={{ margin: 0, minHeight: 32, padding: '0 9px' }} onClick={() => { setRecipient(null); setMessages([]); setNotice('') }}>Changer</button></div> :
          <form onSubmit={findRecipient} style={{ display: 'flex', gap: 7 }}><input aria-label="Pseudo du joueur" value={username} onChange={e => setUsername(e.target.value)} placeholder="Pseudo du joueur" maxLength={20} style={{ minWidth: 0, flex: 1 }} /><button className="primary-button" style={{ margin: 0, minHeight: 42, padding: '0 12px' }} disabled={busy}>Chercher</button></form>}
      </div>
      {notice && <p role="status" style={{ padding: '7px 12px', margin: 0, fontSize: 12, color: '#ffbf73' }}>{notice}</p>}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!recipient && <p style={{ opacity: .65, fontSize: 13 }}>Recherche un joueur par son pseudo pour commencer une conversation privée.</p>}
        {recipient && messages.length === 0 && <p style={{ opacity: .65, textAlign: 'center', fontSize: 13 }}>Aucun message. Lance la conversation !</p>}
        {messages.map(m => <div key={m.id} style={{ alignSelf: m.sender_id === userId ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '9px 12px', borderRadius: 13, background: m.sender_id === userId ? '#ff8a0033' : '#ffffff12', overflowWrap: 'anywhere' }}><div>{m.message}</div><small style={{ opacity: .55, fontSize: 10 }}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></div>)}
        <div ref={endRef} />
      </div>
      {recipient && <form onSubmit={send} style={{ display: 'flex', gap: 7, padding: 10, borderTop: '1px solid #ffffff18' }}><input aria-label="Ton message" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Écris un message..." maxLength={1000} style={{ flex: 1, minWidth: 0 }} /><button className="primary-button" style={{ margin: 0, minHeight: 42, padding: '0 12px' }} disabled={busy || !draft.trim()}>➤</button></form>}
    </section>}
  </>
}
