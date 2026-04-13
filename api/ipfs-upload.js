import { Buffer } from 'node:buffer'

export const config = {
  api: {
    bodyParser: false,
  },
}

const PINATA_JWT = process.env.PINATA_JWT || ''
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'
const MAX_UPLOAD_BYTES = Number(process.env.IPFS_UPLOAD_MAX_BYTES || 8 * 1024 * 1024)
const RATE_LIMIT_WINDOW_MS = Number(process.env.IPFS_UPLOAD_RATE_WINDOW_MS || 60_000)
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.IPFS_UPLOAD_RATE_MAX || 20)
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
const ALLOWED_ORIGIN_SUFFIXES = String(process.env.ALLOWED_ORIGIN_SUFFIXES || '')
  .split(',')
  .map((suffix) => suffix.trim().toLowerCase())
  .filter(Boolean)
const uploadRateState = new Map()

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
  const firstForwarded = forwarded.split(',').map((part) => part.trim()).find(Boolean)
  return firstForwarded || req.socket?.remoteAddress || 'unknown'
}

function cleanupRateState(now) {
  for (const [key, value] of uploadRateState.entries()) {
    if (!value || now >= value.resetAt) {
      uploadRateState.delete(key)
    }
  }
}

function enforceRateLimit(req) {
  const now = Date.now()
  cleanupRateState(now)
  const key = getClientIp(req)
  const current = uploadRateState.get(key)
  const resetAt = now + RATE_LIMIT_WINDOW_MS
  if (!current || now >= current.resetAt) {
    uploadRateState.set(key, { count: 1, resetAt })
    return { allowed: true, retryAfterSec: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) }
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
  }

  current.count += 1
  uploadRateState.set(key, current)
  return { allowed: true, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
}

function isAllowedOrigin(req) {
  const origin = String(req.headers.origin || '').trim()
  if (!origin) {
    return process.env.NODE_ENV !== 'production'
  }
  if (ALLOWED_ORIGINS.has(origin)) return true

  if (!ALLOWED_ORIGIN_SUFFIXES.length) return false
  try {
    const parsed = new URL(origin)
    const host = String(parsed.hostname || '').toLowerCase()
    return ALLOWED_ORIGIN_SUFFIXES.some((suffix) => (
      host === suffix || host.endsWith(`.${suffix}`)
    ))
  } catch {
    return false
  }
}

async function readRawBody(req, maxBytes) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const normalized = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += normalized.length
    if (total > maxBytes) {
      const error = new Error('Upload payload is too large.')
      error.code = 'payload_too_large'
      throw error
    }
    chunks.push(normalized)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Origin is not allowed.' })
    return
  }

  const rateLimit = enforceRateLimit(req)
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSec))
    res.status(429).json({ error: 'Rate limit exceeded. Try again later.' })
    return
  }

  if (!PINATA_JWT) {
    res.status(500).json({ error: 'Pinata upload backend is not configured.' })
    return
  }

  const contentType = String(req.headers['content-type'] || '')
  if (!contentType.toLowerCase().startsWith('multipart/form-data') || !contentType.includes('boundary=')) {
    res.status(400).json({ error: 'Expected multipart/form-data upload.' })
    return
  }

  const contentLength = Number(req.headers['content-length'] || 0)
  if (Number.isFinite(contentLength) && contentLength > 0 && contentLength > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: 'Upload payload is too large.' })
    return
  }

  try {
    const body = await readRawBody(req, MAX_UPLOAD_BYTES)
    if (!body.length) {
      res.status(400).json({ error: 'Empty upload body.' })
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)
    const upstream = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        'Content-Type': contentType,
      },
      body,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const payload = await upstream.json().catch(() => null)
    if (!upstream.ok || !payload?.IpfsHash) {
      res.status(upstream.status || 502).json({
        error: String(payload?.error || payload?.message || 'Pinata upload failed.'),
      })
      return
    }

    res.status(200).json({
      cid: payload.IpfsHash,
      url: `${IPFS_GATEWAY}${payload.IpfsHash}`,
    })
  } catch (error) {
    if (error?.code === 'payload_too_large') {
      res.status(413).json({ error: 'Upload payload is too large.' })
      return
    }

    if (error?.name === 'AbortError') {
      res.status(504).json({ error: 'IPFS upload timed out.' })
      return
    }

    res.status(502).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
