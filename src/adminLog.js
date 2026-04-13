export const ADMIN_ACTIVITY_LOG_EVENT = 'penguin:admin-activity-log-updated'
export const ADMIN_ACTIVITY_LOG_SHEET = 'Admin Activity Log'
export const ADMIN_ACTIVITY_LOG_LIMIT = 200
const ADMIN_DATA_API_PATH = '/api/admin-data'

function notifyAdminLogUpdated(entries) {
  try {
    window.dispatchEvent(new CustomEvent(ADMIN_ACTIVITY_LOG_EVENT, { detail: { entries } }))
  } catch {
    // Ignore event dispatch issues outside the browser.
  }
}

function notifyAdminLogAppended(entry) {
  try {
    window.dispatchEvent(new CustomEvent(ADMIN_ACTIVITY_LOG_EVENT, { detail: { entry } }))
  } catch {
    // Ignore event dispatch issues outside the browser.
  }
}

function normalizeLogEntry(entry = {}) {
  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    ts: Number(entry.ts || entry.timestamp || Date.now()),
    level: String(entry.level || 'info'),
    source: String(entry.source || 'system'),
    message: String(entry.message || ''),
    txHash: String(entry.txHash || ''),
  }
}

function makeAuthHeaders(token) {
  const safeToken = String(token || '').trim()
  if (!safeToken) {
    throw new Error('Admin session token is required')
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${safeToken}`,
  }
}

export async function fetchAdminActivityLog(token, limit = ADMIN_ACTIVITY_LOG_LIMIT) {
  const response = await fetch(ADMIN_DATA_API_PATH, {
    method: 'POST',
    headers: makeAuthHeaders(token),
    body: JSON.stringify({
      action: 'admin_log_list',
      limit: Math.max(1, Number(limit) || ADMIN_ACTIVITY_LOG_LIMIT),
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || 'Failed to load admin activity log'))
  }

  const entries = Array.isArray(payload?.rows) ? payload.rows.map(normalizeLogEntry) : []
  notifyAdminLogUpdated(entries)
  return entries
}

export async function appendAdminActivityLog(entry, token) {
  if (!entry?.message) return null

  const nextEntry = normalizeLogEntry(entry)
  const response = await fetch(ADMIN_DATA_API_PATH, {
    method: 'POST',
    headers: makeAuthHeaders(token),
    body: JSON.stringify({
      action: 'admin_log_append',
      ...nextEntry,
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || 'Failed to append admin activity log'))
  }

  notifyAdminLogAppended(nextEntry)
  return nextEntry
}

export async function clearAdminActivityLog(token) {
  const response = await fetch(ADMIN_DATA_API_PATH, {
    method: 'POST',
    headers: makeAuthHeaders(token),
    body: JSON.stringify({
      action: 'admin_log_clear',
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok === false) {
    throw new Error(String(payload?.error || 'Failed to clear admin activity log'))
  }

  notifyAdminLogUpdated([])
  return []
}
