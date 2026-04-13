import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import ConnectedWallet from '../components/ConnectedWallet.jsx'
import ConnectWalletButton from '../components/ConnectWalletButton.jsx'
import Button from '../components/Button.jsx'
import StatusNotice from '../components/StatusNotice.jsx'
import { PaginatedGallery, TokenGalleryCard } from '../components/NFTGallery.jsx'
import { uploadDataUrlToIPFS } from '../ipfs.js'
import { render3DSnapshot } from '../render3DSnapshot.js'
import SiteNav from '../components/SiteNav.jsx'
import '../Mint.css'
import { BLOCK_EXPLORER_URL, CHAIN_ID_HEX, CHAIN_NAME, CONTRACT_ADDRESS, ETH_SEPOLIA_RPC } from '../contractConfig.js'
import contractABI from '../abi/EightBitPenguinsUpgradeable.abi.js'
import { appendAdminActivityLog } from '../adminLog.js'
import {
  fetchOnchainMetadataFromTokenURI as fetchSharedOnchainMetadataFromTokenURI,
  fetchRawOnchainMetadataJson,
  readCachedOnchainMetadata,
  invalidateCachedOnchainMetadata,
  fetchTokenUriString,
  clearOnchainMetadataCache,
} from '../onchainMetadata.js'
import { fetchOwnedTokenIds } from '../ownedTokenDiscovery.js'
import { getRpcCircuitState, getSharedReadProvider } from '../readProvider.js'

const EVOLVED_IMAGE_SIZE = 2048
const EVOLVE_IMAGE_ONLY_GAS_LIMIT = 700000n
const EVOLVE_GALLERY_CACHE_PREFIX = 'penguin:evolve-gallery:v1'
const EVOLVE_GLOBAL_PROGRESS_CACHE_PREFIX = 'penguin:evolve-global-progress:v2'
const EVOLVE_GLOBAL_PROGRESS_LEGACY_CACHE_KEY = 'penguin:evolve-global-progress:v1'
const EVOLVE_GLOBAL_PROGRESS_CACHE_TTL_MS = 2 * 60 * 1000
const GLOBAL_PROGRESS_MIN_INTERVAL_MS = 30000
const GLOBAL_PROGRESS_HIGH_SUPPLY_MIN_INTERVAL_MS = 5 * 60 * 1000
const AUTO_PROGRESS_SCAN_MAX_SUPPLY = 1200
const SILENT_OWNED_REFRESH_MIN_INTERVAL_MS = 20000
const PRIORITY_META_HYDRATE_COUNT = 2
const METADATA_FETCH_TIMEOUT_MS = 12000
const META_HYDRATE_RETRY_MS = 3500
const EAGER_EVOLVED_LOOKUP_MAX_TOKENS = 96
const BACKGROUND_EVOLVED_LOOKUP_CHUNK = 16
const BACKGROUND_EVOLVED_LOOKUP_DELAY_MS = 120
const EVOLVE_EXTRA_ABI = [
  'function tokenInteractiveModel(uint256 tokenId) view returns (string)',
  'function tokenOriginalImage(uint256 tokenId) view returns (string)',
  'function tokenEvolvedImage(uint256 tokenId) view returns (string)',
  'function tokenEvolvedImageCid(uint256 tokenId) view returns (string)',
  'function evolveFee() view returns (uint256)',
  'function evolveFeeToken() view returns (address)',
  'function evolveFeeTokenAmount() view returns (uint256)',
  'function evolveTo3DImageOnlyWithCid(uint256 tokenId, string imageCid)',
  'error NativeValueNotAcceptedForTokenFee()',
]
const EVOLVE_PAYABLE_TX_ABI = [
  'function evolveTo3DImageOnly(uint256 tokenId, string imageUri) payable',
  'function evolveTo3DImageOnlyWithCid(uint256 tokenId, string imageCid) payable',
]
const ERC20_FEE_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
]
const EVOLVE_CONTRACT_ABI = [...contractABI, ...EVOLVE_EXTRA_ABI]
const contractInterface = new ethers.Interface(EVOLVE_CONTRACT_ABI)
const CANONICAL_NAME_TRAITS = new Set([
  'Frosty',
  'Waddles',
  'Pebble',
  'Chilly',
  'Snowy',
  'Flurry',
  'Icee',
  'Bubbles',
  'Nippy',
  'Tuxy',
])

function normalizeFeeTokenAddress(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  try {
    return ethers.getAddress(trimmed)
  } catch {
    return ''
  }
}

function formatTokenAmount(value, decimals = 6) {
  try {
    const formatted = ethers.formatUnits(BigInt(value || 0n), decimals)
    return formatted.replace(/\.?0+$/, '') || '0'
  } catch {
    return '0'
  }
}

const MODEL_TRAITS = {
  background: [
    { name: 'Light Blue', color: '#ADD8E6' }, { name: 'Baby Pink', color: '#F4A6B8' }, { name: 'Sky Blue', color: '#87CEEB' }, { name: 'Arctic White', color: '#F8FBFF', fx: 'snowflakes' },
    { name: 'Soft Lavender', color: '#C8B6FF' }, { name: 'Mint Green', color: '#98FFCC' }, { name: 'Pastel Pink', color: '#FFD1DC' }, { name: 'Royal Blue', color: '#4169E1', fx: 'softdots' },
    { name: 'Peach Cream', color: '#FFE5B4' }, { name: 'Lilac Purple', color: '#D8B4F8' }, { name: 'Warm Beige', color: '#F5F5DC' }, { name: 'Coral Red', color: '#FF6B6B' },
    { name: 'Midnight Blue', color: '#1A1A2E', fx: 'snowflakes' }, { name: 'Sunset Orange', color: '#FF7A18' }, { name: 'Deep Teal', color: '#0F4C5C', fx: 'softdots' }, { name: 'Forest Green', color: '#2E8B57' },
    { name: 'Charcoal Gray', color: '#36454F' }, { name: 'Neon Yellow', color: '#F5FF3B' }, { name: 'Electric Cyan', color: '#00FFFF' }, { name: 'Golden Glow', color: '#FFD700', fx: 'softdots' },
    { name: 'Crimson Red', color: '#DC143C' },
  ],
  body: [
    { name: 'Skeleton Dark Bone', base: '#D6CCB8', highlight: '#E8E2D4', shadow: '#9F8B7D' }, { name: 'Snow White', base: '#F5F5F5', highlight: '#FFFFFF', shadow: '#C2C2C2' },
    { name: 'Jet Black', base: '#1C1C1C', highlight: '#484848', shadow: '#000000' }, { name: 'Ash Gray', base: '#B2B2B2', highlight: '#D9D9D9', shadow: '#858585' },
    { name: 'Cream', base: '#FFF3D6', highlight: '#FFFFEB', shadow: '#CCC2A3' }, { name: 'Light Brown', base: '#C68642', highlight: '#E0A86A', shadow: '#8E5C2B' },
    { name: 'Chocolate Brown', base: '#5C3A21', highlight: '#8A6145', shadow: '#3A2514' }, { name: 'Golden Tan', base: '#D2A679', highlight: '#E8C9A4', shadow: '#9E7856' },
    { name: 'Ice Blue', base: '#CFE9FF', highlight: '#F0F8FF', shadow: '#9FBFCD' }, { name: 'Baby Blue', base: '#A7C7E7', highlight: '#D4E9F5', shadow: '#7A96B0' },
    { name: 'Ocean Blue', base: '#2B6CB0', highlight: '#5A9AD4', shadow: '#1D4D7E' }, { name: 'Soft Pink', base: '#F4A6B8', highlight: '#FAD2DD', shadow: '#B77A8B' },
    { name: 'Bubblegum Pink', base: '#FF77AA', highlight: '#FFA5CC', shadow: '#CC4F7D' }, { name: 'Lavender Body', base: '#BFA2DB', highlight: '#D9C9EB', shadow: '#8F76A4' },
    { name: 'Royal Purple', base: '#6B3FA0', highlight: '#9670BF', shadow: '#4D2A75' }, { name: 'Mint Body', base: '#A8E6CF', highlight: '#D4F5E8', shadow: '#7DB39C' },
    { name: 'Olive Green', base: '#708238', highlight: '#96A65C', shadow: '#515D27' }, { name: 'Coral Body', base: '#FF8C69', highlight: '#FFB49B', shadow: '#CC634A' },
    { name: 'Sunset Gold', base: '#E6B422', highlight: '#F0CC57', shadow: '#B38618' }, { name: 'Glass Style', base: '#E0FFFF', highlight: '#F0FFFF', shadow: '#A8C8C8' },
  ],
  belly: [
    { name: 'Cream', base: '#FDF5E6', highlight: '#FFFAF0', shadow: '#F5E6D3' }, { name: 'Peach', base: '#FFDAB9', highlight: '#FFE4C4', shadow: '#F5CBA7' },
    { name: 'Light Blue', base: '#D6EAF8', highlight: '#EBF5FB', shadow: '#AED6F1' }, { name: 'Mint', base: '#D5F5E3', highlight: '#E8F8F5', shadow: '#ABEBC6' },
    { name: 'Lavender', base: '#E8DAEF', highlight: '#F4ECF7', shadow: '#D2B4DE' },
  ],
  beak: [
    { name: 'Small', type: 'small', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }, { name: 'Large', type: 'large', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Wide', type: 'wide', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }, { name: 'Pointy', type: 'pointy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Round', type: 'round', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }, { name: 'Puffy', type: 'puffy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
  ],
  eyes: [
    { name: 'Normal', type: 'round' }, { name: 'Happy', type: 'happy' }, { name: 'Sad', type: 'sad' }, { name: 'Angry', type: 'angry' }, { name: 'Sleepy', type: 'sleepy' },
    { name: 'Surprised', type: 'surprised' }, { name: 'Wink', type: 'wink' }, { name: 'Side-eye', type: 'sideeye' }, { name: 'Closed', type: 'closed' }, { name: 'Sparkle', type: 'sparkle' },
  ],
  head: [
    { name: 'None', type: 'none' }, { name: 'Cap Gold', type: 'cap', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' }, { name: 'Cap Matte Black', type: 'cap', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' },
    { name: 'Cap Sapphire Blue', type: 'cap', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' }, { name: 'Cap Crimson', type: 'cap', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' },
    { name: 'Cap Royal Gold', type: 'cap', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' }, { name: 'Beanie Gold', type: 'beanie', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' },
    { name: 'Beanie Matte Black', type: 'beanie', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' }, { name: 'Beanie Sapphire Blue', type: 'beanie', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' },
    { name: 'Beanie Crimson', type: 'beanie', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' }, { name: 'Beanie Royal Gold', type: 'beanie', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' },
    { name: 'Scarf Gold', type: 'scarf', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' }, { name: 'Scarf Matte Black', type: 'scarf', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' },
    { name: 'Scarf Sapphire Blue', type: 'scarf', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' }, { name: 'Scarf Crimson', type: 'scarf', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' },
    { name: 'Scarf Royal Gold', type: 'scarf', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' }, { name: 'Headband Gold', type: 'headband', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' },
    { name: 'Headband Matte Black', type: 'headband', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' }, { name: 'Headband Sapphire Blue', type: 'headband', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' },
    { name: 'Headband Crimson', type: 'headband', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' }, { name: 'Headband Royal Gold', type: 'headband', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' },
    { name: 'Crown Imperial', type: 'crown', style: 'imperial' }, { name: 'Crown Elegant', type: 'crown', style: 'elegant' }, { name: 'Halo', type: 'halo' },
  ],
  feet: [
    { name: 'Default Orange', type: 'default', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Default Pink', type: 'default', base: '#FD79A8', highlight: '#FDCBDF', shadow: '#E84393' },
    { name: 'Default Black', type: 'default', base: '#2D3436', highlight: '#636E72', shadow: '#0D1318' },
    { name: 'Default White', type: 'default', base: '#DFE6E9', highlight: '#FFFFFF', shadow: '#B2BEC3' },
  ],
}

const FALLBACK_TRAITS = {
  background: MODEL_TRAITS.background[0],
  body: MODEL_TRAITS.body[0],
  belly: MODEL_TRAITS.belly[0],
  beak: MODEL_TRAITS.beak[0],
  eyes: MODEL_TRAITS.eyes[0],
  head: MODEL_TRAITS.head[0],
  feet: MODEL_TRAITS.feet[0],
}

function decodeBase64Loose(input) {
  const cleaned = String(input || '').trim().replace(/^base64,/, '').replace(/\s+/g, '')
  const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  try {
    return atob(padded)
  } catch {
    return ''
  }
}

function normalizeOnchainUrl(value) {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('ipfs://')) return value.replace('ipfs://', 'https://ipfs.io/ipfs/')
  return value
}

function pickFirstUrl(candidates = []) {
  for (const candidate of candidates) {
    const normalized = normalizeOnchainUrl(String(candidate || '').trim())
    if (normalized) return normalized
  }
  return ''
}

function extractAnimationOrModelUrlFromObject(metadata) {
  if (!metadata || typeof metadata !== 'object') return ''
  return pickFirstUrl([
    metadata.animation_url,
    metadata.animationUrl,
    metadata.model,
    metadata.model_url,
    metadata.modelUrl,
    metadata.model_uri,
    metadata.modelUri,
    metadata.interactive_model,
    metadata.interactiveModel,
    metadata.tokenInteractiveModel,
  ])
}

function extractAnimationOrModelUrlFromString(raw) {
  return pickFirstUrl([
    extractStringFieldFromMetadataString(raw, 'animation_url'),
    extractStringFieldFromMetadataString(raw, 'animationUrl'),
    extractStringFieldFromMetadataString(raw, 'model'),
    extractStringFieldFromMetadataString(raw, 'model_url'),
    extractStringFieldFromMetadataString(raw, 'modelUrl'),
    extractStringFieldFromMetadataString(raw, 'model_uri'),
    extractStringFieldFromMetadataString(raw, 'modelUri'),
    extractStringFieldFromMetadataString(raw, 'interactive_model'),
    extractStringFieldFromMetadataString(raw, 'interactiveModel'),
    extractStringFieldFromMetadataString(raw, 'tokenInteractiveModel'),
  ])
}

function isModelAssetUrl(url) {
  const normalized = String(url || '').trim().toLowerCase()
  if (!normalized) return false
  return normalized.endsWith('.glb') ||
    normalized.endsWith('.gltf') ||
    normalized.endsWith('.usdz') ||
    normalized.endsWith('.obj')
}

function isHtmlAnimationUrl(url) {
  const normalized = String(url || '').trim().toLowerCase()
  if (!normalized) return false
  return normalized.startsWith('data:text/html') ||
    normalized.endsWith('.html') ||
    normalized.includes('text/html')
}

function inspectOnchainHtmlToggle(animationUrl) {
  const raw = String(animationUrl || '').trim()
  if (!raw.startsWith('data:text/html;base64,')) {
    return { checked: false, hasModeInputs: false, sourceCount: null }
  }
  const decoded = decodeBase64Loose(raw.replace('data:text/html;base64,', ''))
  if (!decoded) {
    return { checked: true, hasModeInputs: false, sourceCount: null }
  }
  const hasModeInputs = /id=["']m2["']/i.test(decoded) && /id=["']m3["']/i.test(decoded)
  const matches = decoded.match(/(?:ipfs:\/\/[^\s"'`<>)]+|https?:\/\/[^\s"'`<>)]+|data:image\/[A-Za-z0-9+.-]+;base64,[A-Za-z0-9+/=]+)/g) || []
  const sourceSet = new Set(
    matches
      .map((value) => normalizeOnchainUrl(String(value || '').trim()))
      .filter(Boolean)
  )
  return { checked: true, hasModeInputs, sourceCount: sourceSet.size }
}

function collectMediaValidationIssues({ isEvolved, image2d, image3d, animationUrl }) {
  if (!isEvolved) return []

  const issues = []
  const normalized2D = normalizeOnchainUrl(String(image2d || '').trim())
  const normalized3D = normalizeOnchainUrl(String(image3d || '').trim())
  const normalizedAnimation = normalizeOnchainUrl(String(animationUrl || '').trim())

  if (!normalized3D && !normalizedAnimation) {
    issues.push('Missing 3D source: both image_3d and animation_url are empty.')
  }
  if (normalized2D && normalized3D && normalized2D === normalized3D) {
    issues.push('2D and 3D image URLs are identical.')
  }

  if (isHtmlAnimationUrl(normalizedAnimation)) {
    const htmlStats = inspectOnchainHtmlToggle(normalizedAnimation)
    if (htmlStats.checked && !htmlStats.hasModeInputs) {
      issues.push('On-chain HTML toggle is missing mode inputs (m2/m3).')
    }
    if (htmlStats.sourceCount === 0) {
      issues.push('On-chain HTML has no embedded media source.')
    } else if (htmlStats.sourceCount === 1) {
      issues.push('On-chain HTML has only one embedded media source, so toggle shows one image.')
    }
  }

  return issues
}

function normalizeOnchainImage(image) {
  if (!image || typeof image !== 'string') return ''
  if (image.startsWith('data:image/')) return image
  if (image.startsWith('<svg')) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(image)}`
  }
  return normalizeOnchainUrl(image)
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

function extractNameTraitValue(attributes = []) {
  if (!Array.isArray(attributes)) return ''
  const match = attributes.find(
    (attr) => String(attr?.trait_type || '').trim().toLowerCase() === 'name'
  )
  return String(match?.value || '').trim()
}

function isCanonicalNameTraitValue(value) {
  return CANONICAL_NAME_TRAITS.has(String(value || '').trim())
}

function resolveMetadataName(meta, tokenId) {
  const nameTrait = extractNameTraitValue(meta?.attributes || [])
  if (nameTrait) return nameTrait
  const rawName = String(meta?.name || '').trim()
  if (rawName) return rawName
  return Number.isInteger(Number(tokenId)) && Number(tokenId) > 0
    ? `8bit Penguins #${tokenId}`
    : '8bit Penguins'
}

function shouldRefreshLegacyNameCache(meta) {
  const nameTrait = extractNameTraitValue(meta?.attributes || [])
  if (!nameTrait) return false
  return !isCanonicalNameTraitValue(nameTrait)
}

function extractMetadataFromMetadataString(raw) {
  const meta = {
    name: '',
    description: '',
    image: '',
    image2d: '',
    image3d: '',
    animationUrl: '',
    attributes: [],
    evolved3D: false,
    revealed: null,
  }
  if (!raw || typeof raw !== 'string') return meta

  try {
    const parsed = JSON.parse(raw)
    const attributes = Array.isArray(parsed.attributes) ? parsed.attributes : []
    const parsedName = String(parsed.name || '').trim()
    const nameFromTrait = extractNameTraitValue(attributes)
    return {
      name: nameFromTrait || parsedName,
      description: parsed.description || '',
      image: normalizeOnchainImage(parsed.image || ''),
      image2d: normalizeOnchainImage(parsed.image_2d || ''),
      image3d: normalizeOnchainImage(parsed.image_3d || ''),
      animationUrl: extractAnimationOrModelUrlFromObject(parsed),
      attributes,
      evolved3D: Boolean(parsed.evolved_3d),
      revealed: typeof parsed.revealed === 'boolean' ? parsed.revealed : null,
    }
  } catch {
    meta.name = extractStringFieldFromMetadataString(raw, 'name')
    meta.description = extractStringFieldFromMetadataString(raw, 'description')
    meta.image = extractImageFromMetadataString(raw)

    const image2dMatch = raw.match(/"image_2d"\s*:\s*"([^"]*)"/)
    const image3dMatch = raw.match(/"image_3d"\s*:\s*"([^"]*)"/)
    if (image2dMatch?.[1]) meta.image2d = normalizeOnchainImage(image2dMatch[1].replace(/\\"/g, '"'))
    if (image3dMatch?.[1]) meta.image3d = normalizeOnchainImage(image3dMatch[1].replace(/\\"/g, '"'))
    meta.animationUrl = extractAnimationOrModelUrlFromString(raw)

    meta.attributes = extractArrayFieldFromMetadataString(raw, 'attributes')
    const nameFromTrait = extractNameTraitValue(meta.attributes)
    if (!meta.name && nameFromTrait) meta.name = nameFromTrait

    if (/"evolved_3d"\s*:\s*true/i.test(raw)) meta.evolved3D = true
    if (/"revealed"\s*:\s*false/i.test(raw)) meta.revealed = false
    if (/"revealed"\s*:\s*true/i.test(raw)) meta.revealed = true

    return meta
  }
}

function parseAttributesJson(raw) {
  if (!raw || typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function metaHasEvolvedMarker(meta) {
  if (!meta) return false
  if (meta.evolved3D || meta.image3d) return true
  return (meta.attributes || []).some(
    (a) => a?.trait_type === 'Evolution' && String(a.value).toLowerCase().includes('evolved')
  )
}

function resolvePreviewImage(meta) {
  if (!meta) return ''
  return meta.image3d || meta.image || meta.image2d || ''
}

function resolve2DPreviewImage(meta) {
  if (!meta) return ''
  return meta.image2d || meta.image || ''
}

function resolve3DPreviewImage(meta) {
  if (!meta) return ''
  return meta.image3d || meta.image || ''
}

function parseTokenUriMetadataText(tokenUri) {
  const raw = String(tokenUri || '').trim()
  if (!raw) return ''

  if (raw.startsWith('data:application/json;base64,')) {
    return decodeBase64Loose(raw.replace('data:application/json;base64,', ''))
  }

  if (raw.startsWith('data:application/json;utf8,')) {
    try {
      return decodeURIComponent(raw.replace('data:application/json;utf8,', ''))
    } catch {
      return ''
    }
  }

  return ''
}

function pickTokenUriImageFields(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return { image2d: '', image3d: '', animationUrl: '', metadataText: '' }
  }

  const image2d = normalizeOnchainImage(
    metadata.image_2d ||
    metadata.image2d ||
    ''
  )

  const image3d = normalizeOnchainImage(
    metadata.image_3d ||
    metadata.image3d ||
    ''
  )

  const animationUrl = normalizeOnchainUrl(
    extractAnimationOrModelUrlFromObject(metadata)
  )

  let metadataText = ''
  try {
    metadataText = JSON.stringify(metadata, null, 2)
  } catch {
    metadataText = ''
  }

  return { image2d, image3d, animationUrl, metadataText }
}

async function resolveTokenUriImages(tokenUri) {
  const raw = String(tokenUri || '').trim()
  if (!raw) return { image2d: '', image3d: '', animationUrl: '', metadataText: '' }

  const inlineMetadataText = parseTokenUriMetadataText(raw)
  if (inlineMetadataText) {
    try {
      const parsed = JSON.parse(inlineMetadataText)
      return pickTokenUriImageFields(parsed)
    } catch {
      return { image2d: '', image3d: '', animationUrl: '', metadataText: inlineMetadataText }
    }
  }

  const normalizedUrl = normalizeOnchainUrl(raw)
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return { image2d: '', image3d: '', animationUrl: '', metadataText: '' }
  }

  try {
    const res = await fetch(normalizedUrl)
    if (!res.ok) return { image2d: '', image3d: '', animationUrl: '', metadataText: '' }
    const parsed = await res.json()
    return pickTokenUriImageFields(parsed)
  } catch {
    return { image2d: '', image3d: '', animationUrl: '', metadataText: '' }
  }
}

async function fetchGalleryTokenMetadata(provider, tokenId) {
  let cachedMeta = readCachedOnchainMetadata(tokenId)
  if (cachedMeta && shouldRefreshLegacyNameCache(cachedMeta)) {
    invalidateCachedOnchainMetadata(tokenId)
    cachedMeta = null
  }
  const baseMeta = cachedMeta && (cachedMeta.image || cachedMeta.image2d || cachedMeta.image3d)
    ? cachedMeta
    : await fetchSharedOnchainMetadataFromTokenURI(tokenId, provider)

  const meta = {
    name: baseMeta?.name || '',
    description: baseMeta?.description || '',
    image: normalizeOnchainImage(baseMeta?.image || ''),
    image2d: normalizeOnchainImage(baseMeta?.image2d || baseMeta?.image_2d || ''),
    image3d: normalizeOnchainImage(baseMeta?.image3d || baseMeta?.image_3d || ''),
    animationUrl: normalizeOnchainUrl(baseMeta?.animationUrl || baseMeta?.animation_url || ''),
    attributes: Array.isArray(baseMeta?.attributes) ? baseMeta.attributes : [],
    evolved3D: Boolean(baseMeta?.evolved3D || baseMeta?.evolved_3d || baseMeta?.image3d || baseMeta?.image_3d),
    revealed: Object.prototype.hasOwnProperty.call(baseMeta || {}, 'revealed')
      ? baseMeta.revealed
      : null,
  }

  return {
    name: resolveMetadataName(meta, tokenId),
    description: meta.description || '',
    image: meta.image || '',
    image2d: meta.image2d || normalizeOnchainImage(meta.image_2d || ''),
    image3d: meta.image3d || normalizeOnchainImage(meta.image_3d || ''),
    animationUrl: normalizeOnchainUrl(meta.animation_url || meta.animationUrl || ''),
    attributes: Array.isArray(meta.attributes) ? meta.attributes : [],
    evolved3D: metaHasEvolvedMarker(meta),
    revealed: meta.revealed,
  }
}

function findByName(list, name, fallback) {
  return list.find((item) => item.name === name) || fallback
}

function parseEffectTraitValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return { name: 'None', variant: 'White' }
  const match = raw.match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/)
  const name = String(match?.[1] || raw).trim()
  const variant = String(match?.[2] || 'White').trim() || 'White'
  if (!name || /^none$/i.test(name)) return { name: 'None', variant: 'White' }
  return { name, variant }
}

function traitsFromAttributes(attributes = []) {
  const map = Object.fromEntries((attributes || []).map((a) => [a.trait_type, a.value]))
  const effect = parseEffectTraitValue(map.Effect)
  let background = findByName(MODEL_TRAITS.background, map.Background, FALLBACK_TRAITS.background)
  if (effect.name === 'Snow' && background && background.fx !== 'snowflakes') {
    background = { ...background, fx: 'snowflakes' }
  } else if (effect.name === 'Stone' && background && background.fx !== 'softdots') {
    background = { ...background, fx: 'softdots' }
  }
  return {
    background,
    body: findByName(MODEL_TRAITS.body, map.Body, FALLBACK_TRAITS.body),
    belly: findByName(MODEL_TRAITS.belly, map.Belly, FALLBACK_TRAITS.belly),
    beak: findByName(MODEL_TRAITS.beak, map.Beak, FALLBACK_TRAITS.beak),
    eyes: findByName(MODEL_TRAITS.eyes, map.Eyes, FALLBACK_TRAITS.eyes),
    head: findByName(MODEL_TRAITS.head, map.Head, FALLBACK_TRAITS.head),
    feet: findByName(MODEL_TRAITS.feet, map.Feet, FALLBACK_TRAITS.feet),
    effect,
  }
}

async function waitForConfirmationWithTimeout(txResponse, timeoutMs = 120000) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Confirmation timeout')), timeoutMs)
  })

  try {
    const receipt = await Promise.race([txResponse.wait(1), timeoutPromise])
    if (!receipt) throw new Error('Confirmation timeout')
    return { receipt, txHash: txResponse.hash }
  } catch (err) {
    if (err?.code === 'TRANSACTION_REPLACED' && !err?.cancelled) {
      const receipt = err?.receipt
      if (!receipt) throw err
      return {
        receipt,
        txHash: err?.replacement?.hash || txResponse.hash,
      }
    }
    throw err
  }
}

function withTimeout(promise, timeoutMs, message = 'Request timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ])
}

async function fetchTokenInteractiveModelUrl(provider, tokenId) {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, EVOLVE_CONTRACT_ABI, provider)
    const modelUrl = await contract.tokenInteractiveModel(tokenId)
    return normalizeOnchainUrl(modelUrl || '')
  } catch {
    return ''
  }
}

