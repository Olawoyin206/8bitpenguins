import { ethers } from 'ethers'
import contractABI from './abi/EightBitPenguinsUpgradeable.abi.js'
import { CHAIN_ID_HEX, CONTRACT_ADDRESS } from './contractConfig.js'
import { renderMintTrueSvg } from './penguinSvg.js'
import { rebuildMintTraitsFromAttributes } from './mintTraits.js'
import { resilientRpcCall } from './readProvider.js'

const ONCHAIN_METADATA_CACHE_PREFIX = 'penguin:onchain-metadata:v5'
const ONCHAIN_METADATA_CACHE_TTL_MS = 30 * 60 * 1000
const ONCHAIN_METADATA_READ_TIMEOUT_MS = 9000
const ONCHAIN_METADATA_HTTP_TIMEOUT_MS = 10000
const ONCHAIN_METADATA_READ_RETRIES = 1
const inMemoryMetadataCache = new Map()
const inflightMetadataFetches = new Map()

function getMetadataScopeKey() {
  const normalizedChain = String(CHAIN_ID_HEX || '').trim().toLowerCase()
  const normalizedContract = String(CONTRACT_ADDRESS || '').trim().toLowerCase()
  return `${normalizedChain}:${normalizedContract}`
}

function memoryMetadataKey(tokenId) {
  const normalizedTokenId = normalizeTokenId(tokenId)
  if (!normalizedTokenId) return ''
  return `${getMetadataScopeKey()}:${normalizedTokenId}`
}

