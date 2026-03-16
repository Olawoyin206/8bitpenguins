export const DEFAULT_TASK_PINNED_POST_LINK = 'https://x.com/8bitpenguin_xyz/status/2031353109654417574?s=20'
export const DEFAULT_TASK_PINNED_POST_ID = '2031353109654417574'
export const TASK_PINNED_POST_KEY = 'penguin:task-pinned-post-link'
export const TASK_CONFIG_UPDATED_EVENT = 'penguin:task-config-updated'

const VALID_X_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com'])

export function extractTweetMetaFromLink(link) {
  try {
    const url = new URL(String(link || '').trim())
    const hostname = url.hostname.toLowerCase()
    if (!VALID_X_HOSTS.has(hostname)) {
      return { tweetId: '', username: '' }
    }

    const parts = url.pathname.split('/').filter(Boolean)
    const statusIndex = parts.findIndex((part) => part.toLowerCase() === 'status')
    if (statusIndex === -1 || statusIndex === parts.length - 1) {
      return { tweetId: '', username: '' }
    }

    const tweetId = /^\d+$/.test(parts[statusIndex + 1] || '') ? parts[statusIndex + 1] : ''
    if (!tweetId) {
      return { tweetId: '', username: '' }
    }

    let username = ''
    if (statusIndex >= 1) {
      const candidate = parts[statusIndex - 1]
      const parent = parts[statusIndex - 2] || ''
      const isReservedPath = candidate.toLowerCase() === 'web' && parent.toLowerCase() === 'i'
      if (!isReservedPath && /^[A-Za-z0-9_]{1,15}$/.test(candidate || '')) {
        username = candidate
      }
    }

    return { tweetId, username }
  } catch {
    return { tweetId: '', username: '' }
  }
}

export function extractTweetIdFromLink(link) {
  return extractTweetMetaFromLink(link).tweetId
}

export function isValidPinnedPostLink(link) {
  return Boolean(extractTweetIdFromLink(link))
}

export function getTaskPinnedPostLink() {
  try {
    const stored = localStorage.getItem(TASK_PINNED_POST_KEY)
    if (stored && isValidPinnedPostLink(stored)) return stored.trim()
  } catch {}
  return DEFAULT_TASK_PINNED_POST_LINK
}

export function getTaskPinnedPostId(link = getTaskPinnedPostLink()) {
  return extractTweetIdFromLink(link) || DEFAULT_TASK_PINNED_POST_ID
}

export function saveTaskPinnedPostLink(link) {
  const trimmed = String(link || '').trim()
  const nextLink = trimmed && isValidPinnedPostLink(trimmed) ? trimmed : DEFAULT_TASK_PINNED_POST_LINK
  const payload = { link: nextLink, tweetId: getTaskPinnedPostId(nextLink), ts: Date.now() }

  try {
    localStorage.setItem(TASK_PINNED_POST_KEY, nextLink)
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent(TASK_CONFIG_UPDATED_EVENT, { detail: payload }))
  } catch {}

  return payload
}

export function resetTaskPinnedPostLink() {
  try {
    localStorage.removeItem(TASK_PINNED_POST_KEY)
  } catch {}

  const payload = {
    link: DEFAULT_TASK_PINNED_POST_LINK,
    tweetId: DEFAULT_TASK_PINNED_POST_ID,
    ts: Date.now(),
  }

  try {
    window.dispatchEvent(new CustomEvent(TASK_CONFIG_UPDATED_EVENT, { detail: payload }))
  } catch {}

  return payload
}
