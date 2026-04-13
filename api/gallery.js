const JSONBIN_KEY = process.env.JSONBIN_KEY || process.env.VITE_JSONBIN_KEY
const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || process.env.VITE_JSONBIN_BIN_ID
const MAX_POST_BODY_BYTES = Number(process.env.GALLERY_MAX_BODY_BYTES || 32_768)
const WRITE_RATE_LIMIT_WINDOW_MS = Number(process.env.GALLERY_RATE_WINDOW_MS || 60_000)
const WRITE_RATE_LIMIT_MAX_REQUESTS = Number(process.env.GALLERY_RATE_MAX || 30)
const DEFAULT_ALLOWED_ORIGINS = [
  'https://8bitpenguins.xyz',
  'https://www.8bitpenguins.xyz',
  'http://localhost:5173',
  'http://localhost:3000',
]
const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
])
const galleryWriteRateState = new Map()

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
  const firstForwarded = forwarded.split(',').map((part) => part.trim()).find(Boolean)
  return firstForwarded || req.socket?.remoteAddress || 'unknown'
}

function cleanupRateState(now) {
  for (const [key, value] of galleryWriteRateState.entries()) {
    if (!value || now >= value.resetAt) {
      galleryWriteRateState.delete(key)
    }
  }
}

function enforceWriteRateLimit(req) {
  const now = Date.now()
  cleanupRateState(now)
  const key = getClientIp(req)
  const current = galleryWriteRateState.get(key)
  const resetAt = now + WRITE_RATE_LIMIT_WINDOW_MS

  if (!current || now >= current.resetAt) {
    galleryWriteRateState.set(key, { count: 1, resetAt })
    return { allowed: true, retryAfterSec: Math.ceil(WRITE_RATE_LIMIT_WINDOW_MS / 1000) }
  }

  if (current.count >= WRITE_RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
  }

  current.count += 1
  galleryWriteRateState.set(key, current)
  return { allowed: true, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
}

function isAllowedOrigin(req) {
  const origin = String(req.headers.origin || '').trim()
  if (!origin) {
    return process.env.NODE_ENV !== 'production'
  }
  return ALLOWED_ORIGINS.has(origin)
}

function sanitizeString(value, maxLength = 2048) {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  return normalized.slice(0, maxLength)
}

function sanitizePenguinPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const id = Number(input.id || Date.now())
  const timestamp = Number(input.timestamp || Date.now())
  const cid = sanitizeString(input.cid, 256)
  const image = sanitizeString(input.image, 8_192)
  const image2d = sanitizeString(input.image2d, 8_192)
  const image3d = sanitizeString(input.image3d, 8_192)
  const name = sanitizeString(input.name, 256)
  const style = sanitizeString(input.style, 64)
  const type = sanitizeString(input.type, 64)
  const isOg = Boolean(input.isOg)

  if (!Number.isFinite(id)) return null
  if (!Number.isFinite(timestamp)) return null
  if (!cid && !image && !image2d && !image3d) return null

  return {
    id,
    timestamp,
    cid,
    image,
    image2d,
    image3d,
    name,
    style,
    type,
    isOg,
    traits: input.traits && typeof input.traits === 'object' ? input.traits : {},
  }
}

function getPenguinKey(penguin) {
  if (!penguin) return ''
  if (penguin.cid) return `cid:${penguin.cid}`
  if (penguin.id != null) return `id:${penguin.id}`
  if (penguin.image) return `image:${penguin.image}`
  return `ts:${penguin.timestamp || 0}`
}

function mergeGalleryEntries(...collections) {
  const byKey = new Map()

  collections.flat().forEach((penguin) => {
    const key = getPenguinKey(penguin)
    if (!key) return
    const existing = byKey.get(key)
    byKey.set(key, existing ? { ...existing, ...penguin } : penguin)
  })

  return Array.from(byKey.values()).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
}

async function fetchGalleryRecord() {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
    headers: { 'X-Access-Key': JSONBIN_KEY },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`JSONBin GET failed: ${res.status} ${errorText}`)
  }

  const data = await res.json()
  return Array.isArray(data.record?.penguins) ? data.record.penguins : []
}

async function writeGalleryRecord(gallery) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: {
      'X-Access-Key': JSONBIN_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ penguins: gallery }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`JSONBin PUT failed: ${res.status} ${errorText}`)
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (!JSONBIN_KEY || !JSONBIN_BIN_ID) {
    res.status(500).json({ error: 'Gallery backend is not configured.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const gallery = await fetchGalleryRecord()
      res.status(200).json({ penguins: gallery, items: gallery })
      return
    }

    if (req.method === 'POST') {
      if (!isAllowedOrigin(req)) {
        res.status(403).json({ error: 'Origin is not allowed.' })
        return
      }

      const rateLimit = enforceWriteRateLimit(req)
      if (!rateLimit.allowed) {
        res.setHeader('Retry-After', String(rateLimit.retryAfterSec))
        res.status(429).json({ error: 'Rate limit exceeded. Try again later.' })
        return
      }

      const contentLength = Number(req.headers['content-length'] || 0)
      if (Number.isFinite(contentLength) && contentLength > 0 && contentLength > MAX_POST_BODY_BYTES) {
        res.status(413).json({ error: 'Gallery payload too large.' })
        return
      }

      const rawPayload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
      const penguin = sanitizePenguinPayload(rawPayload)
      if (!penguin) {
        res.status(400).json({ error: 'Invalid penguin payload.' })
        return
      }

      const gallery = mergeGalleryEntries([penguin], await fetchGalleryRecord())
      await writeGalleryRecord(gallery)
      const confirmedGallery = mergeGalleryEntries(await fetchGalleryRecord(), [penguin])
      res.status(200).json({ ok: true, penguins: confirmedGallery, items: confirmedGallery })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (error) {
    res.status(502).json({
      error: 'Gallery backend request failed.',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
