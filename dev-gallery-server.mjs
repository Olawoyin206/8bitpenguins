import { config as loadEnv } from 'dotenv'
import express from 'express'
import { Buffer } from 'node:buffer'
import { ethers } from 'ethers'

loadEnv({ path: '.env.local', override: true })
loadEnv({ path: '.env' })

const app = express()
const port = Number(process.env.LOCAL_GALLERY_PORT || 8787)
const PINATA_JWT = process.env.PINATA_JWT || ''
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'
const MAX_UPLOAD_BYTES = Number(process.env.IPFS_UPLOAD_MAX_BYTES || 8 * 1024 * 1024)
const IPFS_UPLOAD_TIMEOUT_MS = Number(process.env.IPFS_UPLOAD_TIMEOUT_MS || 15_000)
const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxs2Dxy5Dl8UL73dPEHPxzt6fE8RJib9pmUC9Vnb_PuflMaFQXB05_4h_KyypqQYH57/exec'
const DEFAULT_CONTRACT_ADDRESS = '0x7652D81dCc83fAaF55371C18C47be51Af67C19A5'
const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
const SIGN_PREFIX = '8bitPenguins Admin Maintenance'
const SIGN_MAX_AGE_MS = 5 * 60 * 1000
const GOOGLE_SCRIPT_URL = String(process.env.GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL).trim()
const CONTRACT_ADDRESS = String(process.env.ADMIN_CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS).trim()
const RPC_URL = String(process.env.ETH_SEPOLIA_RPC_URL || process.env.VITE_RPC_URL || DEFAULT_RPC_URL).trim()
const CONFIGURED_OWNER_ADDRESS = String(process.env.ADMIN_OWNER_ADDRESS || '').trim()

const ACTION_PAYLOADS = {
  reconcile_leaderboard_with_puzzle: {
    action: 'reconcile_leaderboard_with_puzzle',
    leaderboardSheetName: 'Leaderboard',
    puzzleSheetName: 'Puzzle Submissions',
  },
  repair_leaderboard_from_puzzle: {
    action: 'repair_leaderboard_from_puzzle',
    leaderboardSheetName: 'Leaderboard',
    puzzleSheetName: 'Puzzle Submissions',
  },
}

function readTextBody(req) {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  if (req.body && typeof req.body === 'object') {
    try {
      return JSON.stringify(req.body)
    } catch {
      return '{}'
    }
  }
  return '{}'
}

function buildGoogleScriptTarget(req) {
  const rawUrl = String(req.originalUrl || req.url || '')
  const queryIndex = rawUrl.indexOf('?')
  if (queryIndex === -1) return GOOGLE_SCRIPT_URL
  const query = rawUrl.slice(queryIndex + 1)
  return query ? `${GOOGLE_SCRIPT_URL}?${query}` : GOOGLE_SCRIPT_URL
}

function normalizeAddress(value) {
  try {
    return ethers.getAddress(String(value || '').trim())
  } catch {
    return ''
  }
}

function parseSignedMessage(message) {
  const lines = String(message || '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines[0] !== SIGN_PREFIX) return null
  const parsed = {}
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    parsed[line.slice(0, idx)] = line.slice(idx + 1)
  }
  return parsed
}

async function getAuthorizedOwnerAddress() {
  const envOwner = normalizeAddress(CONFIGURED_OWNER_ADDRESS)
  if (envOwner) return envOwner
  const contractAddress = normalizeAddress(CONTRACT_ADDRESS)
  if (!contractAddress) throw new Error('Admin contract address is not configured')
  if (!RPC_URL) throw new Error('Admin RPC URL is not configured')
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(contractAddress, ['function owner() view returns (address)'], provider)
  return normalizeAddress(await contract.owner())
}

app.use(express.json({ limit: '10mb' }))

app.get('/api/google-script', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')

  if (!GOOGLE_SCRIPT_URL) {
    res.status(500).json({ ok: false, error: 'Google Script URL is not configured' })
    return
  }

  try {
    const targetUrl = buildGoogleScriptTarget(req)
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
    })

    const rawText = await upstream.text().catch(() => '')
    let payload = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = null
    }

    if (!payload) {
      res.status(upstream.ok ? 200 : (upstream.status || 502)).json({
        ok: false,
        error: rawText || 'Unexpected GET response from Google Script',
      })
      return
    }

    res.status(upstream.ok ? 200 : (upstream.status || 502)).json(payload)
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

