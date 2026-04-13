import { ethers } from 'ethers'
import jwt from 'jsonwebtoken'

const DEFAULT_GOOGLE_SCRIPT_URL = ''
const DEFAULT_CONTRACT_ADDRESS = ''
const DEFAULT_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
const DEFAULT_CHAIN_ID = '0xaa36a7'

const GOOGLE_SCRIPT_URL = String(process.env.GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL).trim()
const CONTRACT_ADDRESS = String(process.env.ADMIN_CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS).trim()
const RPC_URL = String(process.env.ETH_SEPOLIA_RPC_URL || process.env.VITE_RPC_URL || DEFAULT_RPC_URL).trim()
const CONFIGURED_OWNER_ADDRESS = String(process.env.ADMIN_OWNER_ADDRESS || '').trim()
const EXPECTED_CHAIN_ID = String(process.env.ADMIN_CHAIN_ID || DEFAULT_CHAIN_ID).trim()
const SESSION_SECRET = String(process.env.ADMIN_SESSION_SECRET || '').trim()

const ADMIN_ACTIVITY_LOG_SHEET = 'Admin Activity Log'

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

function normalizeAddress(value) {
  try {
    return ethers.getAddress(String(value || '').trim())
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

function normalizeChainId(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  try {
    if (text.startsWith('0x')) return `0x${BigInt(text).toString(16)}`
    if (/^\d+$/.test(text)) return `0x${BigInt(text).toString(16)}`
    return ''
  } catch {
    return ''
  }
}

function extractBearerToken(req) {
  const raw = String(req.headers?.authorization || '')
  const match = raw.match(/^Bearer\s+(.+)$/i)
  return match ? String(match[1] || '').trim() : ''
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

async function verifyAdminSession(req) {
  if (!SESSION_SECRET) {
    throw new Error('Admin session secret is not configured')
  }

  const token = extractBearerToken(req)
  if (!token) {
    const err = new Error('Missing admin session token')
    err.statusCode = 401
    throw err
  }

  let decoded
  try {
    decoded = jwt.verify(token, SESSION_SECRET)
  } catch {
    const err = new Error('Invalid or expired admin session')
    err.statusCode = 401
    throw err
  }

  const expectedHost = normalizeHost(req.headers?.['x-forwarded-host'] || req.headers?.host || '')
  const expectedChainId = normalizeChainId(EXPECTED_CHAIN_ID)
  const expectedContract = normalizeAddress(CONTRACT_ADDRESS).toLowerCase()
  const tokenHost = normalizeHost(decoded?.host || '')
  const tokenChainId = normalizeChainId(decoded?.chainId || '')
  const tokenContract = normalizeAddress(decoded?.contract || '').toLowerCase()
  const tokenAddress = normalizeAddress(decoded?.sub || '').toLowerCase()

  if (!tokenAddress || !tokenHost || !tokenChainId || !tokenContract) {
    const err = new Error('Malformed admin session token')
    err.statusCode = 401
    throw err
  }

  if (expectedHost && tokenHost !== expectedHost) {
    const err = new Error('Admin session host mismatch')
    err.statusCode = 401
    throw err
  }
  if (expectedChainId && tokenChainId !== expectedChainId) {
    const err = new Error('Admin session chain mismatch')
    err.statusCode = 401
    throw err
  }
  if (expectedContract && tokenContract !== expectedContract) {
    const err = new Error('Admin session contract mismatch')
    err.statusCode = 401
    throw err
  }

  const owner = (await getAuthorizedOwnerAddress()).toLowerCase()
  if (owner !== tokenAddress) {
    const err = new Error('Admin session owner mismatch')
    err.statusCode = 403
    throw err
  }

  return {
    address: tokenAddress,
    owner,
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
  const payload = await response.json().catch(() => null)
  return { response, payload }
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
    await verifyAdminSession(req)
    const body = readBody(req)
    const action = String(body?.action || '').trim()

    if (action === 'admin_log_list') {
      const limit = Math.max(1, Math.min(Number(body?.limit || 200), 500))
      const query = new URLSearchParams({
        action: 'admin_log_list',
        sheetName: ADMIN_ACTIVITY_LOG_SHEET,
        limit: String(limit),
      })
      const { response, payload } = await fetchJsonWithTimeout(`${GOOGLE_SCRIPT_URL}?${query.toString()}`, { method: 'GET', cache: 'no-store' })
      if (!response.ok || payload?.ok === false) {
        res.status(response.status || 502).json({
          ok: false,
          error: String(payload?.error || 'Failed to load admin activity log'),
        })
        return
      }
      res.status(200).json({ ok: true, ...payload })
      return
    }

    if (action === 'admin_log_append') {
      const message = String(body?.message || '').trim()
      if (!message) {
        res.status(400).json({ ok: false, error: 'Log message is required' })
        return
      }
      const payloadBody = {
        action: 'admin_log_append',
        sheetName: ADMIN_ACTIVITY_LOG_SHEET,
        id: String(body?.id || ''),
        ts: Number(body?.ts || Date.now()),
        level: String(body?.level || 'info'),
        source: String(body?.source || 'admin'),
        message,
        txHash: String(body?.txHash || ''),
      }
      const { response, payload } = await fetchJsonWithTimeout(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payloadBody),
      })
      if (!response.ok || payload?.ok === false) {
        res.status(response.status || 502).json({
          ok: false,
          error: String(payload?.error || 'Failed to append admin activity log'),
        })
        return
      }
      res.status(200).json({ ok: true, ...payload })
      return
    }

    if (action === 'admin_log_clear') {
      const { response, payload } = await fetchJsonWithTimeout(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'admin_log_clear',
          sheetName: ADMIN_ACTIVITY_LOG_SHEET,
          timestamp: Date.now(),
        }),
      })
      if (!response.ok || payload?.ok === false) {
        res.status(response.status || 502).json({
          ok: false,
          error: String(payload?.error || 'Failed to clear admin activity log'),
        })
        return
      }
      res.status(200).json({ ok: true, ...payload })
      return
    }

    if (action === 'game_stats_summary') {
      const period = String(body?.period || 'all').trim()
      const sourceMode = String(body?.sourceMode || 'puzzle_submission').trim()
      const query = new URLSearchParams({
        action: 'game_stats_summary',
        period,
        sourceMode,
      })
      const { response, payload } = await fetchJsonWithTimeout(`${GOOGLE_SCRIPT_URL}?${query.toString()}`, { method: 'GET', cache: 'no-store' })
      if (!response.ok || payload?.ok === false) {
        res.status(response.status || 502).json({
          ok: false,
          error: String(payload?.error || 'Failed to load game stats'),
        })
        return
      }
      res.status(200).json({ ok: true, ...payload })
      return
    }

    res.status(400).json({ ok: false, error: 'Unsupported admin data action' })
  } catch (error) {
    if (error?.name === 'AbortError') {
      res.status(504).json({ ok: false, error: 'Admin data request timed out' })
      return
    }
    const statusCode = Number(error?.statusCode || 0)
    res.status(statusCode >= 400 ? statusCode : 500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