function normalizeTokenId(tokenId) {
  const parsed = Number(tokenId)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

function readMemoryMetadata(tokenId) {
  const memoryKey = memoryMetadataKey(tokenId)
  if (!memoryKey) return null
  const cached = inMemoryMetadataCache.get(memoryKey)
  if (!cached?.meta || typeof cached.meta !== 'object') return null
  if (Date.now() - Number(cached.updatedAt || 0) > ONCHAIN_METADATA_CACHE_TTL_MS) {
    inMemoryMetadataCache.delete(memoryKey)
    return null
  }
  return cached.meta
}

export function normalizeOnchainImage(image) {
  if (!image || typeof image !== 'string') return ''
  if (image.startsWith('data:image/')) return image
  if (image.startsWith('<svg')) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(image)}`
  }
  if (image.startsWith('ipfs://')) {
    return image.replace('ipfs://', 'https://ipfs.io/ipfs/')
  }
  return image
}

export function normalizeOnchainUrl(value) {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('ipfs://')) return value.replace('ipfs://', 'https://ipfs.io/ipfs/')
  return value
}

export function decodeBase64Loose(input) {
  const cleaned = String(input || '')
    .trim()
    .replace(/^base64,/, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[^A-Za-z0-9+/=]/g, '')

  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4)

  try {
    return atob(padded)
  } catch {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    let str = ''
    let buffer = 0
    let bits = 0

    for (let i = 0; i < padded.length; i++) {
      const ch = padded[i]
      if (ch === '=') break
      const idx = chars.indexOf(ch)
      if (idx < 0) continue
      buffer = (buffer << 6) | idx
      bits += 6
      if (bits >= 8) {
        bits -= 8
        str += String.fromCharCode((buffer >> bits) & 0xff)
      }
    }
    return str
  }
}

function svgMarkupToBase64DataUri(svgMarkup) {
  if (!svgMarkup || typeof svgMarkup !== 'string') return ''
  const encoded = btoa(unescape(encodeURIComponent(svgMarkup)))
  return `data:image/svg+xml;base64,${encoded}`
}

function metadataHasRenderableImage(meta) {
  if (!meta || typeof meta !== 'object') return false
  return Boolean(meta.image || meta.image2d || meta.image3d)
}

function normalizeMetadataImageFallback(meta) {
  if (!meta || typeof meta !== 'object') return meta
  if (!meta.image) {
    meta.image = normalizeOnchainImage(meta.image2d || meta.image3d || '')
  }
  return meta
}

async function fetchWithTimeout(url, options = {}, timeoutMs = ONCHAIN_METADATA_HTTP_TIMEOUT_MS) {
  const supportsAbort = typeof AbortController !== 'undefined'
  if (!supportsAbort) {
    return fetch(url, options)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function metadataCacheKey(tokenId) {
  const normalizedTokenId = normalizeTokenId(tokenId)
  const scope = getMetadataScopeKey()
  return normalizedTokenId
    ? `${ONCHAIN_METADATA_CACHE_PREFIX}:${scope}:${normalizedTokenId}`
    : ''
}

function readMetadataCache(tokenId) {
  if (typeof window === 'undefined') return null
  const normalizedTokenId = normalizeTokenId(tokenId)
  if (!normalizedTokenId) return null

  const memoryHit = readMemoryMetadata(normalizedTokenId)
  if (memoryHit) return memoryHit

  const cacheKey = metadataCacheKey(tokenId)
  if (!cacheKey) return null

  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.meta || typeof parsed.meta !== 'object') return null
    const updatedAt = Number(parsed.updatedAt || 0)
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null
    if (Date.now() - updatedAt > ONCHAIN_METADATA_CACHE_TTL_MS) return null
    inMemoryMetadataCache.set(memoryMetadataKey(normalizedTokenId), {
      updatedAt,
      meta: parsed.meta,
    })
    return parsed.meta
  } catch {
    return null
  }
}

export function readCachedOnchainMetadata(tokenId) {
  return readMetadataCache(tokenId)
}

export function invalidateCachedOnchainMetadata(tokenId) {
  const memoryKey = memoryMetadataKey(tokenId)
  if (memoryKey) {
    inMemoryMetadataCache.delete(memoryKey)
    inflightMetadataFetches.delete(memoryKey)
  }
  if (typeof window === 'undefined') return
  const cacheKey = metadataCacheKey(tokenId)
  if (!cacheKey) return
  try {
    window.localStorage.removeItem(cacheKey)
  } catch {
    // Ignore cache delete failures.
  }
}

export function clearOnchainMetadataCache() {
  inMemoryMetadataCache.clear()
  inflightMetadataFetches.clear()

  if (typeof window === 'undefined') return
  try {
    const keys = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key) continue
      if (key.startsWith('penguin:onchain-metadata:')) {
        keys.push(key)
      }
    }
    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Ignore cache clear failures.
  }
}

function writeMetadataCache(tokenId, meta) {
  const memoryKey = memoryMetadataKey(tokenId)
  if (memoryKey && meta && typeof meta === 'object') {
    inMemoryMetadataCache.set(memoryKey, {
      updatedAt: Date.now(),
      meta,
    })
  }

  if (typeof window === 'undefined') return
  const cacheKey = metadataCacheKey(tokenId)
  if (!cacheKey || !meta || typeof meta !== 'object') return

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({
      updatedAt: Date.now(),
      meta,
    }))
  } catch {
    // Ignore cache write failures.
  }
}

export function buildImageFromAttributes(attributes) {
  const traits = rebuildMintTraitsFromAttributes(attributes)
  if (!traits.background || !traits.body || !traits.belly || !traits.beak || !traits.eyes || !traits.head || !traits.feet) {
    return ''
  }
  return svgMarkupToBase64DataUri(renderMintTrueSvg(traits))
}

function appendDerivedRarityTraits(attributes, rarityScore, rarityRank) {
  const nextAttributes = Array.isArray(attributes) ? [...attributes] : []
  const hasTraitType = (traitType) => nextAttributes.some(
    (attr) => String(attr?.trait_type || '').trim().toLowerCase() === String(traitType || '').trim().toLowerCase()
  )

  if (rarityScore !== null && Number.isFinite(Number(rarityScore)) && !hasTraitType('Rarity Score')) {
    nextAttributes.push({ trait_type: 'Rarity Score', value: String(rarityScore) })
  }
  if (rarityRank !== null && Number.isFinite(Number(rarityRank)) && Number(rarityRank) > 0 && !hasTraitType('Rarity Rank')) {
    nextAttributes.push({ trait_type: 'Rarity Rank', value: `#${rarityRank}` })
  }

  return nextAttributes
}