app.post('/api/google-script', express.text({ type: '*/*', limit: '2mb' }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')

  if (!GOOGLE_SCRIPT_URL) {
    res.status(500).json({ ok: false, error: 'Google Script URL is not configured' })
    return
  }

  try {
    const targetUrl = buildGoogleScriptTarget(req)
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: readTextBody(req),
      cache: 'no-store',
    })

    const rawText = await upstream.text().catch(() => '')
    let payload = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = null
    }

    if (!payload) {
      res.status(upstream.ok ? 200 : (upstream.status || 502)).json({
        ok: false,
        error: rawText || 'Unexpected POST response from Google Script',
      })
      return
    }

    res.status(upstream.ok ? 200 : (upstream.status || 502)).json(payload)
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

app.post('/api/ipfs-upload', express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')

  if (!PINATA_JWT) {
    res.status(500).json({ error: 'Pinata upload backend is not configured.' })
    return
  }

  const contentType = String(req.headers['content-type'] || '')
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    res.status(400).json({ error: 'Expected multipart/form-data upload.' })
    return
  }

  const contentLength = Number(req.headers['content-length'] || 0)
  if (Number.isFinite(contentLength) && contentLength > 0 && contentLength > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: 'Upload payload is too large.' })
    return
  }

  try {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    if (!body.length) {
      res.status(400).json({ error: 'Empty upload body.' })
      return
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: 'Upload payload is too large.' })
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), IPFS_UPLOAD_TIMEOUT_MS)
    let upstream
    try {
      upstream = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PINATA_JWT}`,
          'Content-Type': contentType,
        },
        body,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

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
    if (error?.name === 'AbortError') {
      res.status(504).json({ error: 'IPFS upload timed out.' })
      return
    }
    res.status(502).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

app.post('/api/admin-maintenance', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')

  try {
    const action = String(req.body?.action || '').trim()
    if (!Object.prototype.hasOwnProperty.call(ACTION_PAYLOADS, action)) {
      res.status(400).json({ ok: false, error: 'Unsupported admin action' })
      return
    }

    const address = normalizeAddress(req.body?.address)
    const signature = String(req.body?.signature || '').trim()
    const message = String(req.body?.message || '')
    const issuedAt = Number(req.body?.issuedAt || 0)

    if (!address || !signature || !message || !Number.isFinite(issuedAt) || issuedAt <= 0) {
      res.status(400).json({ ok: false, error: 'Missing maintenance signature payload' })
      return
    }

    if (Math.abs(Date.now() - issuedAt) > SIGN_MAX_AGE_MS) {
      res.status(401).json({ ok: false, error: 'Maintenance signature expired' })
      return
    }

    const parsedMessage = parseSignedMessage(message)
    if (!parsedMessage) {
      res.status(401).json({ ok: false, error: 'Invalid maintenance signature message' })
      return
    }

    if (
      String(parsedMessage.Action || '') !== action ||
      String(parsedMessage.Address || '').toLowerCase() !== address.toLowerCase() ||
      Number(parsedMessage.IssuedAt || 0) !== issuedAt
    ) {
      res.status(401).json({ ok: false, error: 'Maintenance signature payload mismatch' })
      return
    }

    const recovered = normalizeAddress(ethers.verifyMessage(message, signature))
    if (!recovered || recovered.toLowerCase() !== address.toLowerCase()) {
      res.status(401).json({ ok: false, error: 'Invalid maintenance signature' })
      return
    }

    const authorizedOwner = await getAuthorizedOwnerAddress()
    if (!authorizedOwner || authorizedOwner.toLowerCase() !== address.toLowerCase()) {
      res.status(403).json({ ok: false, error: 'Signer is not the contract owner' })
      return
    }

    if (!GOOGLE_SCRIPT_URL) {
      res.status(500).json({ ok: false, error: 'Google Script URL is not configured' })
      return
    }

    const upstream = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(ACTION_PAYLOADS[action]),
    })

    const payload = await upstream.json().catch(() => null)
    if (!upstream.ok || payload?.ok === false) {
      res.status(upstream.status || 502).json({
        ok: false,
        error: String(payload?.error || 'Apps Script request failed'),
      })
      return
    }

    res.status(200).json({ ok: true, ...payload })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

app.listen(port, () => {
  console.log(`Local gallery API listening on http://localhost:${port}`)
})
