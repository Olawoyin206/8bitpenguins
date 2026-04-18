import fs from 'node:fs/promises'
import path from 'node:path'
import { ethers } from 'ethers'

const DEFAULT_CONTRACT_ADDRESS = '0xC15C47C75baAB1D22954DC5E814B520FdE809729'
const DEFAULT_PROOF_TTL_SECONDS = 15 * 60
const DEFAULT_SNAPSHOT_CACHE_TTL_MS = 60 * 1000
const DEFAULT_BATCH_CACHE_TTL_MS = 2 * 60 * 1000
const DEFAULT_SNAPSHOT_FILE = 'cache/whitelist-snapshot.json'
const WHITELIST_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    'WhitelistMint(address wallet,uint256 phaseId,uint256 maxAllowance,uint256 deadline,address contractAddress,uint256 chainId)'
  )
)

const snapshotCache = new Map()
const batchEligibilityCache = new Map()

function readContractAddress(override = '') {
  const requested = String(override || '').trim()
  if (requested) return requested
  return String(
    process.env.WHITELIST_GATE_ADDRESS
    || process.env.ADMIN_MINT_GATE_ADDRESS
    || process.env.VITE_MINT_GATE_ADDRESS
    || process.env.ADMIN_CONTRACT_ADDRESS
    || process.env.VITE_CONTRACT_ADDRESS
    || process.env.CONTRACT_ADDRESS
    || DEFAULT_CONTRACT_ADDRESS
  ).trim()
}

function resolveSnapshotFilePath() {
  const configured = String(process.env.WHITELIST_SNAPSHOT_FILE || DEFAULT_SNAPSHOT_FILE).trim()
  if (!configured) {
    return path.resolve(process.cwd(), DEFAULT_SNAPSHOT_FILE)
  }
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured)
}

function normalizeAddress(value) {
  try {
    return ethers.getAddress(String(value || '').trim())
  } catch {
    return ''
  }
}

function readRequestParams(req) {
  const method = String(req.method || 'GET').toUpperCase()
  if (method === 'POST' && req.body && typeof req.body === 'object') {
    return req.body
  }
  return req.query || {}
}

