import './StatusNotice.css'

function normalizeTone(tone) {
  const value = String(tone || '').toLowerCase()
  if (['error', 'warning', 'pending', 'success', 'info'].includes(value)) return value
  return 'info'
}

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ')
}

function StatusNotice({ message, tone = 'info', hint = '', className = '' }) {
  const text = String(message || '').trim()
  if (!text) return null

  const normalizedTone = normalizeTone(tone)
  const role = normalizedTone === 'error' ? 'alert' : 'status'

  return (
    <div
      className={joinClasses('status-notice', normalizedTone, className)}
      role={role}
      aria-live={normalizedTone === 'error' ? 'assertive' : 'polite'}
    >
      <p className="status-notice-message">{text}</p>
      {hint ? (
        <p className="status-notice-hint">{String(hint)}</p>
      ) : null}
    </div>
  )
}

export default StatusNotice
