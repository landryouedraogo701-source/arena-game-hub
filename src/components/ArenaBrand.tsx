type ArenaBrandProps = { compact?: boolean }

export default function ArenaBrand({ compact = false }: ArenaBrandProps) {
  return (
    <div className={compact ? 'auth-logo auth-logo-compact' : 'auth-logo'} aria-label="Arena Game Hub">
      <span aria-hidden="true">A</span>
      <span className="arena-brand-word">Arena</span>
      {!compact && <small className="arena-brand-caption">GAME HUB</small>}
    </div>
  )
}