async function fetchTokenImagePairFromSlots(provider, tokenId) {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, EVOLVE_CONTRACT_ABI, provider)
    const [originalResult, evolvedResult, evolvedCidResult, imageResult, evolvedFlagResult] = await Promise.allSettled([
      contract.tokenOriginalImage(tokenId),
      contract.tokenEvolvedImage(tokenId),
      contract.tokenEvolvedImageCid(tokenId),
      contract.tokenImage(tokenId),
      contract.tokenEvolved3D(tokenId),
    ])

    const originalImage = originalResult.status === 'fulfilled' ? normalizeOnchainImage(originalResult.value || '') : ''
    const evolvedImage = evolvedResult.status === 'fulfilled' ? normalizeOnchainImage(evolvedResult.value || '') : ''
    const evolvedCid = evolvedCidResult.status === 'fulfilled' ? String(evolvedCidResult.value || '').trim() : ''
    const evolvedCidImage = evolvedCid ? normalizeOnchainImage(`ipfs://${evolvedCid}`) : ''
    const tokenImage = imageResult.status === 'fulfilled' ? normalizeOnchainImage(imageResult.value || '') : ''
    const evolved = evolvedFlagResult.status === 'fulfilled' ? Boolean(evolvedFlagResult.value) : false

    return {
      image2d: originalImage || (evolved ? '' : tokenImage),
      image3d: evolvedImage || evolvedCidImage || (evolved ? tokenImage : ''),
    }
  } catch {
    return { image2d: '', image3d: '' }
  }
}

async function fetchTokenMetadata(provider, tokenId) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, EVOLVE_CONTRACT_ABI, provider)
  try {
    const rawJson = await contract.tokenMetadataJson(tokenId)
    if (typeof rawJson === 'string' && rawJson) {
      const richMeta = extractMetadataFromMetadataString(rawJson)
      const modelUrl = !richMeta.animationUrl ? await fetchTokenInteractiveModelUrl(provider, tokenId) : ''
      return {
        name: resolveMetadataName(richMeta, tokenId),
        description: richMeta.description || '',
        image: richMeta.image || '',
        image2d: richMeta.image2d || '',
        image3d: richMeta.image3d || '',
        animationUrl: richMeta.animationUrl || modelUrl,
        attributes: Array.isArray(richMeta.attributes) ? richMeta.attributes : [],
        evolved3D: Boolean(richMeta.evolved3D || richMeta.image3d),
        revealed: richMeta.revealed,
      }
    }
  } catch {
    // Fall through to slower compatibility reads.
  }

  const meta = await fetchSharedOnchainMetadataFromTokenURI(tokenId, provider)
  const [evolvedResult, revealedResult, attrsResult, modelResult] = await Promise.allSettled([
    contract.tokenEvolved3D(tokenId),
    contract.revealed(),
    contract.tokenAttributes(tokenId),
    contract.tokenInteractiveModel(tokenId),
  ])

  let image2d = normalizeOnchainImage(meta.image2d || meta.image_2d || '')
  let image3d = normalizeOnchainImage(meta.image3d || meta.image_3d || '')
  let revealed = revealedResult.status === 'fulfilled' ? Boolean(revealedResult.value) : null
  let attributes = Array.isArray(meta.attributes) ? meta.attributes : []

  if (revealed === false && attrsResult.status === 'fulfilled' && attrsResult.value) {
    attributes = parseAttributesJson(attrsResult.value)
  }

  return {
    name: resolveMetadataName(meta, tokenId),
    description: meta.description || '',
    image: meta.image || '',
    image2d,
    image3d,
    animationUrl: pickFirstUrl([
      extractAnimationOrModelUrlFromObject(meta),
      modelResult.status === 'fulfilled' ? modelResult.value : '',
    ]),
    attributes,
    evolved3D: evolvedResult.status === 'fulfilled' ? Boolean(evolvedResult.value) : metaHasEvolvedMarker(meta),
    revealed,
  }
}

function selectedStateLabel({ selectedNFT, selectedIsEvolved, selectedIsUnrevealed }) {
  if (!selectedNFT) return { label: 'No selection', tone: 'muted' }
  if (selectedIsEvolved) return { label: 'Already 3D', tone: 'success' }
  if (selectedIsUnrevealed) return { label: 'Unrevealed', tone: 'warn' }
  return { label: 'Ready', tone: 'live' }
}

function pickErrorMessage(err) {
  return (
    decodeContractError(err) ||
    err?.reason ||
    err?.shortMessage ||
    err?.info?.error?.message ||
    err?.error?.message ||
    err?.message ||
    'Evolve failed'
  )
}

function decodeContractError(err) {
  const candidates = [
    err?.data,
    err?.error?.data,
    err?.info?.error?.data,
    err?.info?.data,
    err?.receipt?.revertReason,
  ]

  for (const value of candidates) {
    if (typeof value !== 'string' || !value.startsWith('0x')) continue
    try {
      const parsed = contractInterface.parseError(value)
      if (parsed?.name) return parsed.name
    } catch {
      // Try next candidate.
    }
  }

  return ''
}

function isGenericRevertMessage(message) {
  const value = String(message || '').toLowerCase()
  return value.includes('require(false)') || value.includes('execution reverted') || value.includes('missing revert data')
}

function shouldUseFallbackGas(error) {
  const message = pickErrorMessage(error)
  return isGenericRevertMessage(message)
}

function shouldFallbackToLegacyCidEvolve(error) {
  const message = String(pickErrorMessage(error) || '').toLowerCase()
  if (!message) return false
  return message.includes('function selector was not recognized') ||
    message.includes('is not a function') ||
    message.includes('unknown function') ||
    isGenericRevertMessage(message)
}

