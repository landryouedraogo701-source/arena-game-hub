import { useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'

export default function FloatingArenaBubble() {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ right: 16, bottom: 96 })
  const drag = useRef<{ x: number; y: number; right: number; bottom: number; moved: boolean } | null>(null)

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, right: position.right, bottom: position.bottom, moved: false }
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 7) drag.current.moved = true
    if (!drag.current.moved) return
    setPosition({
      right: Math.max(8, Math.min(window.innerWidth - 62, drag.current.right - dx)),
      bottom: Math.max(88, Math.min(window.innerHeight - 62, drag.current.bottom - dy)),
    })
  }

  function endDrag() {
    const moved = drag.current?.moved ?? false
    drag.current = null
    if (!moved) setOpen(value => !value)
  }

  return (
    <div style={{ position: 'fixed', right: position.right, bottom: position.bottom, zIndex: 1000, display: 'grid', justifyItems: 'end', gap: 10, touchAction: 'none' }}>
      {open && <section aria-label="Raccourcis de discussion Arena" style={{ width: 'min(300px, calc(100vw - 32px))', padding: 16, borderRadius: 18, background: '#111821', color: '#f5f7fb', border: '1px solid rgba(255,255,255,.14)', boxShadow: '0 14px 40px rgba(0,0,0,.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <strong>Discussions Arena</strong>
          <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', color: 'inherit', fontSize: 20 }}>×</button>
        </div>
        <p style={{ margin: '8px 0 12px', color: '#9ca8b8', fontSize: 13 }}>Retrouve les joueurs et ouvre la discussion d’une salle de match.</p>
        <Link to="/matches" onClick={() => setOpen(false)} style={{ display: 'block', padding: '11px 12px', borderRadius: 12, background: 'rgba(45,212,191,.12)', border: '1px solid rgba(45,212,191,.22)', fontWeight: 700 }}>⚔️ Voir les matchs</Link>
        <Link to="/tournaments" onClick={() => setOpen(false)} style={{ display: 'block', marginTop: 8, padding: '11px 12px', borderRadius: 12, background: 'rgba(255,255,255,.05)', fontWeight: 700 }}>🏆 Tournois et inscrits</Link>
        <small style={{ display: 'block', marginTop: 10, color: '#9ca8b8' }}>La bulle se déplace avec le doigt. Le chat des joueurs est disponible dans chaque salle de match.</small>
      </section>}
      <button type="button" aria-label={open ? 'Fermer les raccourcis Arena' : 'Ouvrir les raccourcis de discussion Arena'} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => { drag.current = null }} style={{ width: 56, height: 56, borderRadius: '50%', border: '1px solid rgba(255,255,255,.3)', background: 'linear-gradient(135deg,#2dd4bf,#6366f1)', color: '#fff', fontSize: 24, boxShadow: '0 8px 24px rgba(0,0,0,.4)', cursor: 'grab', touchAction: 'none' }}>💬</button>
    </div>
  )
}
