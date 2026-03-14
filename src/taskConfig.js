export const DEFAULT_TASK_PINNED_POST_LINK = 'https://x.com/8bitpenguin_xyz/status/2031353109654417574?s=20'
export const DEFAULT_TASK_PINNED_POST_ID = '2031353109654417574'
export const TASK_PINNED_POST_KEY = 'penguin:task-pinned-post-link'
export const TASK_CONFIG_UPDATED_EVENT = 'penguin:task-config-updated'

export function extractTweetIdFromLink(link) {
  const match = String(link || '').trim().match(
    /^https:\/\/(x\.com|twitter\.com|mobile\.twitter\.com)\/([\w.-]+)\/status\/(\d+)(\?.*)?$/i
  )
  return match?.[3] || ''
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