function humanizeEvolveError(message) {
  const value = String(message || '').toLowerCase()
  if (!value) return 'Evolution failed. Please try again.'
  if (value.includes('user rejected')) return 'You rejected the transaction in your wallet.'
  if (value.includes('signature rejected')) return 'You rejected the signature request in your wallet.'
  if (value.includes('wallet mismatch')) return 'Wallet mismatch. Reconnect the intended wallet and try again.'
  if (value.includes('nottokenowner')) return 'You are not the owner of this token.'
  if (value.includes('not token owner')) return 'You are not the owner of this token.'
  if (value.includes('invalidtoken')) return 'Invalid token ID.'
  if (value.includes('invalid token')) return 'Invalid token ID.'
  if (value.includes('tokennotevolved')) return 'Token has not evolved yet.'
  if (value.includes('attributesrequired')) return 'Token traits are missing. Refresh metadata and retry.'
  if (value.includes('attributes required')) return 'Token traits are missing. Refresh metadata and retry.'
  if (value.includes('tokenunrevealed')) return 'Collection is not revealed yet.'
  if (value.includes('unrevealed')) return 'Token is not available for evolution yet.'
  if (value.includes('insufficientevolvefee')) return 'Insufficient evolve fee. Check current fee and try again.'
  if (value.includes('insufficient evolve fee')) return 'Insufficient evolve fee. Check current fee and try again.'
  if (value.includes('nativevaluenotacceptedfortokenfee')) return 'Token fee mode is active. Retry without sending ETH.'
  if (value.includes('evolvefeetransferfailed')) return 'Evolve fee transfer failed. Check USDC balance, allowance, and receiver.'
  if (value.includes('invalidevolvefeereceiver')) return 'Evolve fee receiver is invalid. Set a valid receiver in Admin.'
  if (value.includes('invalidevolveimageuri')) return 'Generated image URL is invalid. Retry evolution.'
  if (value.includes('upload origin not allowed') || value.includes('origin is not allowed')) return 'Upload origin is not allowed by the backend.'
  if (value.includes('upload payload too large') || value.includes('upload payload is too large')) return 'Upload payload is too large for the backend limit.'
  if (value.includes('upload rate limited') || value.includes('rate limit exceeded')) return 'Upload API is rate-limited. Wait a moment and retry.'
  if (value.includes('upload timed out') || value.includes('ipfs upload timed out')) return 'IPFS upload timed out. Retry in a moment.'
  if (value.includes('exceeded the quota usage')) return 'RPC quota exceeded. Retry shortly.'
  if (value.includes('rate limit')) return 'RPC endpoint is busy. Retry shortly.'
  if (value.includes('too many requests')) return 'RPC endpoint is busy. Retry shortly.'
  if (value.includes('insufficient funds')) return 'Insufficient wallet balance for gas fees.'
  if (value.includes('upload backend not configured')) return 'Upload backend is not configured.'
  if (value.includes('upload backend unreachable')) return 'Upload backend is unreachable.'
  if (value.includes('ipfs upload failed')) return 'IPFS upload failed. Check backend credentials and retry.'
  if (value.includes('confirmation timeout')) return 'Transaction submitted but confirmation timed out. Check explorer status.'
  if (isGenericRevertMessage(value)) return 'Transaction was rejected by contract checks.'
  return 'Evolution failed. Please try again.'
}

function isRpcQuotaLikeError(message) {
  const value = String(message || '').toLowerCase()
  return value.includes('exceeded the quota usage') ||
    value.includes('rate limit') ||
    value.includes('too many requests') ||
    value.includes('429')
}

function getStatusTone(status) {
  const text = String(status || '').toLowerCase()
  if (!text) return ''
  if (
    text.includes('error') ||
    text.includes('failed') ||
    text.includes('rejected') ||
    text.includes('not allowed') ||
    text.includes('too large') ||
    text.includes('timed out')
  ) return 'error'
  if (text.includes('evolved') || text.includes('connected') || text.includes('refreshed')) return 'success'
  if (
    text.includes('evolving') ||
    text.includes('loading') ||
    text.includes('pending')
  ) return 'pending'
  if (
    text.includes('select ') ||
    text.includes('connect ') ||
    text.includes('switch') ||
    text.includes('already ') ||
    text.includes('unrevealed') ||
    text.includes('disconnected') ||
    text.includes('install') ||
    text.includes('wallet') ||
    text.includes('unavailable')
  ) return 'warning'
  return 'info'
}

function ensureMessagePunctuation(message) {
  const value = String(message || '').trim()
  if (!value) return ''
  if (value.endsWith('...')) return value
  if (/[.!?]$/.test(value)) return value
  return `${value}.`
}

function formatEvolveStatusMessage(status) {
  const raw = String(status || '').trim()
  if (!raw) return ''
  const normalized = raw.toLowerCase()

  const exactMap = {
    'rpc unavailable': 'RPC is temporarily unavailable. Retrying in the background',
    unavailable: 'Evolution service is temporarily unavailable',
    disconnected: 'Wallet disconnected',
    'install wallet': 'Install MetaMask to continue',
    'connection failed': 'Wallet connection failed. Try again',
    'connect wallet': 'Connect your wallet to continue',
    'enter valid token id': 'Enter a valid token ID',
    'loading token': 'Loading token metadata',
    'wrong wallet': 'The selected token is owned by a different wallet',
    'switch network': `Switch to ${CHAIN_NAME} in your wallet`,
    'select nft': 'Select an NFT to continue',
    'already evolved': 'This NFT is already evolved',
    'collection not revealed': 'Collection is not revealed yet',
    submitted: 'Transaction submitted. Waiting for confirmation',
    pending: 'Transaction pending confirmation',
    evolved: 'NFT evolved successfully',
    'evolve failed': 'Evolution failed. Please try again',
    'nfts loaded': 'NFT gallery updated',
  }

  if (Object.prototype.hasOwnProperty.call(exactMap, normalized)) {
    return ensureMessagePunctuation(exactMap[normalized])
  }
  if (/^loaded\s+#\d+/i.test(raw)) {
    return ensureMessagePunctuation(`Token ${raw.replace(/^loaded\s+#/i, '#')} loaded`)
  }
  if (/^evolving:\s*/i.test(raw)) {
    return ensureMessagePunctuation(raw.replace(/^evolving:\s*/i, '').replace(/\s+/g, ' '))
  }

  return ensureMessagePunctuation(raw)
}

function getEvolveStatusHint(status) {
  const text = String(status || '').toLowerCase()
  if (!text) return ''
  if (text.includes('loading token')) return 'Fetching NFT metadata and ownership state.'
  if (text.includes('rendering 3d image') || text.includes('processing 3d asset')) return 'Rendering and upload can take a little while. Keep this page open.'
  if (text.includes('preparing transaction') || text.includes('waiting for confirmation') || text.includes('pending confirmation') || text.includes('pending')) return 'Transaction confirmation can take a few minutes depending on network conditions.'
  if (text.includes('wallet mismatch')) return 'Reconnect the wallet that owns this token, then try again.'
  if (text.includes('insufficient evolve fee')) return 'Current evolve fee is set on-chain. Ensure wallet has the required amount and approval.'
  if (text.includes('evolve fee transfer failed') || text.includes('invalid evolve fee receiver')) return 'Set a valid evolve fee receiver in Admin and retry.'
  if (text.includes('upload backend not configured')) return 'The IPFS API is missing PINATA_JWT. Add it to local or deployment environment variables.'
  if (text.includes('upload backend unreachable')) return 'The app could not reach /api/ipfs-upload. Run `npm run dev` so web + local API start together.'
  if (text.includes('upload origin not allowed')) return 'This domain is not allowed by the upload API. Add it to ALLOWED_ORIGINS or ALLOWED_ORIGIN_SUFFIXES.'
  if (text.includes('upload too large')) return 'Rendered image exceeded API upload size limit. Lower image size or increase IPFS_UPLOAD_MAX_BYTES.'
  if (text.includes('upload rate limited')) return 'Upload API rate limit hit. Wait a bit and retry.'
  if (text.includes('upload timed out')) return 'Upload to Pinata timed out. Retry shortly.'
  if (text.includes('ipfs upload failed')) return 'The upload service rejected the image. Check the API response or Pinata credentials.'
  return ''
}

function getRecentEvolveTimestamp(tokenId, meta) {
  if (Number.isFinite(Number(meta?.evolvedUpdatedAt)) && Number(meta.evolvedUpdatedAt) > 0) {
    return Number(meta.evolvedUpdatedAt)
  }
  return 0
}

function sortNewestMintedFirst(items) {
  return [...items].sort((a, b) => b.tokenId - a.tokenId)
}

function sortNewestActivityFirst(items, metaByToken) {
  return [...items].sort((a, b) => {
    const bUpdated = getRecentEvolveTimestamp(b.tokenId, metaByToken[b.tokenId])
    const aUpdated = getRecentEvolveTimestamp(a.tokenId, metaByToken[a.tokenId])
    if (bUpdated !== aUpdated) return bUpdated - aUpdated
    return b.tokenId - a.tokenId
  })
}

function hasCompleteCachedEvolvedSnapshot(cachedGallery, tokenIds) {
  if (!cachedGallery || !Array.isArray(tokenIds) || tokenIds.length === 0) return false
  if (cachedGallery.evolvedByTokenVerified !== true) return false
  const cachedIds = Array.isArray(cachedGallery.tokenIds) ? cachedGallery.tokenIds : []
  const cachedEvolved = cachedGallery.evolvedByToken || {}
  if (cachedIds.length !== tokenIds.length) return false

  const currentSet = new Set(tokenIds.map((id) => Number(id)))
  const cachedSet = new Set(cachedIds.map((id) => Number(id)))
  if (currentSet.size !== cachedSet.size) return false
  for (const id of currentSet) {
    if (!cachedSet.has(id)) return false
    if (!Object.prototype.hasOwnProperty.call(cachedEvolved, id)) return false
  }
  return true
}

function buildSeedEvolvedStateMap(tokenIds, metaByToken = {}, previousMap = {}, cachedMap = {}) {
  return Object.fromEntries(
    tokenIds.map((tokenId) => {
      if (Object.prototype.hasOwnProperty.call(previousMap, tokenId)) {
        return [tokenId, Boolean(previousMap[tokenId])]
      }
      if (Object.prototype.hasOwnProperty.call(cachedMap, tokenId)) {
        return [tokenId, Boolean(cachedMap[tokenId])]
      }
      return [tokenId, metaHasEvolvedMarker(metaByToken[tokenId])]
    })
  )
}

function buildEvolvedStateMapResult(tokenIds, results, metaByToken = {}, previousMap = {}) {
  const entries = []
  let hasFailures = false
  results.forEach((result, idx) => {
    const tokenId = tokenIds[idx]
    const fallbackValue = Object.prototype.hasOwnProperty.call(previousMap, tokenId)
      ? Boolean(previousMap[tokenId])
      : metaHasEvolvedMarker(metaByToken[tokenId])
    if (result.status !== 'fulfilled') {
      hasFailures = true
    }
    entries.push([
      tokenId,
      result.status === 'fulfilled' ? Boolean(result.value) : fallbackValue,
    ])
  })
  return {
    map: Object.fromEntries(entries),
    hasFailures,
  }
}

async function fetchOwnedEvolvedStateMap(
  contract,
  tokenIds,
  requestRef = null,
  requestId = null,
  metaByToken = {},
  previousMap = {}
) {
  const CHUNK = 24
  const results = []

  for (let i = 0; i < tokenIds.length; i += CHUNK) {
    if (requestRef?.current !== undefined && requestRef.current !== requestId) return null
    const batch = tokenIds.slice(i, i + CHUNK)
    const batchResults = await Promise.allSettled(batch.map((tokenId) => contract.tokenEvolved3D(tokenId)))
    results.push(...batchResults)
  }

  return buildEvolvedStateMapResult(tokenIds, results, metaByToken, previousMap)
}

function getEvolveGalleryCacheKey(address) {
  const normalized = String(address || '').trim().toLowerCase()
  if (!normalized) return ''
  const normalizedChain = String(CHAIN_ID_HEX || '').trim().toLowerCase()
  const normalizedContract = String(CONTRACT_ADDRESS || '').trim().toLowerCase()
  return `${EVOLVE_GALLERY_CACHE_PREFIX}:${normalizedChain}:${normalizedContract}:${normalized}`
}

function getGlobalProgressCacheKey() {
  const normalizedChain = String(CHAIN_ID_HEX || '').trim().toLowerCase()
  const normalizedContract = String(CONTRACT_ADDRESS || '').trim().toLowerCase()
  if (!normalizedChain || !normalizedContract) return ''
  return `${EVOLVE_GLOBAL_PROGRESS_CACHE_PREFIX}:${normalizedChain}:${normalizedContract}`
}

function clearGlobalProgressCache(options = {}) {
  if (typeof window === 'undefined') return
  try {
    const scopedKey = getGlobalProgressCacheKey()
    if (scopedKey) window.localStorage.removeItem(scopedKey)
    if (options?.includeLegacy === true) {
      window.localStorage.removeItem(EVOLVE_GLOBAL_PROGRESS_LEGACY_CACHE_KEY)
    }
  } catch {
    // Ignore cache clear failures.
  }
}

function readGlobalProgressCache() {
  if (typeof window === 'undefined') return null
  const cacheKey = getGlobalProgressCacheKey()
  if (!cacheKey) return null
  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const updatedAt = Number(parsed?.updatedAt || 0)
    const totalMinted = Number(parsed?.totalMinted || 0)
    const evolvedCount = Number(parsed?.evolvedCount || 0)
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null
    if (!Number.isFinite(totalMinted) || totalMinted < 0) return null
    if (!Number.isFinite(evolvedCount) || evolvedCount < 0) return null
    if ((Date.now() - updatedAt) > EVOLVE_GLOBAL_PROGRESS_CACHE_TTL_MS) return null
    return {
      updatedAt,
      totalMinted,
      evolvedCount,
    }
  } catch {
    return null
  }
}

function writeGlobalProgressCache(totalMinted, evolvedCount) {
  if (typeof window === 'undefined') return
  const cacheKey = getGlobalProgressCacheKey()
  if (!cacheKey) return
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({
      totalMinted: Math.max(0, Number(totalMinted) || 0),
      evolvedCount: Math.max(0, Number(evolvedCount) || 0),
      updatedAt: Date.now(),
    }))
  } catch {
    // Ignore cache persistence failures.
  }
}

function sanitizeCachedTokenIds(tokenIds) {
  if (!Array.isArray(tokenIds)) return []
  const unique = new Set()
  tokenIds.forEach((tokenId) => {
    const parsed = Number(tokenId)
    if (Number.isInteger(parsed) && parsed > 0) unique.add(parsed)
  })
  return Array.from(unique).sort((a, b) => b - a)
}

function readEvolveGalleryCache(address, balanceHint = null) {
  if (typeof window === 'undefined') return null
  const cacheKey = getEvolveGalleryCacheKey(address)
  if (!cacheKey) return null

  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const tokenIds = sanitizeCachedTokenIds(parsed?.tokenIds)
    const normalizedBalance = Number(balanceHint)
    if (Number.isFinite(normalizedBalance) && normalizedBalance >= 0 && tokenIds.length !== normalizedBalance) {
      return null
    }

    const evolvedByToken = {}
    const sourceMap = parsed?.evolvedByToken && typeof parsed.evolvedByToken === 'object'
      ? parsed.evolvedByToken
      : {}
    tokenIds.forEach((tokenId) => {
      if (Object.prototype.hasOwnProperty.call(sourceMap, tokenId)) {
        evolvedByToken[tokenId] = Boolean(sourceMap[tokenId])
      }
    })

    const evolvedUpdatedAtByToken = {}
    const timestampSourceMap = parsed?.evolvedUpdatedAtByToken && typeof parsed.evolvedUpdatedAtByToken === 'object'
      ? parsed.evolvedUpdatedAtByToken
      : {}
    tokenIds.forEach((tokenId) => {
      const timestampValue = Number(timestampSourceMap[tokenId])
      if (Number.isFinite(timestampValue) && timestampValue > 0) {
        evolvedUpdatedAtByToken[tokenId] = timestampValue
      }
    })

    return {
      tokenIds,
      evolvedByToken,
      evolvedUpdatedAtByToken,
      evolvedByTokenVerified: parsed?.evolvedByTokenVerified === true,
    }
  } catch {
    return null
  }
}

