import { ethers } from 'ethers'

const DEFAULT_GOOGLE_SCRIPT_URL = ''
const DEFAULT_CONTRACT_ADDRESS = ''
const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
const SIGN_PREFIX = '8bitPenguins Admin Maintenance'
const SIGN_MAX_AGE_MS = 5 * 60 * 1000
const USED_NONCE_TTL_MS = SIGN_MAX_AGE_MS
const MAX_NONCE_LENGTH = 128
const DEFAULT_CHAIN_ID = '0xaa36a7'

const GOOGLE_SCRIPT_URL = String(process.env.GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL).trim()
const CONTRACT_ADDRESS = String(process.env.ADMIN_CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS).trim()
const RPC_URL = String(process.env.ETH_SEPOLIA_RPC_URL || process.env.VITE_RPC_URL || DEFAULT_RPC_URL).trim()
const CONFIGURED_OWNER_ADDRESS = String(process.env.ADMIN_OWNER_ADDRESS || '').trim()
const EXPECTED_CHAIN_ID = String(process.env.ADMIN_CHAIN_ID || DEFAULT_CHAIN_ID).trim()
const NONCE_STORE_URL = String(process.env.ADMIN_NONCE_STORE_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim()
const NONCE_STORE_TOKEN = String(process.env.ADMIN_NONCE_STORE_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()

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

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return {}
}

function parseSignedMessage(message) {
  const lines = String(message || '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines[0] !== SIGN_PREFIX) return null
  const parsed = {}
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx)
    const value = line.slice(idx + 1)
    parsed[key] = value
  }
  return parsed
}

function normalizeAddress(value) {
  try {
    return ethers.getAddress(String(value || '').trim())
  } catch {
    return ''
  }
}

function normalizeChainId(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  try {
    if (text.startsWith('0x')) {
      return `0x${BigInt(text).toString(16)}`
    }
    if (/^\d+$/.test(text)) {
      return `0x${BigInt(text).toString(16)}`
    }
    return ''
  } catch {
    return ''
  }
}

function normalizeHost(value) {
  return String(value || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

async function reserveNonce({ action, address, nonce, issuedAt }) {
  const nowMs = Date.now()
  const normalizedNonce = String(nonce || '').trim()
  if (!normalizedNonce || normalizedNonce.length > MAX_NONCE_LENGTH) {
    return { ok: false, reason: 'Invalid nonce' }
  }

  if (!NONCE_STORE_URL || !NONCE_STORE_TOKEN) {
    throw new Error('Admin nonce store is not configured')
  }

  const expiresAt = Number(issuedAt || nowMs) + USED_NONCE_TTL_MS
  const key = `maintenance:${String(action || '').trim()}:${String(address || '').toLowerCase()}:${normalizedNonce}`
  const requestUrl = `${NONCE_STORE_URL.replace(/\/$/, '')}/set/${encodeURIComponent(key)}/${encodeURIComponent(String(expiresAt))}?NX=true&PX=${USED_NONCE_TTL_MS}`
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NONCE_STORE_TOKEN}`,
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(String(payload?.error || `Nonce store request failed (${response.status})`))
  }
  if (String(payload?.result || '') !== 'OK') {
    return { ok: false, reason: 'Maintenance signature already used' }
  }

  return { ok: true }
}

async function getAuthorizedOwnerAddress() {
  const envOwner = normalizeAddress(CONFIGURED_OWNER_ADDRESS)
  if (envOwner) return envOwner

  const contractAddress = normalizeAddress(CONTRACT_ADDRESS)
  if (!contractAddress) {
    throw new Error('Admin contract address is not configured')
  }
  if (!RPC_URL) {
    throw new Error('Admin RPC URL is not configured')
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(contractAddress, ['function owner() view returns (address)'], provider)
  const owner = await contract.owner()
  const normalizedOwner = normalizeAddress(owner)
  if (!normalizedOwner) {
    throw new Error('Failed to resolve contract owner')
  }
  return normalizedOwner
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  if (!GOOGLE_SCRIPT_URL) {
    res.status(500).json({ ok: false, error: 'Google Script URL is not configured' })
    return
  }

  try {
    const body = readBody(req)
    const action = String(body?.action || '').trim()
    if (!Object.prototype.hasOwnProperty.call(ACTION_PAYLOADS, action)) {
      res.status(400).json({ ok: false, error: 'Unsupported admin action' })
      return
    }

    const address = normalizeAddress(body?.address)
    const signature = String(body?.signature || '').trim()
    const message = String(body?.message || '')
    const issuedAt = Number(body?.issuedAt || 0)
    const nonce = String(body?.nonce || '').trim()

    if (!address || !signature || !message || !Number.isFinite(issuedAt) || issuedAt <= 0 || !nonce) {
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

    const expectedHost = normalizeHost(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
    const signedHost = normalizeHost(parsedMessage.Host || '')
    const expectedChainId = normalizeChainId(EXPECTED_CHAIN_ID)
    const signedChainId = normalizeChainId(parsedMessage.ChainId || '')
    const expectedContract = normalizeAddress(CONTRACT_ADDRESS)
    const signedContract = normalizeAddress(parsedMessage.Contract || '')

    if (
      String(parsedMessage.Action || '') !== action ||
      String(parsedMessage.Address || '').toLowerCase() !== address.toLowerCase() ||
      Number(parsedMessage.IssuedAt || 0) !== issuedAt ||
      String(parsedMessage.Nonce || '').trim() !== nonce ||
      !signedHost ||
      (expectedHost && signedHost !== expectedHost) ||
      (expectedChainId && signedChainId !== expectedChainId) ||
      (expectedContract && signedContract !== expectedContract)
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
    if (authorizedOwner.toLowerCase() !== address.toLowerCase()) {
      res.status(403).json({ ok: false, error: 'Signer is not the contract owner' })
      return
    }

    const nonceReservation = await reserveNonce({ action, address, nonce, issuedAt })
    if (!nonceReservation.ok) {
      res.status(409).json({ ok: false, error: nonceReservation.reason })
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)
    let upstream
    try {
      upstream = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(ACTION_PAYLOADS[action]),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

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
    if (error?.name === 'AbortError') {
      res.status(504).json({ ok: false, error: 'Admin maintenance request timed out' })
      return
    }
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