function extractImageFromMetadataString(raw) {
  if (!raw || typeof raw !== 'string') return ''

  try {
    const parsed = JSON.parse(raw)
    return normalizeOnchainImage(parsed.image)
  } catch {
    const marker = '"image":"'
    const start = raw.indexOf(marker)
    if (start === -1) return ''
    const from = raw.slice(start + marker.length)
    const candidates = ['","attributes"', '","description"', '"}']
    let end = -1
    for (const candidate of candidates) {
      const idx = from.indexOf(candidate)
      if (idx !== -1 && (end === -1 || idx < end)) end = idx
    }
    if (end === -1) return ''
    return normalizeOnchainImage(from.slice(0, end).replace(/\\"/g, '"'))
  }
}

function extractStringFieldFromMetadataString(raw, fieldName) {
  if (!raw || typeof raw !== 'string' || !fieldName) return ''
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = raw.match(new RegExp(`"${escapedFieldName}"\\s*:\\s*"((?:\\\\.|[^"])*)"`, 's'))
  if (!match?.[1]) return ''
  try {
    return JSON.parse(`"${match[1]}"`)
  } catch {
    return match[1].replace(/\\"/g, '"')
  }
}

function extractArrayFieldFromMetadataString(raw, fieldName) {
  if (!raw || typeof raw !== 'string' || !fieldName) return []
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = raw.match(new RegExp(`"${escapedFieldName}"\\s*:\\s*(\\[[\\s\\S]*?\\])(?=\\s*,\\s*"|\\s*})`, 's'))
  if (!match?.[1]) return []
  try {
    const parsed = JSON.parse(match[1])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function extractMetadataFromMetadataString(raw) {
  const meta = {
    name: '',
    description: '',
    image: '',
    image2d: '',
    image3d: '',
    animationUrl: '',
    attributes: [],
    rarityScore: null,
    rarityRank: null,
    evolved3D: false,
  }
  if (!raw || typeof raw !== 'string') return meta

  try {
    const parsed = JSON.parse(raw)
    meta.name = parsed.name || ''
    meta.description = parsed.description || ''
    meta.image = normalizeOnchainImage(parsed.image || '')
    meta.image2d = normalizeOnchainImage(parsed.image_2d || parsed.image2d || '')
    meta.image3d = normalizeOnchainImage(parsed.image_3d || parsed.image3d || '')
    meta.animationUrl = normalizeOnchainUrl(parsed.animation_url || parsed.animationUrl || '')
    meta.attributes = Array.isArray(parsed.attributes) ? parsed.attributes : []
    meta.evolved3D = Boolean(parsed.evolved_3d || parsed.evolved3D)
    if (Number.isFinite(Number(parsed.rarity_score))) meta.rarityScore = Number(parsed.rarity_score)
    if (Number.isFinite(Number(parsed.rarity_rank))) meta.rarityRank = Number(parsed.rarity_rank)
    meta.attributes = appendDerivedRarityTraits(meta.attributes, meta.rarityScore, meta.rarityRank)
    if (!meta.name) meta.name = '8bit Penguins'
    return meta
  } catch {
    meta.name = extractStringFieldFromMetadataString(raw, 'name')
    meta.description = extractStringFieldFromMetadataString(raw, 'description')
    meta.image = extractImageFromMetadataString(raw)
    meta.image2d = normalizeOnchainImage(extractStringFieldFromMetadataString(raw, 'image_2d') || extractStringFieldFromMetadataString(raw, 'image2d'))
    meta.image3d = normalizeOnchainImage(extractStringFieldFromMetadataString(raw, 'image_3d') || extractStringFieldFromMetadataString(raw, 'image3d'))
    meta.animationUrl = normalizeOnchainUrl(extractStringFieldFromMetadataString(raw, 'animation_url') || extractStringFieldFromMetadataString(raw, 'animationUrl'))
    meta.attributes = extractArrayFieldFromMetadataString(raw, 'attributes')

    const scoreMatch = raw.match(/"rarity_score"\s*:\s*(\d+)/)
    const rankMatch = raw.match(/"rarity_rank"\s*:\s*(\d+)/)
    if (scoreMatch) meta.rarityScore = Number(scoreMatch[1])
    if (rankMatch) meta.rarityRank = Number(rankMatch[1])
    if (/"evolved_3d"\s*:\s*true/i.test(raw)) meta.evolved3D = true
    meta.attributes = appendDerivedRarityTraits(meta.attributes, meta.rarityScore, meta.rarityRank)
    if (!meta.name) meta.name = '8bit Penguins'

    return meta
  }
}

export async function fetchOnchainMetadataFromTokenURI(tokenId, rpcProvider) {
  const normalizedTokenId = normalizeTokenId(tokenId)
  const memoryKey = memoryMetadataKey(normalizedTokenId)
  if (!normalizedTokenId) {
    throw new Error('Invalid token ID')
  }

  const memoryCachedMeta = readMemoryMetadata(normalizedTokenId)
  if (
    memoryCachedMeta?.image &&
    Object.prototype.hasOwnProperty.call(memoryCachedMeta, 'animationUrl')
  ) {
    return memoryCachedMeta
  }

  const cachedMeta = readMetadataCache(tokenId)
  if (
    cachedMeta?.image &&
    Object.prototype.hasOwnProperty.call(cachedMeta, 'animationUrl')
  ) {
    return cachedMeta
  }

  if (memoryKey && inflightMetadataFetches.has(memoryKey)) {
    return inflightMetadataFetches.get(memoryKey)
  }

  const task = (async () => {
    if (!rpcProvider) {
      throw new Error('No read provider configured')
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider)
    try {
      try {
        const rawJson = await resilientRpcCall(
          () => contract.tokenMetadataJson(normalizedTokenId),
          {
            timeoutMs: ONCHAIN_METADATA_READ_TIMEOUT_MS,
            retries: ONCHAIN_METADATA_READ_RETRIES,
          }
        )
        if (rawJson && typeof rawJson === 'string' && rawJson.startsWith('{')) {
          const meta = normalizeMetadataImageFallback(extractMetadataFromMetadataString(rawJson))
          if (metadataHasRenderableImage(meta)) {
            writeMetadataCache(normalizedTokenId, meta)
            return meta
          }
        }
      } catch {
        // Fall through to tokenURI parsing when tokenMetadataJson is unavailable.
      }

      const tokenUri = await resilientRpcCall(
        () => contract.tokenURI(normalizedTokenId),
        {
          timeoutMs: ONCHAIN_METADATA_READ_TIMEOUT_MS,
          retries: ONCHAIN_METADATA_READ_RETRIES,
        }
      )

      if (tokenUri.startsWith('data:application/json;base64,')) {
        const base64Data = tokenUri.replace('data:application/json;base64,', '')
        const jsonStr = decodeBase64Loose(base64Data)
        const meta = normalizeMetadataImageFallback(extractMetadataFromMetadataString(jsonStr))
        if (!metadataHasRenderableImage(meta)) throw new Error('Missing image in token metadata')
        writeMetadataCache(normalizedTokenId, meta)
        return meta
      }

      if (tokenUri.startsWith('data:application/json;utf8,')) {
        const jsonStr = decodeURIComponent(tokenUri.replace('data:application/json;utf8,', ''))
        const meta = normalizeMetadataImageFallback(extractMetadataFromMetadataString(jsonStr))
        if (!metadataHasRenderableImage(meta)) throw new Error('Missing image in token metadata')
        writeMetadataCache(normalizedTokenId, meta)
        return meta
      }

      if (tokenUri.startsWith('http://') || tokenUri.startsWith('https://') || tokenUri.startsWith('ipfs://')) {
        const metadataUrl = tokenUri.startsWith('ipfs://')
          ? tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
          : tokenUri
        const res = await fetchWithTimeout(metadataUrl, { cache: 'force-cache' })
        if (!res.ok) throw new Error(`Failed to fetch token metadata (${res.status})`)
        const json = await res.json()
        const meta = {
          name: json.name || '',
          description: json.description || '',
          image: normalizeOnchainImage(json.image || ''),
          image2d: normalizeOnchainImage(json.image_2d || json.image2d || ''),
          image3d: normalizeOnchainImage(json.image_3d || json.image3d || ''),
          animationUrl: normalizeOnchainUrl(json.animation_url || json.animationUrl || ''),
          attributes: Array.isArray(json.attributes) ? json.attributes : [],
          rarityScore: Number.isFinite(Number(json.rarity_score)) ? Number(json.rarity_score) : null,
          rarityRank: Number.isFinite(Number(json.rarity_rank)) ? Number(json.rarity_rank) : null,
          evolved3D: Boolean(json.evolved_3d || json.evolved3D),
        }
        normalizeMetadataImageFallback(meta)
        meta.attributes = appendDerivedRarityTraits(meta.attributes, meta.rarityScore, meta.rarityRank)
        if (!metadataHasRenderableImage(meta)) throw new Error('Missing image in token metadata')
        writeMetadataCache(normalizedTokenId, meta)
        return meta
      }

      throw new Error(`Unsupported tokenURI format: ${String(tokenUri || '').slice(0, 32)}`)
    } catch (err) {
      throw err || new Error('Unable to fetch on-chain image')
    }
  })()

  if (memoryKey) {
    inflightMetadataFetches.set(memoryKey, task)
  }

  try {
    return await task
  } finally {
    if (memoryKey) {
      inflightMetadataFetches.delete(memoryKey)
    }
  }
}

export async function fetchOnchainMetadataPreview(tokenId, rpcProvider) {
  return fetchOnchainMetadataFromTokenURI(tokenId, rpcProvider)
}

export async function fetchRawOnchainMetadataJson(tokenId, rpcProvider) {
  if (!rpcProvider) {
    throw new Error('No read provider configured')
  }

  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider)
  try {
    try {
      const rawJson = await contract.tokenMetadataJson(tokenId)
      if (typeof rawJson === 'string' && rawJson.trim()) {
        try {
          return JSON.stringify(JSON.parse(rawJson), null, 2)
        } catch {
          return rawJson
        }
      }
    } catch {
      // Fall through to tokenURI decoding.
    }

    const tokenUri = await contract.tokenURI(tokenId)
    if (typeof tokenUri !== 'string' || !tokenUri.trim()) {
      throw new Error('Missing tokenURI')
    }

    if (tokenUri.startsWith('data:application/json;base64,')) {
      const base64Data = tokenUri.replace('data:application/json;base64,', '')
      const jsonStr = decodeBase64Loose(base64Data)
      try {
        return JSON.stringify(JSON.parse(jsonStr), null, 2)
      } catch {
        return jsonStr
      }
    }

    if (tokenUri.startsWith('data:application/json;utf8,')) {
      const jsonStr = decodeURIComponent(tokenUri.replace('data:application/json;utf8,', ''))
      try {
        return JSON.stringify(JSON.parse(jsonStr), null, 2)
      } catch {
        return jsonStr
      }
    }

    return tokenUri
  } catch (err) {
    throw err || new Error('Unable to fetch raw on-chain metadata')
  }
}

export async function fetchTokenUriString(tokenId, rpcProvider) {
  if (!rpcProvider) {
    throw new Error('No read provider configured')
  }

  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, rpcProvider)
  const tokenUri = await contract.tokenURI(tokenId)
  if (typeof tokenUri === 'string' && tokenUri.trim()) {
    return tokenUri
  }
  throw new Error('Unable to fetch tokenURI')
}