function writeEvolveGalleryCache(address, tokenIds, evolvedByToken, evolvedUpdatedAtByToken = {}, options = {}) {
  if (typeof window === 'undefined') return
  const cacheKey = getEvolveGalleryCacheKey(address)
  if (!cacheKey) return

  try {
    const normalizedTokenIds = sanitizeCachedTokenIds(tokenIds)
    const normalizedEvolvedByToken = {}
    const normalizedEvolvedUpdatedAtByToken = {}
    normalizedTokenIds.forEach((tokenId) => {
      if (Object.prototype.hasOwnProperty.call(evolvedByToken || {}, tokenId)) {
        normalizedEvolvedByToken[tokenId] = Boolean(evolvedByToken[tokenId])
      }
      const timestampValue = Number(evolvedUpdatedAtByToken?.[tokenId])
      if (Number.isFinite(timestampValue) && timestampValue > 0) {
        normalizedEvolvedUpdatedAtByToken[tokenId] = timestampValue
      }
    })

    const evolvedByTokenVerified = options?.evolvedByTokenVerified === true
    window.localStorage.setItem(cacheKey, JSON.stringify({
      tokenIds: normalizedTokenIds,
      evolvedByToken: normalizedEvolvedByToken,
      evolvedUpdatedAtByToken: normalizedEvolvedUpdatedAtByToken,
      evolvedByTokenVerified,
      updatedAt: Date.now(),
    }))
  } catch {
    // Ignore local cache persistence failures.
  }
}

async function fetchEvolvedCount(contract, supplyNum) {
  const totalSupply = Math.max(0, Number(supplyNum) || 0)

  if (totalSupply <= 0) return 0

  let count = 0
  const CHUNK = 32
  for (let start = 1; start <= totalSupply; start += CHUNK) {
    const batch = Array.from(
      { length: Math.min(CHUNK, totalSupply - start + 1) },
      (_, idx) => start + idx
    )
    const results = await Promise.allSettled(batch.map((tokenId) => contract.tokenEvolved3D(tokenId)))
    let firstBatchError = null
    results.forEach((result) => {
      if (result.status === 'fulfilled' && Boolean(result.value)) count += 1
      if (result.status !== 'fulfilled' && !firstBatchError) {
        firstBatchError = result.reason || new Error('Failed to read token evolve state')
      }
    })
    if (firstBatchError) throw firstBatchError
  }

  return count
}