function parseBoolean(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return false
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function getCachedValue(cache, key) {
  const cached = cache.get(key)
  if (!cached) return null
  if (cached.expiresAt > Date.now()) return cached.value
  cache.delete(key)
  return null
}

function setCachedValue(cache, key, value, ttlMs) {
  cache.set(key, {
    expiresAt: Date.now() + Math.max(1_000, Number(ttlMs || DEFAULT_SNAPSHOT_CACHE_TTL_MS)),
    value,
  })
  return value
}

async function statIfExists(filePath) {
  try {
    return await fs.stat(filePath)
  } catch (error) {
    if (String(error?.code || '') === 'ENOENT') return null
    throw error
  }
}

async function loadWhitelistSnapshot() {
  const snapshotPath = resolveSnapshotFilePath()
  const snapshotTtlMs = Math.max(
    1_000,
    Number(process.env.WHITELIST_SNAPSHOT_CACHE_TTL_MS || DEFAULT_SNAPSHOT_CACHE_TTL_MS)
  )
  const stat = await statIfExists(snapshotPath)
  if (!stat) {
    throw new Error(`Whitelist snapshot not found at ${snapshotPath}. Run npm run whitelist:sync.`)
  }

  const cacheKey = snapshotPath
  const cached = getCachedValue(snapshotCache, cacheKey)
  if (cached && Number(cached?.mtimeMs || 0) === Number(stat.mtimeMs || 0)) {
    return cached.data
  }

  const raw = await fs.readFile(snapshotPath, 'utf8')
  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Whitelist snapshot parse failed: ${String(error?.message || 'Invalid JSON')}`)
  }

  const whitelistByPhase = parsed && typeof parsed.whitelistByPhase === 'object'
    ? parsed.whitelistByPhase
    : {}
  const phases = Array.isArray(parsed?.phases) ? parsed.phases : []
  const normalized = {
    ...parsed,
    phases,
    whitelistByPhase,
  }

  setCachedValue(snapshotCache, cacheKey, { mtimeMs: stat.mtimeMs, data: normalized }, snapshotTtlMs)
  return normalized
}

function readSnapshotAllowance(snapshot, phaseId, walletLower) {
  const phaseBucket = snapshot?.whitelistByPhase?.[String(Number(phaseId))]
  if (!phaseBucket || typeof phaseBucket !== 'object') return 0
  const allowance = Number(phaseBucket[walletLower] ?? 0)
  if (!Number.isFinite(allowance) || allowance <= 0) return 0
  return Math.floor(allowance)
}

function findSnapshotPhase(snapshot, phaseId) {
  const targetId = Number(phaseId)
  const phases = Array.isArray(snapshot?.phases) ? snapshot.phases : []
  return phases.find((phase) => Number(phase?.id) === targetId) || null
}

function phaseMissingInSnapshot(snapshot, phaseId) {
  const phase = findSnapshotPhase(snapshot, phaseId)
  if (!phase) return true
  const hasBucket = snapshot?.whitelistByPhase && typeof snapshot.whitelistByPhase[String(Number(phaseId))] === 'object'
  return !hasBucket
}

function readSnapshotChainId(snapshot) {
  const envChainId = Number(process.env.WHITELIST_CHAIN_ID || 0)
  if (Number.isInteger(envChainId) && envChainId > 0) return envChainId
  const snapshotChainId = Number(snapshot?.chainId || 0)
  if (Number.isInteger(snapshotChainId) && snapshotChainId > 0) return snapshotChainId
  return 1
}

function ensureSnapshotContractMatches(snapshot, contractAddress) {
  const snapshotContract = normalizeAddress(snapshot?.contract || '')
  if (!snapshotContract) return
  if (snapshotContract.toLowerCase() !== String(contractAddress || '').toLowerCase()) {
    throw new Error(
      `Snapshot contract mismatch. Snapshot=${snapshotContract}, requested=${contractAddress}. Run npm run whitelist:sync with correct contract.`
    )
  }
}

function buildBatchCacheKey({ contractAddress, walletLower, snapshotVersion }) {
  return `${String(contractAddress || '').toLowerCase()}::${walletLower}::${String(snapshotVersion || 'na')}`
}

function buildBatchEligibilityResponse({ snapshot, wallet, walletLower, contractAddress }) {
  const snapshotVersion = snapshot?.snapshotVersion || null
  const phases = (Array.isArray(snapshot?.phases) ? snapshot.phases : []).map((phaseMeta) => {
    const phaseId = Number(phaseMeta?.id)
    const baseResult = {
      phaseId,
      phaseName: String(phaseMeta?.name || ''),
      enabled: Boolean(phaseMeta?.enabled),
      required: Boolean(phaseMeta?.required),
      eligible: false,
      maxAllowance: 0,
    }

    if (!baseResult.enabled) return baseResult
    if (!baseResult.required) {
      return {
        ...baseResult,
        eligible: true,
      }
    }

    if (!Number.isInteger(phaseId) || phaseId < 0 || phaseMissingInSnapshot(snapshot, phaseId)) {
      return {
        ...baseResult,
        error: `Phase ${phaseId} missing in whitelist snapshot`,
      }
    }

    const maxAllowance = readSnapshotAllowance(snapshot, phaseId, walletLower)
    return {
      ...baseResult,
      eligible: maxAllowance > 0,
      maxAllowance,
    }
  })

  const matchedPhases = phases.filter(
    (entry) => entry.enabled && entry.required && entry.eligible && Number(entry.maxAllowance || 0) > 0
  )
  const partial = phases.some(
    (entry) => entry.enabled && entry.required && typeof entry.error === 'string' && entry.error
  )

  return {
    ok: true,
    wallet,
    contract: contractAddress,
    snapshotVersion,
    phaseCount: phases.length,
    matched: matchedPhases.length > 0,
    partial,
    phases,
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  const method = String(req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  try {
    const params = readRequestParams(req)
    const wallet = normalizeAddress(params.wallet || params.address)
    const checkOnly = parseBoolean(params.checkOnly) || String(params.mode || '').toLowerCase() === 'check'
    const hasExplicitPhaseId = !(params.phaseId === undefined || params.phaseId === null || String(params.phaseId).trim() === '')
    const checkAllPhases = parseBoolean(params.allPhases)
      || String(params.scope || '').toLowerCase() === 'all'
      || (checkOnly && !hasExplicitPhaseId)
    const phaseId = Number(params.phaseId)

    if (!wallet) {
      res.status(400).json({ ok: false, error: 'Invalid wallet address' })
      return
    }
    if (!checkAllPhases && (!Number.isInteger(phaseId) || phaseId < 0)) {
      res.status(400).json({ ok: false, error: 'Invalid phaseId' })
      return
    }

    const contractAddress = normalizeAddress(readContractAddress(params.contract || params.mintContract || ''))
    if (!contractAddress) {
      res.status(500).json({ ok: false, error: 'Contract address is not configured' })
      return
    }

    const snapshotData = await loadWhitelistSnapshot()
    ensureSnapshotContractMatches(snapshotData, contractAddress)
    const walletLower = wallet.toLowerCase()

    if (checkAllPhases) {
      const cacheTtlMs = Math.max(
        5_000,
        Number(process.env.WHITELIST_BATCH_CACHE_TTL_MS || DEFAULT_BATCH_CACHE_TTL_MS)
      )
      const cacheKey = buildBatchCacheKey({
        contractAddress,
        walletLower,
        snapshotVersion: snapshotData?.snapshotVersion,
      })
      const cached = getCachedValue(batchEligibilityCache, cacheKey)
      if (cached) {
        res.status(200).json(cached)
        return
      }

      const responsePayload = buildBatchEligibilityResponse({
        snapshot: snapshotData,
        wallet,
        walletLower,
        contractAddress,
      })
      setCachedValue(batchEligibilityCache, cacheKey, responsePayload, cacheTtlMs)
      res.status(200).json(responsePayload)
      return
    }

    const phaseMeta = findSnapshotPhase(snapshotData, phaseId)
    if (!phaseMeta) {
      res.status(400).json({
        ok: false,
        error: `Invalid phaseId ${phaseId}`,
      })
      return
    }

    const phaseName = String(phaseMeta?.name || '')
    const signatureRequired = Boolean(phaseMeta?.required)
    if (!signatureRequired) {
      res.status(200).json({
        ok: true,
        eligible: true,
        required: false,
        phaseId,
        phaseName,
        contract: contractAddress,
        snapshotVersion: snapshotData?.snapshotVersion || null,
      })
      return
    }

    if (phaseMissingInSnapshot(snapshotData, phaseId)) {
      res.status(500).json({
        ok: false,
        error: `Phase ${phaseId} missing in whitelist snapshot. Run npm run whitelist:sync.`,
      })
      return
    }

    const maxAllowance = readSnapshotAllowance(snapshotData, phaseId, walletLower)
    if (maxAllowance <= 0) {
      res.status(403).json({
        ok: false,
        eligible: false,
        required: true,
        phaseId,
        phaseName,
        snapshotVersion: snapshotData?.snapshotVersion || null,
        error: 'Wallet is not eligible for this phase',
      })
      return
    }

    if (checkOnly) {
      res.status(200).json({
        ok: true,
        eligible: true,
        required: true,
        phaseId,
        phaseName,
        maxAllowance,
        contract: contractAddress,
        snapshotVersion: snapshotData?.snapshotVersion || null,
      })
      return
    }

    const signerPrivateKey = String(process.env.WHITELIST_SIGNER_PRIVATE_KEY || '').trim()
    if (!signerPrivateKey) {
      res.status(500).json({ ok: false, error: 'WHITELIST_SIGNER_PRIVATE_KEY is not configured' })
      return
    }

    const ttlSeconds = Math.max(60, Number(process.env.WHITELIST_PROOF_TTL_SECONDS || DEFAULT_PROOF_TTL_SECONDS))
    const nowSeconds = Math.floor(Date.now() / 1000)
    const deadline = nowSeconds + ttlSeconds
    const chainId = readSnapshotChainId(snapshotData)

    const signer = new ethers.Wallet(signerPrivateKey)
    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    const structHash = ethers.keccak256(
      abiCoder.encode(
        ['bytes32', 'address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
        [WHITELIST_TYPEHASH, wallet, BigInt(phaseId), BigInt(maxAllowance), BigInt(deadline), contractAddress, BigInt(chainId)]
      )
    )
    const signature = await signer.signMessage(ethers.getBytes(structHash))

    res.status(200).json({
      ok: true,
      eligible: true,
      required: true,
      phaseId,
      phaseName,
      maxAllowance,
      deadline,
      signature,
      signer: signer.address,
      chainId,
      contract: contractAddress,
      snapshotVersion: snapshotData?.snapshotVersion || null,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: String(error?.message || 'Failed to build whitelist proof'),
    })
  }
}
