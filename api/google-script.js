import { Buffer } from 'node:buffer'

const DEFAULT_GOOGLE_SCRIPT_URL = ''

const GOOGLE_SCRIPT_URL = String(process.env.GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL).trim()

function readBody(req) {
  if (req.body == null) return '{}'
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  if (typeof req.body === 'object') {
    try {
      return JSON.stringify(req.body)
    } catch {
      return '{}'
    }
  }
  return '{}'
}

function buildTargetUrl(req) {
  const rawUrl = String(req.url || '')
  const queryIndex = rawUrl.indexOf('?')
  if (queryIndex === -1) return GOOGLE_SCRIPT_URL
  const query = rawUrl.slice(queryIndex + 1)
  return query ? `${GOOGLE_SCRIPT_URL}?${query}` : GOOGLE_SCRIPT_URL
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (!GOOGLE_SCRIPT_URL) {
    res.status(500).json({ ok: false, error: 'Google Script URL is not configured' })
    return
  }

  const method = String(req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const targetUrl = buildTargetUrl(req)

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'text/plain' } : undefined,
      body: method === 'POST' ? readBody(req) : undefined,
      cache: 'no-store',
    })

    const rawText = await response.text().catch(() => '')
    let payload = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = null
    }
    if (!payload) {
      res.status(response.ok ? 200 : (response.status || 502)).json({
        ok: false,
        error: rawText || `Unexpected ${method} response from Google Script`,
      })
      return
    }

    res.status(response.ok ? 200 : (response.status || 502)).json(payload)
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: String(error?.message || 'Failed to reach Google Script'),
    })
  }
}