function Evolve() {
  const provider = useMemo(() => getSharedReadProvider(), [])
  const lastAutoFetchKeyRef = useRef('')
  const metaByTokenRef = useRef({})
  const evolvedByTokenRef = useRef({})
  const evolvedUpdatedAtByTokenRef = useRef({})
  const myNFTsRef = useRef([])
  const contractFetchRequestRef = useRef(0)
  const globalProgressPromiseRef = useRef(null)
  const lastGlobalProgressFetchAtRef = useRef(0)
  const globalTotalMintedRef = useRef(0)
  const globalEvolvedCountRef = useRef(0)
  const lastSilentOwnedRefreshAtRef = useRef(0)
  const lastOwnedDiscoveryAtRef = useRef(0)
  const lastOwnedDiscoveryAddressRef = useRef('')
  const lastWalletUiAddressRef = useRef('')
  const tokenLookupRequestRef = useRef(0)
  const pendingReceiptPollIdRef = useRef(0)
  const evolvedByTokenVerifiedRef = useRef(false)
  const metaRetryDueByTokenRef = useRef({})
  const metaRetryTimerRef = useRef(null)
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(0)
  const [status, setStatus] = useState('')
  const [myNFTs, setMyNFTs] = useState([])
  const [myPage, setMyPage] = useState(1)
  const [evolvedPage, setEvolvedPage] = useState(1)
  const [activeTab, setActiveTab] = useState('my')
  const [selectedNFT, setSelectedNFT] = useState(null)
  const [tokenIdInput, setTokenIdInput] = useState('')
  const [resolvedLookupTokenId, setResolvedLookupTokenId] = useState(null)
  const [isFetchingTokenId, setIsFetchingTokenId] = useState(false)
  const [isEvolving, setIsEvolving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastTxHash, setLastTxHash] = useState('')
  const [metaByToken, setMetaByToken] = useState({})
  const [evolvedByToken, setEvolvedByToken] = useState({})
  const [evolvedUpdatedAtByToken, setEvolvedUpdatedAtByToken] = useState({})
  const [loadingByToken, setLoadingByToken] = useState({})
  const [errorByToken, setErrorByToken] = useState({})
  const [traitsModal, setTraitsModal] = useState(null)
  const [showRawMetadata, setShowRawMetadata] = useState(false)
  const [rawMetadata, setRawMetadata] = useState('')
  const [rawMetadataError, setRawMetadataError] = useState('')
  const [isLoadingRawMetadata, setIsLoadingRawMetadata] = useState(false)
  const [showTokenUri, setShowTokenUri] = useState(false)
  const [tokenUriValue, setTokenUriValue] = useState('')
  const [tokenUriMetadataText, setTokenUriMetadataText] = useState('')
  const [tokenUriImage2D, setTokenUriImage2D] = useState('')
  const [tokenUriImage3D, setTokenUriImage3D] = useState('')
  const [tokenUriAnimationUrl, setTokenUriAnimationUrl] = useState('')
  const [slotImage2D, setSlotImage2D] = useState('')
  const [slotImage3D, setSlotImage3D] = useState('')
  const [contractModelUrl, setContractModelUrl] = useState('')
  const [tokenUriError, setTokenUriError] = useState('')
  const [isLoadingTokenUri, setIsLoadingTokenUri] = useState(false)
  const [isModelViewerReady, setIsModelViewerReady] = useState(false)
  const [isLoadingNfts, setIsLoadingNfts] = useState(false)
  const [, setIsHydratingMeta] = useState(false)
  const [metaRetryTick, setMetaRetryTick] = useState(0)
  const [globalTotalMinted, setGlobalTotalMinted] = useState(0)
  const [globalEvolvedCount, setGlobalEvolvedCount] = useState(0)
  const [isLoadingGlobalProgress, setIsLoadingGlobalProgress] = useState(false)
  const [collectionRevealed, setCollectionRevealed] = useState(null)
  const [evolveFeeWei, setEvolveFeeWei] = useState(0n)
  const [evolveFeeEth, setEvolveFeeEth] = useState('0')
  const [evolveFeeToken, setEvolveFeeToken] = useState('')
  const [evolveFeeTokenAmount, setEvolveFeeTokenAmount] = useState(0n)
  const [isGallerySnapshotStale, setIsGallerySnapshotStale] = useState(false)
  const clearMetaRetryState = useCallback(() => {
    metaRetryDueByTokenRef.current = {}
    if (metaRetryTimerRef.current) {
      clearTimeout(metaRetryTimerRef.current)
      metaRetryTimerRef.current = null
    }
  }, [])
  const normalizedTokenQuery = String(tokenIdInput || '').trim()
  const hasTokenQuery = normalizedTokenQuery.length > 0
  const parsedTokenQuery = /^\d+$/.test(normalizedTokenQuery) ? Number(normalizedTokenQuery) : null
  const canClearLookup = Number.isInteger(resolvedLookupTokenId) && parsedTokenQuery === resolvedLookupTokenId

  const isEvolvedMeta = (meta) => {
    return metaHasEvolvedMarker(meta)
  }
  const isOwnedTokenEvolved = useCallback((tokenId) => {
    if (Object.prototype.hasOwnProperty.call(evolvedByToken, tokenId)) {
      return Boolean(evolvedByToken[tokenId])
    }
    return isEvolvedMeta(metaByToken[tokenId])
  }, [evolvedByToken, metaByToken])
  const selectedMeta = selectedNFT ? (metaByToken[selectedNFT.tokenId] || selectedNFT.meta) : null
  const selectedIsEvolved = Boolean(selectedNFT && isOwnedTokenEvolved(selectedNFT.tokenId))
  const selectedRevealed = typeof selectedMeta?.revealed === 'boolean' ? selectedMeta.revealed : collectionRevealed
  const selectedIsUnrevealed = Boolean(selectedNFT && selectedRevealed === false && !selectedIsEvolved)
  const activeModalMeta = traitsModal ? (metaByToken[traitsModal.tokenId] || traitsModal.meta) : null
  const activeModalTokenId = Number(traitsModal?.tokenId || 0)
  const activeModalIsEvolved = activeModalTokenId > 0 && isOwnedTokenEvolved(activeModalTokenId)
  const activeModalStrictImage2D = normalizeOnchainImage(
    tokenUriImage2D || activeModalMeta?.image2d || activeModalMeta?.image_2d || slotImage2D || ''
  )
  const activeModalStrictImage3D = normalizeOnchainImage(
    tokenUriImage3D || activeModalMeta?.image3d || activeModalMeta?.image_3d || slotImage3D || ''
  )
  const activeModalImage2D = activeModalStrictImage2D || resolve2DPreviewImage(activeModalMeta)
  const activeModalImage3D = activeModalStrictImage3D || resolve3DPreviewImage(activeModalMeta)
  const activeModalAnimationUrl = tokenUriAnimationUrl || normalizeOnchainUrl(activeModalMeta?.animationUrl || '') || contractModelUrl
  const activeModalOnchainToggleUrl = activeModalAnimationUrl
  const activeModalAnimationIsModelAsset = isModelAssetUrl(activeModalAnimationUrl)
  const evolveFeeTokenAddress = normalizeFeeTokenAddress(evolveFeeToken)
  const evolveFeeInToken = Boolean(evolveFeeTokenAddress && evolveFeeTokenAddress !== ethers.ZeroAddress)
  const evolveFeeDisplayLabel = useMemo(() => {
    if (evolveFeeInToken) {
      if (BigInt(evolveFeeTokenAmount || 0n) <= 0n) return 'Free'
      return `${formatTokenAmount(evolveFeeTokenAmount, 6)} USDC`
    }
    return Number(evolveFeeEth || '0') > 0 ? `${evolveFeeEth} ETH` : 'Free'
  }, [evolveFeeEth, evolveFeeInToken, evolveFeeTokenAmount])

  useEffect(() => {
    if (!traitsModal || activeModalTokenId <= 0) return

    const missingTraits = !Array.isArray(activeModalMeta?.attributes) || activeModalMeta.attributes.length === 0
    const missingAnimation = activeModalIsEvolved && !String(activeModalMeta?.animationUrl || activeModalMeta?.animation_url || '').trim()
    if (!missingTraits && !missingAnimation) return

    let cancelled = false
    setLoadingByToken((prev) => ({ ...prev, [activeModalTokenId]: true }))

    ;(async () => {
      try {
        const fullMeta = await withTimeout(
          fetchTokenMetadata(provider, activeModalTokenId),
          METADATA_FETCH_TIMEOUT_MS * 2,
          'Metadata timeout'
        )
        if (cancelled) return
        setMetaByToken((prev) => ({ ...prev, [activeModalTokenId]: fullMeta }))
        setErrorByToken((prev) => ({ ...prev, [activeModalTokenId]: '' }))
      } catch (err) {
        if (cancelled) return
        setErrorByToken((prev) => ({ ...prev, [activeModalTokenId]: humanizeEvolveError(pickErrorMessage(err)) }))
      } finally {
        if (!cancelled) {
          setLoadingByToken((prev) => ({ ...prev, [activeModalTokenId]: false }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [traitsModal, activeModalTokenId, activeModalMeta, activeModalIsEvolved, provider])

  useEffect(() => {
    metaByTokenRef.current = metaByToken
  }, [metaByToken])

  useEffect(() => {
    evolvedByTokenRef.current = evolvedByToken
  }, [evolvedByToken])

  useEffect(() => {
    evolvedUpdatedAtByTokenRef.current = evolvedUpdatedAtByToken
  }, [evolvedUpdatedAtByToken])

  useEffect(() => {
    myNFTsRef.current = myNFTs
  }, [myNFTs])

  useEffect(() => {
    globalTotalMintedRef.current = Math.max(0, Number(globalTotalMinted) || 0)
  }, [globalTotalMinted])

  useEffect(() => {
    globalEvolvedCountRef.current = Math.max(0, Number(globalEvolvedCount) || 0)
  }, [globalEvolvedCount])

  useEffect(() => (
    () => {
      clearMetaRetryState()
    }
  ), [clearMetaRetryState])

  useEffect(() => (
    () => {
      pendingReceiptPollIdRef.current += 1
    }
  ), [])

  useEffect(() => {
    if (!status) return
    const message = formatEvolveStatusMessage(status)
    if (!message) return
    appendAdminActivityLog({
      level: getStatusTone(message) || 'info',
      source: 'evolve',
      message,
      txHash: lastTxHash,
    }).catch(() => {})
  }, [status, lastTxHash])

  useEffect(() => {
    if (!account) return
    const normalizedAccount = String(account).toLowerCase()
    if (lastOwnedDiscoveryAddressRef.current !== normalizedAccount) return
    writeEvolveGalleryCache(
      account,
      myNFTs.map((nft) => nft.tokenId),
      evolvedByToken,
      evolvedUpdatedAtByToken,
      { evolvedByTokenVerified: evolvedByTokenVerifiedRef.current }
    )
  }, [account, myNFTs, evolvedByToken, evolvedUpdatedAtByToken])

  const fetchGlobalProgress = useCallback(async (supplyHint = null, options = {}) => {
    const force = Boolean(options?.force)
    const now = Date.now()
    const knownSupply = Math.max(0, Number(globalTotalMintedRef.current) || 0)
    const minIntervalMs = knownSupply > AUTO_PROGRESS_SCAN_MAX_SUPPLY
      ? GLOBAL_PROGRESS_HIGH_SUPPLY_MIN_INTERVAL_MS
      : GLOBAL_PROGRESS_MIN_INTERVAL_MS

    if (!force && globalProgressPromiseRef.current) {
      return globalProgressPromiseRef.current
    }

    if (!force && lastGlobalProgressFetchAtRef.current > 0) {
      const ageMs = now - lastGlobalProgressFetchAtRef.current
      if (ageMs < minIntervalMs) {
        return null
      }
    }

    const run = (async () => {
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, EVOLVE_CONTRACT_ABI, provider)
        const supplyNum = Number(supplyHint ?? (await contract.totalSupply()))
        setGlobalTotalMinted(supplyNum)
        if (supplyNum <= 0) {
          setGlobalEvolvedCount(0)
          writeGlobalProgressCache(0, 0)
          lastGlobalProgressFetchAtRef.current = Date.now()
          return
        }

        const cached = !force ? readGlobalProgressCache() : null
        if (cached && cached.totalMinted === supplyNum) {
          const clampedCached = Math.min(Math.max(0, cached.evolvedCount), supplyNum)
          setGlobalEvolvedCount(clampedCached)
          lastGlobalProgressFetchAtRef.current = Date.now()
          return
        }

        setIsLoadingGlobalProgress(true)
        const evolved = await fetchEvolvedCount(contract, supplyNum)
        const clamped = Math.min(evolved, supplyNum)
        setGlobalEvolvedCount(clamped)
        writeGlobalProgressCache(supplyNum, clamped)
        lastGlobalProgressFetchAtRef.current = Date.now()
      } catch {
        // Keep last known values during transient RPC failures.
      } finally {
        setIsLoadingGlobalProgress(false)
      }
    })()

    globalProgressPromiseRef.current = run
    try {
      return await run
    } finally {
      if (globalProgressPromiseRef.current === run) {
        globalProgressPromiseRef.current = null
      }
    }
  }, [provider])

  const fetchContractData = useCallback(async (address, options = {}) => {
    const silent = Boolean(options?.silent)
    const readProvider = options?.providerOverride || provider
    const requestId = contractFetchRequestRef.current + 1
    contractFetchRequestRef.current = requestId
    const isCurrentRequest = () => contractFetchRequestRef.current === requestId

    if (!silent) setIsLoadingNfts(true)
    if (!readProvider) {
      if (!silent && isCurrentRequest()) {
        setStatus('RPC Unavailable')
        setIsLoadingNfts(false)
      }
      return
    }

    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, EVOLVE_CONTRACT_ABI, readProvider)
      const evolveFeePromise = typeof contract.evolveFee === 'function'
        ? contract.evolveFee()
        : Promise.reject(new Error('Unsupported evolveFee getter'))
      const evolveFeeTokenPromise = typeof contract.evolveFeeToken === 'function'
        ? contract.evolveFeeToken()
        : Promise.reject(new Error('Unsupported evolveFeeToken getter'))
      const evolveFeeTokenAmountPromise = typeof contract.evolveFeeTokenAmount === 'function'
        ? contract.evolveFeeTokenAmount()
        : Promise.reject(new Error('Unsupported evolveFeeTokenAmount getter'))
      const [supplyResult, revealedResult, evolveFeeResult, evolveFeeTokenResult, evolveFeeTokenAmountResult] = await Promise.allSettled([
        contract.totalSupply(),
        contract.revealed(),
        evolveFeePromise,
        evolveFeeTokenPromise,
        evolveFeeTokenAmountPromise,
      ])
      if (!isCurrentRequest()) return
      if (revealedResult.status === 'fulfilled') {
        setCollectionRevealed(Boolean(revealedResult.value))
      }
      if (evolveFeeResult.status === 'fulfilled') {
        const feeWei = BigInt(evolveFeeResult.value || 0n)
        setEvolveFeeWei(feeWei)
        setEvolveFeeEth(ethers.formatEther(feeWei))
      } else {
        setEvolveFeeWei(0n)
        setEvolveFeeEth('0')
      }
      if (evolveFeeTokenResult.status === 'fulfilled') {
        setEvolveFeeToken(normalizeFeeTokenAddress(evolveFeeTokenResult.value))
      } else {
        setEvolveFeeToken('')
      }
      if (evolveFeeTokenAmountResult.status === 'fulfilled') {
        setEvolveFeeTokenAmount(BigInt(evolveFeeTokenAmountResult.value || 0n))
      } else {
        setEvolveFeeTokenAmount(0n)
      }
      if (supplyResult.status !== 'fulfilled') {
        throw supplyResult.reason || new Error('Failed to load total supply')
      }
      const supplyNum = Number(supplyResult.value)
      setGlobalTotalMinted(supplyNum)

      if (!address) {
        if (!isCurrentRequest()) return
        lastOwnedDiscoveryAddressRef.current = ''
        lastOwnedDiscoveryAtRef.current = 0
        clearMetaRetryState()
        evolvedByTokenVerifiedRef.current = false
        setIsGallerySnapshotStale(false)
        setCollectionRevealed(null)
        setMyNFTs([])
        setEvolvedByToken({})
        setEvolvedUpdatedAtByToken({})
        return
      }
      const [bal] = await Promise.all([contract.balanceOf(address)])
      if (!isCurrentRequest()) return
      const balanceNum = Number(bal)
      setBalance(balanceNum)
      if (balanceNum <= 0) {
        if (!isCurrentRequest()) return
        lastOwnedDiscoveryAddressRef.current = String(address).toLowerCase()
        lastOwnedDiscoveryAtRef.current = Date.now()
        clearMetaRetryState()
        evolvedByTokenVerifiedRef.current = false
        setIsGallerySnapshotStale(false)
        setMyNFTs([])
        setEvolvedByToken({})
        setEvolvedUpdatedAtByToken({})
        return
      }

      const cachedGallery = readEvolveGalleryCache(address, balanceNum)
      if (cachedGallery && isCurrentRequest()) {
        evolvedByTokenVerifiedRef.current = cachedGallery.evolvedByTokenVerified === true
        setMyNFTs(cachedGallery.tokenIds.map((tokenId) => ({ tokenId })))
        setEvolvedByToken(cachedGallery.evolvedByToken)
        setEvolvedUpdatedAtByToken(cachedGallery.evolvedUpdatedAtByToken || {})
      }

      const normalizedAddress = String(address).toLowerCase()

      let ownedTokenIds = null
      let discoveryFailed = false
      let discoveryError = null
      try {
        ownedTokenIds = await fetchOwnedTokenIds(
          contract,
          address,
          readProvider,
          contractFetchRequestRef,
          requestId
        )
      } catch (err) {
        discoveryError = err
        discoveryFailed = true
      }

      if (!Array.isArray(ownedTokenIds)) {
        discoveryFailed = true
      }

      if (discoveryFailed) {
        if (!isCurrentRequest()) return
        const discoveryMessage = pickErrorMessage(discoveryError)
        const hasSnapshotData = Boolean(
          (cachedGallery && (cachedGallery.tokenIds || []).length > 0) ||
          myNFTsRef.current.length > 0
        )
        setIsGallerySnapshotStale(hasSnapshotData)
        if (!silent && !cachedGallery && myNFTsRef.current.length === 0) {
          const readable = humanizeEvolveError(discoveryMessage)
          setStatus(readable === 'Evolve Failed' ? 'Unavailable' : readable)
        }
        if (!silent) setIsLoadingNfts(false)
        return
      }

      if (!isCurrentRequest()) return
      const normalizedOwnedTokenIds = ownedTokenIds.slice(0, balanceNum)
      const fallbackEvolvedMap = buildSeedEvolvedStateMap(
        normalizedOwnedTokenIds,
        metaByTokenRef.current,
        evolvedByTokenRef.current,
        cachedGallery?.evolvedByToken || {}
      )
      let nextEvolvedByToken = {}
      let evolvedLookupError = null
      let evolvedLookupHadPartialFailures = false
      let evolvedLookupDeferred = false
      const canTrustCachedEvolvedMap = hasCompleteCachedEvolvedSnapshot(cachedGallery, normalizedOwnedTokenIds)
      if (canTrustCachedEvolvedMap) {
        nextEvolvedByToken = Object.fromEntries(
          normalizedOwnedTokenIds.map((tokenId) => [tokenId, Boolean(cachedGallery.evolvedByToken[tokenId])])
        )
      } else if (normalizedOwnedTokenIds.length > EAGER_EVOLVED_LOOKUP_MAX_TOKENS) {
        nextEvolvedByToken = fallbackEvolvedMap
        evolvedLookupDeferred = true
      } else {
        try {
          const fetchedEvolvedByToken = await fetchOwnedEvolvedStateMap(
            contract,
            normalizedOwnedTokenIds,
            contractFetchRequestRef,
            requestId,
            metaByTokenRef.current,
            evolvedByTokenRef.current
          )
          if (fetchedEvolvedByToken === null) return
          nextEvolvedByToken = fetchedEvolvedByToken.map
          evolvedLookupHadPartialFailures = fetchedEvolvedByToken.hasFailures === true
        } catch (err) {
          evolvedLookupError = err
          nextEvolvedByToken = fallbackEvolvedMap
        }
      }

      if (!isCurrentRequest()) return
      setMyNFTs(normalizedOwnedTokenIds.map((tokenId) => ({ tokenId })))
      setEvolvedByToken((prev) => {
        const next = {}
        normalizedOwnedTokenIds.forEach((tokenId) => {
          if (Object.prototype.hasOwnProperty.call(nextEvolvedByToken, tokenId)) {
            next[tokenId] = Boolean(nextEvolvedByToken[tokenId])
          } else if (Object.prototype.hasOwnProperty.call(prev, tokenId)) {
            next[tokenId] = Boolean(prev[tokenId])
          } else if (metaHasEvolvedMarker(metaByTokenRef.current[tokenId])) {
            next[tokenId] = true
          }
        })
        return next
      })
      setIsGallerySnapshotStale(false)
      const evolvedMapVerified = canTrustCachedEvolvedMap || (
        !evolvedLookupDeferred
        && !evolvedLookupError
        && !evolvedLookupHadPartialFailures
      )
      evolvedByTokenVerifiedRef.current = evolvedMapVerified
      lastOwnedDiscoveryAddressRef.current = normalizedAddress
      lastOwnedDiscoveryAtRef.current = Date.now()
      writeEvolveGalleryCache(
        address,
        normalizedOwnedTokenIds,
        nextEvolvedByToken,
        evolvedUpdatedAtByTokenRef.current,
        { evolvedByTokenVerified: evolvedMapVerified }
      )
      if (!silent) {
        if (evolvedLookupDeferred) {
          setStatus('NFTs Loaded')
        } else if ((evolvedLookupError || evolvedLookupHadPartialFailures) && !isRpcQuotaLikeError(pickErrorMessage(evolvedLookupError))) {
          setStatus('NFTs Loaded')
        } else {
          setStatus('')
        }
      }
      if (evolvedLookupDeferred) {
        const deferredRequestId = requestId
        ;(async () => {
          let deferredMap = { ...fallbackEvolvedMap }
          let deferredHadFailures = false
          for (let i = 0; i < normalizedOwnedTokenIds.length; i += BACKGROUND_EVOLVED_LOOKUP_CHUNK) {
            if (!isCurrentRequest() || contractFetchRequestRef.current !== deferredRequestId) return
            if (getRpcCircuitState().isOpen) return
            const batch = normalizedOwnedTokenIds.slice(i, i + BACKGROUND_EVOLVED_LOOKUP_CHUNK)
            const batchResults = await Promise.allSettled(batch.map((tokenId) => contract.tokenEvolved3D(tokenId)))
            if (!isCurrentRequest() || contractFetchRequestRef.current !== deferredRequestId) return
            const batchMap = {}
            batchResults.forEach((result, idx) => {
              const tokenId = batch[idx]
              if (result.status === 'fulfilled') {
                batchMap[tokenId] = Boolean(result.value)
              } else {
                deferredHadFailures = true
              }
            })
            deferredMap = { ...deferredMap, ...batchMap }
            if (Object.keys(batchMap).length > 0) {
              setEvolvedByToken((prev) => ({ ...prev, ...batchMap }))
            }
            if (i + BACKGROUND_EVOLVED_LOOKUP_CHUNK < normalizedOwnedTokenIds.length) {
              await new Promise((resolve) => setTimeout(resolve, BACKGROUND_EVOLVED_LOOKUP_DELAY_MS))
            }
          }
          if (!isCurrentRequest() || contractFetchRequestRef.current !== deferredRequestId) return
          const deferredVerified = !deferredHadFailures
          evolvedByTokenVerifiedRef.current = deferredVerified
          writeEvolveGalleryCache(
            address,
            normalizedOwnedTokenIds,
            deferredMap,
            evolvedUpdatedAtByTokenRef.current,
            { evolvedByTokenVerified: deferredVerified }
          )
        })().catch(() => {})
      }
      if (!silent && isCurrentRequest()) setIsLoadingNfts(false)
      return
    } catch (err) {
      if (!isCurrentRequest()) return
      const message = pickErrorMessage(err)
      if (myNFTsRef.current.length === 0) {
        evolvedByTokenVerifiedRef.current = false
        setIsGallerySnapshotStale(false)
        setMyNFTs([])
        setEvolvedByToken({})
        setEvolvedUpdatedAtByToken({})
      } else {
        setIsGallerySnapshotStale(true)
      }
      if (!silent) {
        const readable = humanizeEvolveError(message)
        setStatus(readable === 'Evolve Failed' ? 'Unavailable' : readable)
      }
    } finally {
      if (!silent && isCurrentRequest()) {
        setIsLoadingNfts(false)
      }
    }
  }, [provider, clearMetaRetryState])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGlobalProgress(null, { force: false })
    }, 800)
    return () => clearTimeout(timer)
  }, [fetchGlobalProgress])

  useEffect(() => {
    if (!window.ethereum) return

    let cancelled = false

    ;(async () => {
      const selectedAddress = (
        typeof window.ethereum.selectedAddress === 'string' && window.ethereum.selectedAddress
          ? window.ethereum.selectedAddress
          : (Array.isArray(window.ethereum.accounts) ? window.ethereum.accounts[0] : null)
      )
      const address = selectedAddress || null
      if (!address || cancelled) return
      const normalizedAddress = String(address).toLowerCase()
      const shouldResetWalletState = lastWalletUiAddressRef.current !== normalizedAddress
      lastWalletUiAddressRef.current = normalizedAddress
      setAccount((prev) => (prev === address ? prev : address))
      if (shouldResetWalletState) {
        setBalance(0)
        setMyNFTs([])
        setMetaByToken({})
        setEvolvedByToken({})
        setEvolvedUpdatedAtByToken({})
        setLoadingByToken({})
        setErrorByToken({})
        setSelectedNFT(null)
        setTraitsModal(null)
        setTokenIdInput('')
        setResolvedLookupTokenId(null)
        setLastTxHash('')
        setIsGallerySnapshotStale(false)
      }
      setStatus('')
      fetchContractData(address, { silent: false })
    })()

    return () => {
      cancelled = true
    }
  }, [fetchContractData])

  useEffect(() => {
    if (!window.ethereum) return undefined

    const handleAccountsChanged = (accounts) => {
      const address = accounts?.[0] || null
      pendingReceiptPollIdRef.current += 1
      tokenLookupRequestRef.current += 1
      clearMetaRetryState()
      evolvedByTokenVerifiedRef.current = false
      setIsEvolving(false)
      setLastTxHash('')
      setSelectedNFT(null)
      setTokenIdInput('')
      setResolvedLookupTokenId(null)
        if (!address) {
          lastOwnedDiscoveryAddressRef.current = ''
          lastOwnedDiscoveryAtRef.current = 0
          lastWalletUiAddressRef.current = ''
          evolvedByTokenVerifiedRef.current = false
          setAccount(null)
          setBalance(0)
          setIsGallerySnapshotStale(false)
          setCollectionRevealed(null)
          setMyNFTs([])
          setMetaByToken({})
          setEvolvedByToken({})
          setEvolvedUpdatedAtByToken({})
          setLoadingByToken({})
          setErrorByToken({})
          setStatus('Disconnected')
        return
      }
      lastWalletUiAddressRef.current = String(address).toLowerCase()
      setAccount(address)
      setIsGallerySnapshotStale(false)
      setBalance(0)
      setMyNFTs([])
      setMetaByToken({})
      setEvolvedByToken({})
      setEvolvedUpdatedAtByToken({})
      setLoadingByToken({})
      setErrorByToken({})
      setSelectedNFT(null)
      setTraitsModal(null)
      setStatus('')
      fetchContractData(address)
    }

    const handleChainChanged = () => {
      pendingReceiptPollIdRef.current += 1
      setIsEvolving(false)
      if (account) {
        fetchContractData(account, { silent: true })
      }
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)
    window.ethereum.on?.('chainChanged', handleChainChanged)

    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [account, fetchContractData, clearMetaRetryState])

  useEffect(() => {
    if (!account) return
    const lower = String(account).toLowerCase()

    const refreshOwned = () => {
      const now = Date.now()
      if ((now - lastSilentOwnedRefreshAtRef.current) < SILENT_OWNED_REFRESH_MIN_INTERVAL_MS) return
      lastSilentOwnedRefreshAtRef.current = now
      fetchContractData(account, { silent: true })
    }
    const onFocus = () => refreshOwned()
    const onCustom = (e) => {
      const evAcc = String(e?.detail?.account || '').toLowerCase()
      if (!evAcc || evAcc === lower) refreshOwned()
    }
    const onStorage = (e) => {
      if (e.key !== 'penguin:nft-updated' || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue)
        const evAcc = String(parsed?.account || '').toLowerCase()
        if (!evAcc || evAcc === lower) refreshOwned()
      } catch {
        // Ignore malformed broadcast payloads.
      }
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('penguin:nft-updated', onCustom)
    window.addEventListener('storage', onStorage)
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (getRpcCircuitState().isOpen) return
      refreshOwned()
    }, 120000)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('penguin:nft-updated', onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [account, fetchContractData])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleContractUpdated = () => {
      clearOnchainMetadataCache()
      clearGlobalProgressCache({ includeLegacy: true })
      clearMetaRetryState()
      lastGlobalProgressFetchAtRef.current = 0
      globalTotalMintedRef.current = 0
      globalEvolvedCountRef.current = 0
      setGlobalTotalMinted(0)
      setGlobalEvolvedCount(0)
      setMetaByToken({})
      setLoadingByToken({})
      setErrorByToken({})
      setRefreshKey((prev) => prev + 1)

      const targetAccount = account || null
      fetchContractData(targetAccount, { silent: true, providerOverride: provider })
    }

    const handleStorage = (event) => {
      if (event.key !== 'penguin:contract-updated' || !event.newValue) return
      handleContractUpdated()
    }

    window.addEventListener('penguin:contract-updated', handleContractUpdated)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('penguin:contract-updated', handleContractUpdated)
      window.removeEventListener('storage', handleStorage)
    }
  }, [account, fetchContractData, clearMetaRetryState, provider])

  const connect = async () => {
    if (!window.ethereum) {
      setStatus('Install Wallet')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const address = accounts?.[0]
      if (!address) throw new Error('No account selected')
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return
      pendingReceiptPollIdRef.current += 1
      lastWalletUiAddressRef.current = String(address).toLowerCase()
      setAccount(address)
      setIsGallerySnapshotStale(false)
      setIsEvolving(false)
      setBalance(0)
      setMyNFTs([])
      setMetaByToken({})
      setEvolvedByToken({})
      setEvolvedUpdatedAtByToken({})
      setLoadingByToken({})
      setErrorByToken({})
      setSelectedNFT(null)
      setTraitsModal(null)
      setTokenIdInput('')
      setResolvedLookupTokenId(null)
      setLastTxHash('')
      setStatus('')
      fetchContractData(address)
    } catch {
      setStatus('Connection Failed')
    }
  }

  const fetchTokenById = useCallback(async () => {
    const requestId = tokenLookupRequestRef.current + 1
    tokenLookupRequestRef.current = requestId
    const isCurrentLookup = () => tokenLookupRequestRef.current === requestId

    if (!account) {
      setStatus('Connect Wallet')
      return
    }

      const tokenId = Number(tokenIdInput)
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      setStatus('Enter Valid Token ID')
      return
    }

    setIsFetchingTokenId(true)
    setLastTxHash('')
    setStatus('Loading Token')

    try {
      const cachedMeta = metaByToken[tokenId]
      const cachedOwned = myNFTs.some((nft) => nft.tokenId === tokenId)
      const hasCachedEvolved = Object.prototype.hasOwnProperty.call(evolvedByToken, tokenId)

      if (cachedOwned && cachedMeta && hasCachedEvolved) {
        if (!isCurrentLookup()) return
        const cachedEvolved = Boolean(evolvedByToken[tokenId])
        setSelectedNFT({ tokenId, meta: cachedMeta })
        setActiveTab(cachedEvolved ? 'evolved' : 'my')
        setResolvedLookupTokenId(tokenId)
        setStatus(`Loaded #${tokenId}`)
        return
      }

      const tokenLookupProvider = provider
      if (!tokenLookupProvider) throw new Error('RPC unavailable')
      const contract = new ethers.Contract(CONTRACT_ADDRESS, EVOLVE_CONTRACT_ABI, tokenLookupProvider)
      const owner = String(await contract.ownerOf(tokenId)).toLowerCase()
      if (!isCurrentLookup()) return
      if (owner !== String(account).toLowerCase()) {
        setStatus('Wrong Wallet')
        return
      }

      setLoadingByToken((prev) => ({ ...prev, [tokenId]: true }))
      setErrorByToken((prev) => ({ ...prev, [tokenId]: '' }))

      const [meta, evolved] = await Promise.all([
        cachedMeta ? Promise.resolve(cachedMeta) : fetchTokenMetadata(tokenLookupProvider, tokenId),
        hasCachedEvolved ? Promise.resolve(Boolean(evolvedByToken[tokenId])) : contract.tokenEvolved3D(tokenId),
      ])
      if (!isCurrentLookup()) return

      setMetaByToken((prev) => ({ ...prev, [tokenId]: meta }))
      setEvolvedByToken((prev) => ({ ...prev, [tokenId]: evolved }))
      setLoadingByToken((prev) => ({ ...prev, [tokenId]: false }))
      setMyNFTs((prev) => (
        prev.some((nft) => nft.tokenId === tokenId)
          ? prev
          : sortNewestMintedFirst([...prev, { tokenId }])
      ))

      setSelectedNFT({ tokenId, meta })
      setActiveTab(evolved ? 'evolved' : 'my')
      setResolvedLookupTokenId(tokenId)
      setStatus(`Loaded #${tokenId}`)
    } catch (err) {
      if (!isCurrentLookup()) return
      const msg = pickErrorMessage(err)
      setResolvedLookupTokenId(null)
      setLoadingByToken((prev) => ({ ...prev, [tokenId]: false }))
      setErrorByToken((prev) => ({ ...prev, [tokenId]: humanizeEvolveError(msg) }))
      setStatus(humanizeEvolveError(msg))
    } finally {
      if (isCurrentLookup()) {
        setIsFetchingTokenId(false)
      }
    }
  }, [account, tokenIdInput, metaByToken, myNFTs, evolvedByToken, provider])

  useEffect(() => {
    if (!account || activeTab === 'evolved' || isFetchingTokenId || isEvolving) return
    const normalized = String(tokenIdInput || '').trim()
    if (!normalized) {
      lastAutoFetchKeyRef.current = ''
      return
    }
    if (!/^\d+$/.test(normalized)) return

    const fetchKey = `${String(account).toLowerCase()}:${normalized}`
    if (lastAutoFetchKeyRef.current === fetchKey) return

    const timer = setTimeout(() => {
      lastAutoFetchKeyRef.current = fetchKey
      fetchTokenById()
    }, 350)

    return () => clearTimeout(timer)
  }, [account, activeTab, tokenIdInput, isFetchingTokenId, isEvolving, fetchTokenById])

  const disconnectWallet = async () => {
    pendingReceiptPollIdRef.current += 1
    tokenLookupRequestRef.current += 1
    clearMetaRetryState()
    lastOwnedDiscoveryAddressRef.current = ''
    lastOwnedDiscoveryAtRef.current = 0
    lastWalletUiAddressRef.current = ''
    evolvedByTokenVerifiedRef.current = false
    setAccount(null)
    setBalance(0)
    setIsGallerySnapshotStale(false)
    setCollectionRevealed(null)
    setMyNFTs([])
    setMyPage(1)
    setEvolvedPage(1)
    setActiveTab('my')
    setSelectedNFT(null)
    setIsEvolving(false)
    setLastTxHash('')
    setResolvedLookupTokenId(null)
    setMetaByToken({})
    setEvolvedByToken({})
    setEvolvedUpdatedAtByToken({})
    setLoadingByToken({})
    setErrorByToken({})
    setStatus('Disconnected')
  }

  const ensureConfiguredEthereumNetwork = async () => {
    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (currentChainId === CHAIN_ID_HEX) return true

      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] })
      return true
    } catch {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: CHAIN_ID_HEX,
            chainName: CHAIN_NAME,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [ETH_SEPOLIA_RPC],
            blockExplorerUrls: [BLOCK_EXPLORER_URL],
          }],
        })
        return true
      } catch {
        setStatus('Switch Network')
        return false
      }
    }
  }

  const evolveSelected = () => {
    if (!account) {
      setStatus('Connect Wallet')
      return
    }
    if (!selectedNFT) {
      setStatus('Select NFT')
      return
    }
    if (!selectedMeta?.attributes?.length) {
      setStatus('Select NFT')
      return
    }
    if (selectedIsEvolved) {
      setStatus('Already Evolved')
      return
    }
    if (selectedIsUnrevealed) {
      setStatus('Collection Not Revealed')
      return
    }
    pendingReceiptPollIdRef.current += 1
    ;(async () => {
      let keepPendingLock = false
      try {
        const switched = await ensureConfiguredEthereumNetwork()
        if (!switched) return
        setIsEvolving(true)
        setLastTxHash('')
        setStatus('Evolving: Preparing 3D render')

        const modelTraits = traitsFromAttributes(selectedMeta.attributes)
        const currentAttributes = Array.isArray(selectedMeta.attributes) ? selectedMeta.attributes : []
        const updatedAttributes = currentAttributes.some(
          (a) => a?.trait_type === 'Evolution' && String(a.value).toLowerCase().includes('evolved')
        )
          ? currentAttributes
          : [...currentAttributes, { trait_type: 'Evolution', value: 'Evolved 3D' }]

        const browserProvider = new ethers.BrowserProvider(window.ethereum)
        const signer = await browserProvider.getSigner()
        const signerAddress = String(await signer.getAddress()).toLowerCase()
        if (signerAddress !== String(account).toLowerCase()) {
          throw new Error(`Wallet mismatch. Connected ${account}, signer ${await signer.getAddress()}`)
        }
        const contract = new ethers.Contract(CONTRACT_ADDRESS, EVOLVE_CONTRACT_ABI, signer)
        const evolveWriteContract = new ethers.Contract(CONTRACT_ADDRESS, EVOLVE_PAYABLE_TX_ABI, signer)
        const network = await browserProvider.getNetwork()
        if (`0x${network.chainId.toString(16)}`.toLowerCase() !== CHAIN_ID_HEX.toLowerCase()) {
          throw new Error(`Wrong network. Switch to ${CHAIN_NAME}.`)
        }
        const tokenId = selectedNFT.tokenId
        let tx
        const effectiveAttributes = updatedAttributes
        let requiredEvolveFee = BigInt(evolveFeeWei || 0n)
        let requiredEvolveFeeToken = normalizeFeeTokenAddress(evolveFeeToken)
        let requiredEvolveFeeTokenAmount = BigInt(evolveFeeTokenAmount || 0n)

        const onchainOwner = String(await contract.ownerOf(tokenId)).toLowerCase()
        if (onchainOwner !== signerAddress) {
          throw new Error('Not token owner')
        }
        const onchainEvolved = Boolean(await contract.tokenEvolved3D(tokenId))
        if (onchainEvolved) {
          throw new Error('Already evolved')
        }

        try {
          const [onchainFee, onchainFeeToken, onchainFeeTokenAmount] = await Promise.all([
            contract.evolveFee(),
            typeof contract.evolveFeeToken === 'function' ? contract.evolveFeeToken() : ethers.ZeroAddress,
            typeof contract.evolveFeeTokenAmount === 'function' ? contract.evolveFeeTokenAmount() : 0n,
          ])
          requiredEvolveFee = BigInt(onchainFee || 0n)
          requiredEvolveFeeToken = normalizeFeeTokenAddress(onchainFeeToken)
          requiredEvolveFeeTokenAmount = BigInt(onchainFeeTokenAmount || 0n)

          if (requiredEvolveFee !== BigInt(evolveFeeWei || 0n)) {
            setEvolveFeeWei(requiredEvolveFee)
            setEvolveFeeEth(ethers.formatEther(requiredEvolveFee))
          }
          if (requiredEvolveFeeToken !== normalizeFeeTokenAddress(evolveFeeToken)) {
            setEvolveFeeToken(requiredEvolveFeeToken)
          }
          if (requiredEvolveFeeTokenAmount !== BigInt(evolveFeeTokenAmount || 0n)) {
            setEvolveFeeTokenAmount(requiredEvolveFeeTokenAmount)
          }
        } catch {
          // Keep the last known fee if fee read fails transiently.
        }

        const tokenFeeMode = Boolean(
          requiredEvolveFeeToken &&
          requiredEvolveFeeToken !== ethers.ZeroAddress
        )
        const txOverrides = tokenFeeMode ? {} : { value: requiredEvolveFee }

        if (tokenFeeMode && requiredEvolveFeeTokenAmount > 0n) {
          const feeToken = new ethers.Contract(requiredEvolveFeeToken, ERC20_FEE_ABI, signer)
          const currentAllowance = BigInt(await feeToken.allowance(signerAddress, CONTRACT_ADDRESS))
          if (currentAllowance < requiredEvolveFeeTokenAmount) {
            setStatus('Evolving: Approving USDC fee')
            const approveTx = await feeToken.approve(CONTRACT_ADDRESS, requiredEvolveFeeTokenAmount)
            setLastTxHash(approveTx.hash)
            setStatus('Evolving: Confirming USDC approval')
            await approveTx.wait()
          }
        }

        setStatus('Evolving: Checking contract')
        const preflightImageUri = `ipfs://evolve-preflight/${tokenId}`
        await evolveWriteContract.evolveTo3DImageOnly.staticCall(tokenId, preflightImageUri, txOverrides)

        setStatus('Evolving: Rendering 3D image')
        const snapshot = render3DSnapshot(modelTraits, {
          width: EVOLVED_IMAGE_SIZE,
          height: EVOLVED_IMAGE_SIZE,
          format: 'image/png',
          quality: 1,
          fast: false,
          highQuality: true,
        })
        if (!snapshot) throw new Error('Failed to render 3D snapshot')
        if (!snapshot.startsWith('data:image/png;base64,')) {
          throw new Error('Snapshot is not PNG base64')
        }

        const uploadTimestamp = Date.now()
        setStatus('Evolving: Processing 3D asset')
        const imageUpload = await uploadDataUrlToIPFS(snapshot, {
          extension: 'png',
          fileName: `ppenguin-evolved-${selectedNFT.tokenId}-${uploadTimestamp}.png`,
          keyvalues: {
            tokenId: String(selectedNFT.tokenId),
            stage: 'evolved-3d-image',
          },
        })
        if (!imageUpload?.url) {
          throw new Error('IPFS upload failed. Check the upload backend and try again.')
        }

        const evolvedImageCid = typeof imageUpload?.cid === 'string' ? imageUpload.cid.trim() : ''
        const evolvedImageUrl = evolvedImageCid
          ? `ipfs://${evolvedImageCid}`
          : imageUpload.url
        setStatus('Evolving: Preparing transaction')

        try {
          const submitLegacyImageOnly = async () => {
            let gasLimit
            try {
              const gasEstimate = await evolveWriteContract.evolveTo3DImageOnly.estimateGas(tokenId, evolvedImageUrl, txOverrides)
              gasLimit = (gasEstimate * 120n) / 100n
            } catch (estimateErr) {
              if (!shouldUseFallbackGas(estimateErr)) throw estimateErr
              gasLimit = EVOLVE_IMAGE_ONLY_GAS_LIMIT
            }

            return evolveWriteContract.evolveTo3DImageOnly(tokenId, evolvedImageUrl, { ...txOverrides, gasLimit })
          }

          if (evolvedImageCid) {
            try {
              let gasLimit
              try {
                const gasEstimate = await evolveWriteContract.evolveTo3DImageOnlyWithCid.estimateGas(tokenId, evolvedImageCid, txOverrides)
                gasLimit = (gasEstimate * 120n) / 100n
              } catch (estimateErr) {
                if (!shouldUseFallbackGas(estimateErr)) throw estimateErr
                gasLimit = EVOLVE_IMAGE_ONLY_GAS_LIMIT
              }

              tx = await evolveWriteContract.evolveTo3DImageOnlyWithCid(tokenId, evolvedImageCid, { ...txOverrides, gasLimit })
            } catch (cidSendErr) {
              if (!shouldFallbackToLegacyCidEvolve(cidSendErr)) throw cidSendErr
              tx = await submitLegacyImageOnly()
            }
          } else {
            tx = await submitLegacyImageOnly()
          }
        } catch (imageOnlySendErr) {
          throw new Error(pickErrorMessage(imageOnlySendErr) || 'Image-only evolve could not be submitted')
        }

        const afterConfirmed = async (confirmedTxHash = tx.hash) => {
          const confirmedAt = Date.now()
          const wasEvolvedBefore = Boolean(
            evolvedByTokenRef.current[tokenId]
            || metaHasEvolvedMarker(metaByTokenRef.current[tokenId])
          )
          setEvolvedByToken((prev) => ({ ...prev, [tokenId]: true }))
          setEvolvedUpdatedAtByToken((prev) => ({ ...prev, [tokenId]: confirmedAt }))
          setSelectedNFT((prev) =>
            prev
              ? {
                  ...prev,
                  meta: {
                    ...prev.meta,
                    image: evolvedImageUrl,
                    image3d: evolvedImageUrl,
                    attributes: effectiveAttributes,
                    evolved3D: true,
                    evolvedUpdatedAt: confirmedAt,
                  },
                }
              : prev
          )
          setMetaByToken((prev) => ({
            ...prev,
            [tokenId]: {
              ...(prev[tokenId] || {}),
              image: evolvedImageUrl,
              image3d: evolvedImageUrl,
              attributes: effectiveAttributes,
              evolved3D: true,
              evolvedUpdatedAt: confirmedAt,
            },
          }))
          const knownSupply = Math.max(0, Number(globalTotalMintedRef.current) || 0)
          const knownEvolved = Math.max(0, Number(globalEvolvedCountRef.current) || 0)
          const optimisticEvolved = wasEvolvedBefore
            ? knownEvolved
            : (knownSupply > 0 ? Math.min(knownEvolved + 1, knownSupply) : knownEvolved + 1)
          const optimisticSupply = Math.max(knownSupply, optimisticEvolved)
          if (!wasEvolvedBefore) {
            if (optimisticSupply !== knownSupply) {
              setGlobalTotalMinted(optimisticSupply)
            }
            setGlobalEvolvedCount(optimisticEvolved)
            writeGlobalProgressCache(optimisticSupply, optimisticEvolved)
          }
          setStatus('Evolved')
          appendAdminActivityLog({
            level: 'success',
            source: 'evolve',
            message: `NFT #${tokenId} evolved to 3D`,
            txHash: confirmedTxHash,
          }).catch(() => {})
          setActiveTab('evolved')
          setEvolvedPage(1)
          setRefreshKey((k) => k + 1)
          ;(async () => {
            try {
              const refreshedMeta = await fetchTokenMetadata(provider, tokenId)
              setMetaByToken((prev) => ({
                ...prev,
                [tokenId]: {
                  ...refreshedMeta,
                  evolvedUpdatedAt: Number(evolvedUpdatedAtByTokenRef.current[tokenId] || confirmedAt),
                },
              }))
              setEvolvedByToken((prev) => ({ ...prev, [tokenId]: true }))
              setSelectedNFT((prevSel) =>
                prevSel && prevSel.tokenId === tokenId
                  ? {
                      ...prevSel,
                      meta: {
                        ...refreshedMeta,
                        evolvedUpdatedAt: Number(evolvedUpdatedAtByTokenRef.current[tokenId] || confirmedAt),
                      },
                    }
                  : prevSel
              )
            } catch {
              // Keep the optimistic evolved preview if metadata re-read fails.
            }
            const shouldForceProgressRefresh = knownSupply > 0 && knownSupply <= AUTO_PROGRESS_SCAN_MAX_SUPPLY
            if (knownSupply <= 0) {
              lastGlobalProgressFetchAtRef.current = 0
            }
            fetchGlobalProgress(null, { force: shouldForceProgressRefresh })
          })()
        }

        setLastTxHash(tx.hash)
        setStatus('Submitted')
        try {
          const confirmation = await waitForConfirmationWithTimeout(tx, 120000)
          if (!confirmation?.receipt || confirmation.receipt.status !== 1) throw new Error('Evolve transaction reverted')
          if (confirmation.txHash && confirmation.txHash !== tx.hash) {
            setLastTxHash(confirmation.txHash)
          }
          await afterConfirmed(confirmation.txHash || tx.hash)
        } catch (confirmErr) {
          const msg = String(confirmErr?.message || '')
          if (msg.toLowerCase().includes('timeout')) {
            keepPendingLock = true
            setStatus('Pending')
            const pendingPollId = pendingReceiptPollIdRef.current + 1
            pendingReceiptPollIdRef.current = pendingPollId
            ;(async () => {
              for (let i = 0; i < 36; i++) {
                if (pendingReceiptPollIdRef.current !== pendingPollId) return
                await new Promise((resolve) => setTimeout(resolve, 10000))
                if (pendingReceiptPollIdRef.current !== pendingPollId) return
                let receipt = null
                try {
                  receipt = await browserProvider.getTransactionReceipt(tx.hash)
                } catch {
                  continue
                }
                if (!receipt) continue
                if (receipt.status === 1) {
                  if (pendingReceiptPollIdRef.current !== pendingPollId) return
                  await afterConfirmed()
                  if (pendingReceiptPollIdRef.current !== pendingPollId) return
                  setIsEvolving(false)
                  return
                }
                if (pendingReceiptPollIdRef.current !== pendingPollId) return
                setStatus('Evolve Failed')
                setIsEvolving(false)
                return
              }
              if (pendingReceiptPollIdRef.current !== pendingPollId) return
              setStatus('Pending')
              setIsEvolving(false)
            })()
            return
          }
          throw confirmErr
        }
        } catch (err) {
          const msg = pickErrorMessage(err)
          setStatus(humanizeEvolveError(msg))
      } finally {
        if (!keepPendingLock) setIsEvolving(false)
      }
    })()
  }

  const evolvedNFTs = useMemo(
    () => sortNewestActivityFirst(
      myNFTs.filter((nft) => isOwnedTokenEvolved(nft.tokenId)),
      Object.fromEntries(
        myNFTs.map((nft) => [
          nft.tokenId,
          {
            ...(metaByToken[nft.tokenId] || {}),
            evolvedUpdatedAt: Number(evolvedUpdatedAtByToken[nft.tokenId] || metaByToken[nft.tokenId]?.evolvedUpdatedAt || 0),
          },
        ])
      )
    ),
    [myNFTs, metaByToken, evolvedUpdatedAtByToken, isOwnedTokenEvolved]
  )
  const twoDNFTs = useMemo(
    () => sortNewestMintedFirst(myNFTs.filter((nft) => !isOwnedTokenEvolved(nft.tokenId))),
    [myNFTs, isOwnedTokenEvolved]
  )
  const filteredEvolvedNFTs = parsedTokenQuery
    ? evolvedNFTs.filter((nft) => nft.tokenId === parsedTokenQuery)
    : evolvedNFTs
  const filteredTwoDNFTs = parsedTokenQuery
    ? twoDNFTs.filter((nft) => nft.tokenId === parsedTokenQuery)
    : twoDNFTs
  const shownNFTs = activeTab === 'evolved' ? filteredEvolvedNFTs : filteredTwoDNFTs
  const page = activeTab === 'evolved' ? evolvedPage : myPage
  const setPage = activeTab === 'evolved' ? setEvolvedPage : setMyPage
  const ITEMS_PER_PAGE = 10
  const visiblePageNFTs = useMemo(
    () => shownNFTs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [shownNFTs, page]
  )
  const remainingToEvolve = Math.max(globalTotalMinted - globalEvolvedCount, 0)
  const evolveProgress = globalTotalMinted > 0 ? (globalEvolvedCount / globalTotalMinted) * 100 : 0
  const hydrateTokenIdsKey = visiblePageNFTs.map((n) => n.tokenId).join(',')
  const visibleTokenIds = useMemo(
    () => (
      hydrateTokenIdsKey
        ? hydrateTokenIdsKey
          .split(',')
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
        : []
    ),
    [hydrateTokenIdsKey]
  )
  const selectedState = selectedStateLabel({ selectedNFT, selectedIsEvolved, selectedIsUnrevealed })
  const selectedTraitsCount = selectedMeta?.attributes?.length || 0
  const displayTabTitle = activeTab === 'evolved' ? 'My 3D NFTs' : 'My 2D NFTs'
  const displayTabHint = activeTab === 'evolved' ? 'Open traits and review evolved penguins.' : 'Select a 2D penguin and evolve it to 3D.'
  const statusMessage = useMemo(() => formatEvolveStatusMessage(status), [status])
  const statusTone = getStatusTone(statusMessage)
  const statusHint = getEvolveStatusHint(statusMessage)
  const evolveSupplyTone = isLoadingGlobalProgress ? 'loading' : remainingToEvolve === 0 ? 'complete' : 'open'
  const selectedCaptionTone = selectedNFT ? 'ready' : 'waiting'
  const showBlockingGalleryLoad = !account
    ? false
    : (isLoadingNfts && myNFTs.length === 0)
  const activeModalPreviewImage = activeModalIsEvolved
    ? (activeModalImage3D || activeModalImage2D || '')
    : resolvePreviewImage(activeModalMeta)
  const showModalAnimation = activeModalIsEvolved
    && Boolean(activeModalAnimationUrl)
  const activeModalValidationIssues = collectMediaValidationIssues({
    isEvolved: activeModalIsEvolved,
    image2d: activeModalStrictImage2D || activeModalMeta?.image || '',
    image3d: activeModalStrictImage3D,
    animationUrl: activeModalAnimationUrl,
  })
  const tokenExistsInEvolved = parsedTokenQuery ? evolvedNFTs.some((nft) => nft.tokenId === parsedTokenQuery) : false
  const tokenExistsInTwoD = parsedTokenQuery ? twoDNFTs.some((nft) => nft.tokenId === parsedTokenQuery) : false
  const gallerySearchMessage = hasTokenQuery && !parsedTokenQuery
    ? 'Enter a valid token ID.'
    : hasTokenQuery && activeTab === 'evolved' && !tokenExistsInEvolved
      ? 'That token is not in your 3D NFTs.'
      : hasTokenQuery && activeTab !== 'evolved' && !tokenExistsInTwoD
        ? 'That token is not in your 2D NFTs.'
        : ''

  const handleLookupButtonClick = () => {
    if (canClearLookup) {
      setTokenIdInput('')
      setResolvedLookupTokenId(null)
      return
    }
    fetchTokenById()
  }

  const toggleRawMetadata = async () => {
    if (!traitsModal?.tokenId) return
    if (showRawMetadata) {
      setShowRawMetadata(false)
      return
    }
    setShowRawMetadata(true)
    if (rawMetadata || isLoadingRawMetadata) return
    setIsLoadingRawMetadata(true)
    setRawMetadataError('')
    try {
      const nextRawMetadata = await fetchRawOnchainMetadataJson(traitsModal.tokenId, provider)
      setRawMetadata(nextRawMetadata)
    } catch (err) {
      setRawMetadataError(String(err?.message || 'Failed to load raw metadata'))
    } finally {
      setIsLoadingRawMetadata(false)
    }
  }

  const toggleTokenUriView = async () => {
    if (!traitsModal?.tokenId) return
    if (showTokenUri) {
      setShowTokenUri(false)
      return
    }

    setShowTokenUri(true)
    if (tokenUriValue || isLoadingTokenUri) return

    setIsLoadingTokenUri(true)
    setTokenUriError('')
    try {
      const nextTokenUri = await fetchTokenUriString(traitsModal.tokenId, provider)
      setTokenUriValue(nextTokenUri)
      const resolved = await resolveTokenUriImages(nextTokenUri)
      setTokenUriMetadataText(resolved.metadataText || '')
      setTokenUriImage2D(resolved.image2d || '')
      setTokenUriImage3D(resolved.image3d || '')
      setTokenUriAnimationUrl(resolved.animationUrl || '')
    } catch (err) {
      setTokenUriError(String(err?.message || 'Failed to load tokenURI'))
    } finally {
      setIsLoadingTokenUri(false)
    }
  }

  useEffect(() => {
    setShowRawMetadata(false)
    setRawMetadata('')
    setRawMetadataError('')
    setIsLoadingRawMetadata(false)
    setShowTokenUri(false)
    setTokenUriValue('')
    setTokenUriMetadataText('')
    setTokenUriImage2D('')
    setTokenUriImage3D('')
    setTokenUriAnimationUrl('')
    setSlotImage2D('')
    setSlotImage3D('')
    setContractModelUrl('')
    setTokenUriError('')
    setIsLoadingTokenUri(false)
  }, [traitsModal?.tokenId])

  useEffect(() => {
    if (!traitsModal?.tokenId) return
    let cancelled = false
    ;(async () => {
      const slotPair = await fetchTokenImagePairFromSlots(provider, traitsModal.tokenId)
      if (cancelled) return
      setSlotImage2D(slotPair.image2d || '')
      setSlotImage3D(slotPair.image3d || '')
    })()
    return () => {
      cancelled = true
    }
  }, [traitsModal?.tokenId, provider])

  useEffect(() => {
    if (!activeModalIsEvolved || !traitsModal?.tokenId) return
    if (tokenUriAnimationUrl || tokenUriValue || isLoadingTokenUri) return

    let cancelled = false
    ;(async () => {
      setIsLoadingTokenUri(true)
      try {
        const nextTokenUri = await fetchTokenUriString(traitsModal.tokenId, provider)
        if (cancelled) return
        setTokenUriValue(nextTokenUri)
        const resolved = await resolveTokenUriImages(nextTokenUri)
        if (cancelled) return
        setTokenUriMetadataText(resolved.metadataText || '')
        setTokenUriImage2D(resolved.image2d || '')
        setTokenUriImage3D(resolved.image3d || '')
        setTokenUriAnimationUrl(resolved.animationUrl || '')
      } catch (err) {
        if (cancelled) return
        setTokenUriError(String(err?.message || 'Failed to load tokenURI'))
      } finally {
        if (!cancelled) setIsLoadingTokenUri(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeModalIsEvolved, traitsModal?.tokenId, tokenUriAnimationUrl, tokenUriValue, isLoadingTokenUri, provider])

  useEffect(() => {
    if (!activeModalIsEvolved || !traitsModal?.tokenId) {
      setContractModelUrl('')
      return
    }
    if (tokenUriAnimationUrl || normalizeOnchainUrl(activeModalMeta?.animationUrl || '')) return

    let cancelled = false
    ;(async () => {
      const modelUrl = await fetchTokenInteractiveModelUrl(provider, traitsModal.tokenId)
      if (cancelled) return
      setContractModelUrl(modelUrl || '')
    })()

    return () => {
      cancelled = true
    }
  }, [activeModalIsEvolved, traitsModal?.tokenId, tokenUriAnimationUrl, activeModalMeta?.animationUrl, provider])

  useEffect(() => {
    if (!showModalAnimation || !activeModalAnimationIsModelAsset) return
    if (typeof window === 'undefined') return
    if (window.customElements?.get('model-viewer')) {
      setIsModelViewerReady(true)
      return
    }

    let disposed = false
    const listenerDisposers = []
    const sources = [
      'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js',
      'https://cdn.jsdelivr.net/npm/@google/model-viewer/dist/model-viewer.min.js',
    ]
    const onReady = () => {
      if (!disposed) setIsModelViewerReady(Boolean(window.customElements?.get('model-viewer')))
    }
    const normalizeSource = (src) => {
      const raw = String(src || '').trim()
      if (!raw) return ''
      try {
        const parsed = new URL(raw, window.location.origin)
        return `${parsed.host}${parsed.pathname}`.toLowerCase()
      } catch {
        return raw.replace(/^https?:\/\//i, '').toLowerCase()
      }
    }
    const findScriptForSource = (src) => {
      const normalized = normalizeSource(src)
      const scripts = Array.from(document.querySelectorAll('script[data-model-viewer-loader="1"]'))
      return scripts.find((node) => normalizeSource(node.getAttribute('src') || node.src) === normalized) || null
    }
    const attachScript = (src, sourceIndex) => {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = src
      script.async = true
      script.dataset.modelViewerLoader = '1'
      script.dataset.modelViewerSourceIndex = String(sourceIndex)
      return script
    }
    const bindScriptListeners = (script, sourceIndex) => {
      const onLoad = () => onReady()
      const onError = () => {
        if (!disposed) {
          script.dataset.modelViewerFailed = '1'
          loadSource(sourceIndex + 1)
        }
      }
      script.addEventListener('load', onLoad, { once: true })
      script.addEventListener('error', onError, { once: true })
      listenerDisposers.push(() => {
        script.removeEventListener('load', onLoad)
        script.removeEventListener('error', onError)
      })
    }
    const loadSource = (sourceIndex) => {
      if (disposed || sourceIndex >= sources.length) {
        onReady()
        return
      }
      const source = sources[sourceIndex]
      const existingForSource = findScriptForSource(source)
      if (existingForSource) {
        if (existingForSource.dataset.modelViewerFailed === '1') {
          loadSource(sourceIndex + 1)
          return
        }
        bindScriptListeners(existingForSource, sourceIndex)
        return
      }

      const script = attachScript(source, sourceIndex)
      bindScriptListeners(script, sourceIndex)
      document.head.appendChild(script)
    }

    loadSource(0)

    return () => {
      disposed = true
      listenerDisposers.forEach((dispose) => {
        try {
          dispose()
        } catch {
          // Ignore listener cleanup failures.
        }
      })
    }
  }, [showModalAnimation, activeModalAnimationIsModelAsset])

  useEffect(() => {
    let cancelled = false
    const scheduleRetryTick = (retryAt) => {
      if (!Number.isFinite(Number(retryAt)) || retryAt <= 0) return
      const delay = Math.max(250, Number(retryAt) - Date.now())
      if (metaRetryTimerRef.current) {
        clearTimeout(metaRetryTimerRef.current)
      }
      metaRetryTimerRef.current = setTimeout(() => {
        metaRetryTimerRef.current = null
        setMetaRetryTick((prev) => prev + 1)
      }, delay)
    }

    if (!account || visibleTokenIds.length === 0) {
      setIsHydratingMeta(false)
      if (metaRetryTimerRef.current) {
        clearTimeout(metaRetryTimerRef.current)
        metaRetryTimerRef.current = null
      }
      return
    }

    const tokenIds = visibleTokenIds
    const now = Date.now()
    const uncachedIds = tokenIds.filter((id) => {
      if (metaByTokenRef.current[id]) {
        delete metaRetryDueByTokenRef.current[id]
        return false
      }
      const retryAt = Number(metaRetryDueByTokenRef.current[id] || 0)
      return retryAt <= now
    })

    if (uncachedIds.length === 0) {
      setIsHydratingMeta(false)
      const nextVisibleRetryAt = tokenIds.reduce((earliest, id) => {
        const retryAt = Number(metaRetryDueByTokenRef.current[id] || 0)
        if (!retryAt || retryAt <= Date.now()) return earliest
        if (!earliest) return retryAt
        return Math.min(earliest, retryAt)
      }, 0)
      if (nextVisibleRetryAt > 0) {
        scheduleRetryTick(nextVisibleRetryAt)
      } else if (metaRetryTimerRef.current) {
        clearTimeout(metaRetryTimerRef.current)
        metaRetryTimerRef.current = null
      }
      return
    }

    const warmedMeta = {}
    const warmedIds = new Set()
    uncachedIds.forEach((id) => {
      const cached = readCachedOnchainMetadata(id)
      if (cached && (cached.image || cached.image2d || cached.image3d)) {
        warmedMeta[id] = cached
        warmedIds.add(id)
        delete metaRetryDueByTokenRef.current[id]
      }
    })
    if (Object.keys(warmedMeta).length > 0) {
      setMetaByToken((prev) => ({ ...warmedMeta, ...prev }))
      setErrorByToken((prev) => {
        const next = { ...prev }
        Object.keys(warmedMeta).forEach((id) => {
          next[id] = ''
        })
        return next
      })
    }

    const idsToFetch = uncachedIds.filter((id) => !warmedIds.has(id))
    if (idsToFetch.length === 0) {
      setIsHydratingMeta(false)
      return
    }

    setIsHydratingMeta(true)
    setLoadingByToken((prev) => {
      const next = { ...prev }
      idsToFetch.forEach((id) => {
        next[id] = true
      })
      return next
    })

    let earliestRetryAt = 0
    const applyMetadataBatch = async (batch) => {
      if (!batch.length) return
      const results = await Promise.allSettled(
        batch.map((id) => withTimeout(fetchGalleryTokenMetadata(provider, id), METADATA_FETCH_TIMEOUT_MS, 'Metadata timeout'))
      )
      if (cancelled) return
      const nextMeta = {}
      const nextErr = {}
      const nextLoading = {}
      results.forEach((result, idx) => {
        const id = batch[idx]
        if (result.status === 'fulfilled') {
          nextMeta[id] = result.value
          nextErr[id] = ''
          delete metaRetryDueByTokenRef.current[id]
        } else {
          nextErr[id] = String(result.reason?.message || 'Failed to load')
          const retryAt = Date.now() + META_HYDRATE_RETRY_MS
          metaRetryDueByTokenRef.current[id] = retryAt
          earliestRetryAt = earliestRetryAt > 0 ? Math.min(earliestRetryAt, retryAt) : retryAt
        }
        nextLoading[id] = false
      })
      setMetaByToken((prev) => ({ ...prev, ...nextMeta }))
      setErrorByToken((prev) => ({ ...prev, ...nextErr }))
      setLoadingByToken((prev) => ({ ...prev, ...nextLoading }))
    }

    ;(async () => {
      const eagerIds = idsToFetch.slice(0, PRIORITY_META_HYDRATE_COUNT)
      const deferredIds = idsToFetch.slice(PRIORITY_META_HYDRATE_COUNT)
      const CHUNK = 4

      for (let i = 0; i < eagerIds.length; i += CHUNK) {
        await applyMetadataBatch(eagerIds.slice(i, i + CHUNK))
      }

      if (cancelled) return

      for (let i = 0; i < deferredIds.length; i += CHUNK) {
        await applyMetadataBatch(deferredIds.slice(i, i + CHUNK))
        if (cancelled) return
        if (i + CHUNK < deferredIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 0))
        }
      }

      if (!cancelled) {
        setIsHydratingMeta(false)
        if (earliestRetryAt > 0) {
          scheduleRetryTick(earliestRetryAt)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [account, visibleTokenIds, refreshKey, provider, metaRetryTick])

  const EvolveCardShell = 'div'
  const EvolveDisplayShell = 'div'

  return (
    <>
    <div className="mint-page evolve-page mint-admin-skin">
      <SiteNav label="Select / Evolve / 3D" />

      <div className="mint-layout">
        <EvolveCardShell className="mint-card">
          <div className="mint-card-header">
            <span className="mint-card-title">Evolution Studio</span>
            <span className="mint-card-badge">3D</span>
          </div>

          <div className="mint-supply">
            <div className="mint-supply-header">
              <span className="mint-supply-label">Collection Evolved</span>
              <span className="mint-supply-value">
                <span className="evolve-supply-current">{globalEvolvedCount}</span>
                <span className="evolve-supply-separator"> / </span>
                <span className="evolve-supply-total">{globalTotalMinted}</span>
              </span>
            </div>
            <div className="mint-supply-bar">
              <div className="mint-supply-fill" style={{ width: `${evolveProgress}%` }}></div>
            </div>
            <div className="mint-supply-footer">
              <span className={`evolve-supply-remaining ${evolveSupplyTone}`}>{isLoadingGlobalProgress ? 'Updating...' : `${remainingToEvolve} remaining`}</span>
              <span className={`evolve-supply-percent ${evolveSupplyTone}`}>{Math.round(evolveProgress)}%</span>
            </div>
          </div>

          <div className="evolve-stat-row">
            <div className="evolve-stat-box">
              <span>Wallet</span>
              <strong className="evolve-stat-wallet">{balance}</strong>
            </div>
            <div className="evolve-stat-box">
              <span>2D Ready</span>
              <strong className="evolve-stat-ready">{twoDNFTs.length}</strong>
            </div>
            <div className="evolve-stat-box">
              <span>3D Done</span>
              <strong className="evolve-stat-done">{evolvedNFTs.length}</strong>
            </div>
            <div className="evolve-stat-box">
              <span>Evolve Fee</span>
              <strong className="evolve-stat-ready">{evolveFeeDisplayLabel}</strong>
            </div>
          </div>

            {!account ? (
              <ConnectWalletButton onClick={connect} />
            ) : (
            <ConnectedWallet
              label="Connected Wallet"
              address={`${account.slice(0, 4)}...${account.slice(-3)}`}
              badge={`${balance} Penguins`}
              onDisconnect={disconnectWallet}
            />
          )}

            <div className="evolve-token-lookup">
              <label htmlFor="evolve-token-id" className="evolve-token-lookup-label">Find Token ID</label>
              <div className="evolve-token-lookup-row">
                <input
                  id="evolve-token-id"
                  className="evolve-token-lookup-input"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="Filter gallery by token ID"
                  value={tokenIdInput}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    setTokenIdInput(nextValue)
                    if (!nextValue || Number(nextValue) !== resolvedLookupTokenId) {
                      setResolvedLookupTokenId(null)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleLookupButtonClick()
                    }
                  }}
                />
                <Button
                  className="evolve-token-lookup-btn"
                  variant="secondary"
                  size="sm"
                  onClick={handleLookupButtonClick}
                  disabled={!account || isFetchingTokenId || (!canClearLookup && !hasTokenQuery)}
                  aria-busy={isFetchingTokenId}
                >
                  {isFetchingTokenId ? 'Loading' : canClearLookup ? 'Clear' : 'Fetch'}
                </Button>
              </div>
              {gallerySearchMessage ? (
                <div className="evolve-status-hint">{gallerySearchMessage}</div>
              ) : hasTokenQuery && parsedTokenQuery ? (
                <div className="evolve-status-hint">Filtering gallery to token #{parsedTokenQuery}.</div>
              ) : null}
              {isGallerySnapshotStale ? (
                <div className="evolve-status-hint">Showing cached NFTs. Live wallet sync failed; retrying automatically.</div>
              ) : null}
            </div>

            {activeTab !== 'evolved' && (
              <div className={`evolve-selected-card ${selectedNFT ? '' : 'empty'}`}>
                <div className="evolve-selected-head">
                  <span className="evolve-selected-kicker">Selected NFT</span>
                <span className={`evolve-selected-caption ${selectedCaptionTone}`}>{selectedNFT ? 'Ready To Review' : 'Waiting For Selection'}</span>
              </div>

              {selectedNFT ? (
                <div className="evolve-selected-body">
                  <div className="evolve-selected-media">
                    {resolvePreviewImage(selectedMeta) ? (
                      <img
                        className="evolve-selected-image"
                        src={resolvePreviewImage(selectedMeta)}
                        alt={resolveMetadataName(selectedMeta, selectedNFT.tokenId)}
                      />
                    ) : (
                      <div className="evolve-selected-image evolve-selected-image-placeholder">No Preview</div>
                    )}
                  </div>
                  <div className="evolve-selected-content">
                    <div className="evolve-selected-meta">
                      <div className="evolve-selected-name">
                        <strong>{resolveMetadataName(selectedMeta, selectedNFT.tokenId)}</strong>
                        <span className="evolve-selected-token">#{selectedNFT.tokenId}</span>
                      </div>
                      <span className={`evolve-selected-state ${selectedState.tone}`}>{selectedState.label}</span>
                    </div>
                    <div className="evolve-selected-grid">
                      <span className="evolve-selected-stat">
                        <b>Traits</b>
                        <span className="evolve-selected-stat-value evolve-selected-stat-traits">{selectedTraitsCount}</span>
                      </span>
                      <span className="evolve-selected-stat">
                        <b>Stage</b>
                        <span className={`evolve-selected-stat-value ${selectedIsEvolved ? 'stage-3d' : 'stage-2d'}`}>{selectedIsEvolved ? '3D' : '2D Base'}</span>
                      </span>
                      <span className="evolve-selected-stat">
                        <b>Evolve Fee</b>
                        <span className="evolve-selected-stat-value">{evolveFeeDisplayLabel}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="evolve-selected-empty">
                  Pick a 2D NFT from the gallery to prepare its 3D evolution.
                </div>
              )}
            </div>
          )}
          {activeTab !== 'evolved' && (
            <Button className="mint-submit-btn" variant="primary" size="md" onClick={evolveSelected} disabled={!selectedNFT || isEvolving || selectedIsEvolved || selectedIsUnrevealed} aria-busy={isEvolving}>
              {isEvolving ? 'Evolving' : (evolveFeeDisplayLabel !== 'Free' ? `Evolve - ${evolveFeeDisplayLabel}` : 'Evolve')}
            </Button>
          )}
          {statusMessage && (
            <StatusNotice
              message={statusMessage}
              tone={statusTone || 'info'}
              hint={statusHint}
            />
          )}
          {lastTxHash && (
            <a
              href={`${BLOCK_EXPLORER_URL}/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mint-tx-link"
            >
              {'View Evolve Transaction ->'}
            </a>
          )}
        </EvolveCardShell>

        <EvolveDisplayShell className="mint-display">
          <div className="evolve-display-head">
            <div>
              <span className="evolve-display-kicker">Wallet Gallery</span>
              <strong className={`evolve-display-title ${activeTab === 'evolved' ? 'evolved' : 'twod'}`}>{displayTabTitle}</strong>
            </div>
            <span className={`evolve-display-hint ${activeTab === 'evolved' ? 'focus-3d' : 'focus-2d'}`}>{displayTabHint}</span>
          </div>
          <div className="mint-tabs">
            <Button
              className={`mint-tab ${activeTab === 'my' ? 'active' : ''}`}
              variant="ghost"
              size="md"
              onClick={() => { setActiveTab('my'); setMyPage(1) }}
            >
              <span className="evolve-tab-label evolve-tab-label-full">My 2D NFTs <b className="evolve-tab-count">({twoDNFTs.length})</b></span>
              <span className="evolve-tab-label evolve-tab-label-short">2D <b className="evolve-tab-count">({twoDNFTs.length})</b></span>
            </Button>
            <Button
              className={`mint-tab ${activeTab === 'evolved' ? 'active' : ''}`}
              variant="ghost"
              size="md"
              onClick={() => { setActiveTab('evolved'); setEvolvedPage(1); setSelectedNFT(null) }}
            >
              <span className="evolve-tab-label evolve-tab-label-full">My 3D NFTs <b className="evolve-tab-count">({evolvedNFTs.length})</b></span>
              <span className="evolve-tab-label evolve-tab-label-short">3D <b className="evolve-tab-count">({evolvedNFTs.length})</b></span>
            </Button>
          </div>

          <div className="mint-tab-content">
            {!account ? (
              <div className="mint-empty">Connect wallet to view your NFTs</div>
            ) : showBlockingGalleryLoad ? (
              <div className="mint-empty">Loading NFTs...</div>
            ) : shownNFTs.length === 0 ? (
              <div className="mint-empty">
                {activeTab === 'evolved' ? 'No evolved NFTs yet' : 'No NFTs found in this wallet'}
              </div>
            ) : (
              <PaginatedGallery
                items={shownNFTs}
                currentPage={page}
                setPage={setPage}
                itemsPerPage={ITEMS_PER_PAGE}
                renderItem={(nft) => {
                  const meta = metaByToken[nft.tokenId]
                  const displayName = resolveMetadataName(meta, nft.tokenId)
                  const isSelected = selectedNFT?.tokenId === nft.tokenId
                  const canOpenTraits = activeTab === 'evolved'
                  const canSelect = activeTab !== 'evolved'
                  const cardImageSource = activeTab === 'evolved'
                    ? (resolve3DPreviewImage(meta) || resolve2DPreviewImage(meta))
                    : (resolve2DPreviewImage(meta) || resolve3DPreviewImage(meta))
                  const cardImage = normalizeOnchainImage(cardImageSource || '')

                  return (
                    <TokenGalleryCard
                      key={`my-${nft.tokenId}`}
                      tokenId={nft.tokenId}
                      image={cardImage}
                      imageAlt={displayName}
                      loading={Boolean(loadingByToken[nft.tokenId])}
                      error={errorByToken[nft.tokenId] || ''}
                      className={isSelected ? 'evolved' : ''}
                      onCardClick={() => {
                        if (canSelect) {
                          setSelectedNFT({ tokenId: nft.tokenId, meta })
                        }
                        if (canOpenTraits) {
                          setTraitsModal({ tokenId: nft.tokenId, meta })
                        }
                      }}
                      lines={[
                        `#${nft.tokenId}`,
                        displayName,
                        canOpenTraits ? `Traits: ${meta?.attributes?.length || 0}` : '',
                      ]}
                      actionHref={`${BLOCK_EXPLORER_URL}/nft/${CONTRACT_ADDRESS}/${nft.tokenId}`}
                      actionLabel="View ->"
                    />
                  )
                }}
              />
            )}
          </div>
        </EvolveDisplayShell>
      </div>

      {traitsModal && (
        <div className="mint-traits-modal-overlay" onClick={() => setTraitsModal(null)}>
          <div
            className="mint-traits-modal"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Button className="mint-traits-close" variant="ghost" size="icon" onClick={() => setTraitsModal(null)}>X</Button>
            <h3>
              #{traitsModal.tokenId}
              {` - ${resolveMetadataName(activeModalMeta, traitsModal.tokenId)}`}
            </h3>
            {activeModalIsEvolved ? (
              showModalAnimation ? (
                <div className="mint-traits-modal-image-wrap">
                  {activeModalAnimationIsModelAsset ? (
                    isModelViewerReady ? (
                      <model-viewer
                        className="mint-traits-modal-animation"
                        src={activeModalAnimationUrl}
                        camera-controls
                        auto-rotate
                        shadow-intensity="1"
                        touch-action="pan-y"
                      />
                    ) : (
                      <a
                        href={activeModalAnimationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mint-tx-link"
                      >
                        {'Open 3D Model ->'}
                      </a>
                    )
                  ) : (
                    <iframe
                      className="mint-traits-modal-animation"
                      src={activeModalOnchainToggleUrl}
                      title={`NFT #${traitsModal.tokenId} animation`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      sandbox="allow-scripts"
                    />
                  )}
                </div>
              ) : (
                <div className="mint-traits-modal-image-wrap">
                  <div className="mint-loading">Animation preview unavailable.</div>
                </div>
              )
            ) : activeModalPreviewImage ? (
              <div className="mint-traits-modal-image-wrap">
                <img src={activeModalPreviewImage} alt={resolveMetadataName(activeModalMeta, traitsModal.tokenId)} />
              </div>
            ) : null}
            {activeModalMeta?.description ? (
              <p className="mint-gallery-description">{activeModalMeta.description}</p>
            ) : null}
            <div className="mint-gallery-actions">
              <Button
                className="mint-evolve-btn"
                variant="secondary"
                size="sm"
                onClick={toggleRawMetadata}
                aria-busy={showRawMetadata && isLoadingRawMetadata}
              >
                {showRawMetadata ? 'Hide Raw Metadata' : 'View Raw Metadata'}
              </Button>
              <Button
                className="mint-evolve-btn"
                variant="secondary"
                size="sm"
                onClick={toggleTokenUriView}
                aria-busy={showTokenUri && isLoadingTokenUri}
              >
                {showTokenUri ? 'Hide Token URL' : 'View Token URL'}
              </Button>
            </div>
            {activeModalIsEvolved && isHtmlAnimationUrl(activeModalAnimationUrl) ? (
              <div className="evolve-status-hint">On-chain HTML toggle active (no signature required).</div>
            ) : null}
            {activeModalValidationIssues.length ? (
              <div className="evolve-status-hint">
                {activeModalValidationIssues.map((issue, idx) => (
                  <div key={`modal-media-issue-${traitsModal.tokenId}-${idx}`}>Validation: {issue}</div>
                ))}
              </div>
            ) : null}
            {showRawMetadata ? (
              <div className="mint-raw-metadata-panel">
                {isLoadingRawMetadata ? (
                  <div className="mint-loading">Loading raw metadata...</div>
                ) : rawMetadataError ? (
                  <div className="mint-loading">{rawMetadataError}</div>
                ) : (
                  <pre className="mint-raw-metadata-pre">{rawMetadata}</pre>
                )}
              </div>
            ) : null}
            {showTokenUri ? (
              <div className="mint-raw-metadata-panel">
                {isLoadingTokenUri ? (
                  <div className="mint-loading">Loading tokenURI...</div>
                ) : tokenUriError ? (
                  <div className="mint-loading">{tokenUriError}</div>
                ) : (
                  <>
                    {tokenUriImage2D || tokenUriImage3D || tokenUriAnimationUrl ? (
                      <div className="evolve-status-hint">
                        {tokenUriImage2D ? `2D: ${tokenUriImage2D}` : '2D: not found in tokenURI'}<br />
                        {tokenUriImage3D ? `3D: ${tokenUriImage3D}` : '3D: not found in tokenURI'}<br />
                        {tokenUriAnimationUrl ? `Animation: ${tokenUriAnimationUrl}` : 'Animation: not found in tokenURI'}
                      </div>
                    ) : null}
                    <pre className="mint-raw-metadata-pre">{tokenUriValue}</pre>
                    {tokenUriMetadataText ? (
                      <pre className="mint-raw-metadata-pre">{tokenUriMetadataText}</pre>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
            <div className="mint-gallery-traits">
              {(activeModalMeta?.attributes || []).length ? (
                activeModalMeta.attributes.map((attr, idx) => (
                  <span key={`${traitsModal.tokenId}-${idx}`} className="mint-gallery-trait">
                    {attr.trait_type}: {String(attr.value)}
                  </span>
                ))
              ) : (
                <span className="mint-gallery-trait">No traits available</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default Evolve
