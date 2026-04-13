import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ethers } from 'ethers'
import * as XLSX from 'xlsx'
import Button from '../components/Button.jsx'
import ConnectedWallet from '../components/ConnectedWallet.jsx'
import ConnectWalletButton from '../components/ConnectWalletButton.jsx'
import StatusNotice from '../components/StatusNotice.jsx'
import SiteNav from '../components/SiteNav.jsx'
import '../Mint.css'
import { BLOCK_EXPLORER_URL, CHAIN_ID_HEX, CHAIN_NAME, CONTRACT_ADDRESS, ETH_SEPOLIA_RPC, ETH_SEPOLIA_RPC_URLS } from '../contractConfig.js'
import contractABI from '../abi/EightBitPenguinsUpgradeable.abi.js'
import {
  DEFAULT_TASK_PINNED_POST_LINK,
  getTaskPinnedPostLink,
  isValidPinnedPostLink,
  resetTaskPinnedPostLink,
  saveTaskPinnedPostLink,
} from '../taskConfig.js'
import {
  ADMIN_ACTIVITY_LOG_EVENT,
  appendAdminActivityLog,
  clearAdminActivityLog,
  fetchAdminActivityLog,
} from '../adminLog.js'
import { getRpcCircuitState, getSharedReadProvider, resilientRpcCall } from '../readProvider.js'
import { uploadBlobToIPFS } from '../ipfs.js'

const GAME_STATS_PERIODS = [
  { id: 'all', label: 'All Time' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]
const GAME_STATS_REFRESH_MS = 30000
const GAME_STATS_REFRESH_MAX_MS = 120000
const ADMIN_MAINTENANCE_API_PATH = '/api/admin-maintenance'
const ADMIN_SESSION_API_PATH = '/api/admin-session'
const ADMIN_DATA_API_PATH = '/api/admin-data'
const ADMIN_MAINTENANCE_SIGN_PREFIX = '8bitPenguins Admin Maintenance'
const ADMIN_SESSION_SIGN_PREFIX = '8bitPenguins Admin Session'
const ADMIN_SESSION_REFRESH_BUFFER_MS = 60_000
const PHASE_WHITELIST_EVENT_TOPIC = ethers.id('PhaseWhitelistUpdated(uint256,address,bool)')
const PHASE_NAME_GROUP_SEPARATOR = '::'
const PHASE_GROUP_ORDER = ['team', 'gtd', 'og communities', 'fcfs', 'public']
const PHASE_ORDER_STORAGE_KEY_PREFIX = 'penguin:phase-order:'
const PLACEHOLDER_ONCHAIN_SOFT_LIMIT_CHARS = 12000
const MAINNET_USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const ADMIN_EXTRA_ABI = [
  'function finalizeRarity()',
  'function rarityFinalized() view returns (bool)',
  'function setFinalRarityData(uint256[] tokenIds, uint256[] scores, uint256[] ranks)',
  'function evolveFee() view returns (uint256)',
  'function setEvolveFee(uint256 fee)',
  'function evolveFeeReceiver() view returns (address)',
  'function setEvolveFeeReceiver(address receiver)',
  'function setEvolveFeeInfo(address receiver, uint256 fee)',
  'function evolveFeeToken() view returns (address)',
  'function evolveFeeTokenAmount() view returns (uint256)',
  'function setEvolveFeeTokenInfo(address token, uint256 amount)',
]
const ADMIN_CONTRACT_ABI = [...contractABI, ...ADMIN_EXTRA_ABI]

function createEmptyGameStats() {
  return {
    summaryVersion: 0,
    sourceMode: 'puzzle_submission',
    sourceLabel: 'Puzzle Submission',
    period: 'all',
    periodLabel: 'All Time',
    trackedSince: 0,
    windowStart: 0,
    windowEnd: 0,
    lastUpdated: 0,
    usersPlayed: 0,
    trackedPlayers: 0,
    returningPlayers: 0,
    qualifiedPlayers: 0,
    trackedQualifiedPlayers: 0,
    legacyQualifiedPlayers: 0,
    totalRuns: 0,
    completedRuns: 0,
    qualifiedRuns: 0,
    unqualifiedRuns: 0,
    incompleteRuns: 0,
    activeRuns: 0,
    runQualificationRate: 0,
    averageQualifiedScore: 0,
    averageQualifiedMoves: 0,
    averageQualifiedTimeSec: 0,
    bestScore: 0,
    topPerformer: null,
    leaderboardTop: [],
    latestQualified: null,
    analyticsEvents: 0,
    leaderboardEntries: 0,
    qualifiedSubmissionCount: 0,
    proofSubmittedPlayers: 0,
    proofPendingPlayers: 0,
    legacyRecoveredPlayers: 0,
    legacyRecoveredQualifiedRuns: 0,
    analyticsCoverageRate: 0,
    qualifiedCoverageRate: 0,
    returningGapMinutes: 30,
  }
}

function normalizeGameStatsSummary(payload) {
  if (!payload || (typeof payload !== 'object')) {
    return createEmptyGameStats()
  }

  const base = createEmptyGameStats()
  return {
    ...base,
    ...payload,
    sourceMode: String(payload.sourceMode || payload.source || 'puzzle_submission'),
    sourceLabel: String(payload.sourceLabel || 'Puzzle Submission'),
    period: String(payload.period || 'all'),
    periodLabel: String(payload.periodLabel || 'All Time'),
    trackedSince: Number(payload.trackedSince || 0),
    windowStart: Number(payload.windowStart || 0),
    windowEnd: Number(payload.windowEnd || 0),
    lastUpdated: Number(payload.lastUpdated || 0),
    usersPlayed: Number(payload.usersPlayed || 0),
    trackedPlayers: Number(payload.trackedPlayers || 0),
    returningPlayers: Number(payload.returningPlayers || 0),
    qualifiedPlayers: Number(payload.qualifiedPlayers || 0),
    trackedQualifiedPlayers: Number(payload.trackedQualifiedPlayers || 0),
    legacyQualifiedPlayers: Number(payload.legacyQualifiedPlayers || payload.legacyRecoveredQualifiedRuns || 0),
    totalRuns: Number(payload.totalRuns || 0),
    completedRuns: Number(payload.completedRuns || 0),
    qualifiedRuns: Number(payload.qualifiedRuns || 0),
    unqualifiedRuns: Number(payload.unqualifiedRuns || 0),
    incompleteRuns: Number(payload.incompleteRuns || 0),
    activeRuns: Number(payload.activeRuns || 0),
    runQualificationRate: Number(payload.runQualificationRate || 0),
    averageQualifiedScore: Number(payload.averageQualifiedScore || 0),
    averageQualifiedMoves: Number(payload.averageQualifiedMoves || 0),
    averageQualifiedTimeSec: Number(payload.averageQualifiedTimeSec || 0),
    bestScore: Number(payload.bestScore || 0),
    analyticsEvents: Number(payload.analyticsEvents || 0),
    leaderboardEntries: Number(payload.leaderboardEntries || 0),
    qualifiedSubmissionCount: Number(payload.qualifiedSubmissionCount || 0),
    proofSubmittedPlayers: Number(payload.proofSubmittedPlayers || payload.submittedProofPlayers || payload.qualifiedSubmissionCount || 0),
    proofPendingPlayers: Number(payload.proofPendingPlayers || payload.pendingProofPlayers || 0),
    legacyRecoveredPlayers: Number(payload.legacyRecoveredPlayers || 0),
    legacyRecoveredQualifiedRuns: Number(payload.legacyRecoveredQualifiedRuns || 0),
    analyticsCoverageRate: Number(payload.analyticsCoverageRate || 0),
    qualifiedCoverageRate: Number(payload.qualifiedCoverageRate || 0),
    returningGapMinutes: Number(payload.returningGapMinutes || 30),
    topPerformer: payload.topPerformer || null,
    leaderboardTop: Array.isArray(payload.leaderboardTop) ? payload.leaderboardTop : [],
    latestQualified: payload.latestQualified || null,
  }
}

function shortAddress(value) {
  if (!value) return 'Not set'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function formatEth(value) {
  try {
    return Number(ethers.formatEther(value)).toFixed(4)
  } catch {
    return '0.0000'
  }
}

function normalizeOnchainImage(image) {
  if (!image || typeof image !== 'string') return ''
  if (image.startsWith('data:image/')) return image
  if (image.startsWith('<svg')) return `data:image/svg+xml;utf8,${encodeURIComponent(image)}`
  if (image.startsWith('ipfs://')) return image.replace('ipfs://', 'https://ipfs.io/ipfs/')
  return image
}

function createPlaceholderSvgFromImageUri(imageUri) {
  const source = String(imageUri || '').trim()
  if (!source) return ''
  const escapedSource = source
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <image href="${escapedSource}" x="0" y="0" width="400" height="400" preserveAspectRatio="xMidYMid slice"/>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function createPremiumPlaceholderDataUri() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0c1520"/>
      <stop offset="100%" stop-color="#070b12"/>
    </linearGradient>
    <linearGradient id="orb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6c35b"/>
      <stop offset="100%" stop-color="#a86d17"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect x="90" y="90" width="1020" height="1020" rx="54" fill="#0b1119" stroke="#263140" stroke-width="8"/>
  <circle cx="600" cy="520" r="235" fill="url(#orb)"/>
  <rect x="425" y="430" width="350" height="270" rx="24" fill="#101722" opacity="0.55"/>
  <text x="600" y="860" fill="#f5f8fc" font-family="JetBrains Mono, monospace" font-size="56" text-anchor="middle" letter-spacing="5">8BIT PENGUINS</text>
  <text x="600" y="930" fill="#9fb0c7" font-family="JetBrains Mono, monospace" font-size="40" text-anchor="middle" letter-spacing="4">UNREVEALED</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function normalizeUsdcDraft(value) {
  return String(value || '').trim().replace(/,/g, '')
}

function isValidUsdcDraft(value) {
  const normalized = normalizeUsdcDraft(value)
  if (!normalized) return true
  return /^(?:\d+|\d+\.\d{0,6}|\.\d{1,6})$/.test(normalized)
}

function usdcDraftToUnits(usdcDraft) {
  const normalized = normalizeUsdcDraft(usdcDraft)
  if (!normalized) return 0n
  if (!isValidUsdcDraft(normalized)) {
    throw new Error('Evolve fee must be a valid USDC amount')
  }
  const canonical = normalized.startsWith('.') ? `0${normalized}` : normalized
  return ethers.parseUnits(canonical, 6)
}

function usdcUnitsToDraft(unitsValue) {
  try {
    const formatted = ethers.formatUnits(BigInt(unitsValue || 0n), 6)
    return formatted.replace(/\.?0+$/, '') || '0'
  } catch {
    return '0'
  }
}

function inferBlobExtension(blobType) {
  const normalized = String(blobType || '').toLowerCase()
  if (normalized.includes('svg')) return 'svg'
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  return 'png'
}

async function placeholderDraftToBlob(rawDraft) {
  const draft = String(rawDraft || '').trim()
  if (!draft) {
    throw new Error('Enter a placeholder image first')
  }

  if (draft.startsWith('<svg')) {
    return new Blob([draft], { type: 'image/svg+xml' })
  }

  if (draft.startsWith('data:')) {
    const res = await fetch(draft)
    if (!res.ok) throw new Error('Could not read the placeholder data URL')
    return res.blob()
  }

  if (draft.startsWith('ipfs://') || draft.startsWith('http://') || draft.startsWith('https://')) {
    const wrappedSvgDataUri = createPlaceholderSvgFromImageUri(draft)
    const res = await fetch(wrappedSvgDataUri)
    if (!res.ok) throw new Error('Could not wrap placeholder URL for upload')
    return res.blob()
  }

  throw new Error('Use data:image, raw <svg>, ipfs://, or http(s) URL format for placeholder')
}

function parseMetadata(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return {
      name: parsed.name || '',
      image: normalizeOnchainImage(parsed.image || ''),
      attributes: Array.isArray(parsed.attributes) ? parsed.attributes : [],
      revealed: parsed.revealed,
      evolved3D: parsed.evolved_3d,
    }
  } catch {
    return null
  }
}

function toDatetimeLocal(timestamp) {
  if (!timestamp) return ''
  const date = new Date(Number(timestamp) * 1000)
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function fromDatetimeLocal(value) {
  if (!value) return 0
  return Math.floor(new Date(value).getTime() / 1000)
}

function phaseWindowLabel(phase) {
  const start = phase.startTime ? new Date(phase.startTime * 1000).toLocaleString() : 'Immediate'
  const end = phase.endTime ? new Date(phase.endTime * 1000).toLocaleString() : 'Open ended'
  return `${start} to ${end}`
}

function getPhaseOrderStorageKey(contractAddress) {
  return `${PHASE_ORDER_STORAGE_KEY_PREFIX}${String(contractAddress || '').toLowerCase()}`
}

function readStoredPhaseOrder(contractAddress) {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getPhaseOrderStorageKey(contractAddress))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0)
  } catch {
    return []
  }
}

function writeStoredPhaseOrder(contractAddress, order) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getPhaseOrderStorageKey(contractAddress), JSON.stringify(order))
  } catch {
    // Ignore storage failures.
  }
}

function parsePhaseNameParts(rawName, fallbackLabel = '') {
  const normalized = String(rawName || fallbackLabel || '').trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return {
      fullLabel: '',
      groupLabel: '',
      subLabel: '',
      grouped: false,
    }
  }

  const separatorIndex = normalized.indexOf(PHASE_NAME_GROUP_SEPARATOR)
  if (separatorIndex > 0) {
    const groupLabel = normalized.slice(0, separatorIndex).trim()
    const subLabel = normalized.slice(separatorIndex + PHASE_NAME_GROUP_SEPARATOR.length).trim()
    if (groupLabel && subLabel) {
      return {
        fullLabel: normalized,
        groupLabel,
        subLabel,
        grouped: true,
      }
    }
  }

  const parenMatch = normalized.match(/^(.+?)\s*\(([^()]+)\)\s*$/)
  if (parenMatch) {
    const groupLabel = String(parenMatch[1] || '').trim()
    const subLabel = String(parenMatch[2] || '').trim()
    if (groupLabel && subLabel) {
      return {
        fullLabel: normalized,
        groupLabel,
        subLabel,
        grouped: true,
      }
    }
  }

  return {
    fullLabel: normalized,
    groupLabel: '',
    subLabel: normalized,
    grouped: false,
  }
}

function composePhaseName(groupTitle, phaseTitle) {
  const normalizedGroup = String(groupTitle || '').trim().replace(/\s+/g, ' ')
  const normalizedPhase = String(phaseTitle || '').trim().replace(/\s+/g, ' ')
  if (normalizedGroup && normalizedPhase) {
    return `${normalizedGroup} ${PHASE_NAME_GROUP_SEPARATOR} ${normalizedPhase}`
  }
  return normalizedPhase || normalizedGroup
}

function getPhaseDisplayParts(phase) {
  const fallbackLabel = `Phase ${Number(phase?.id ?? 0) + 1}`
  return parsePhaseNameParts(phase?.name, fallbackLabel)
}

function formatPhaseDisplayLabel(phaseParts) {
  if (!phaseParts) return ''
  return phaseParts.grouped ? `${phaseParts.groupLabel} - ${phaseParts.subLabel}` : phaseParts.fullLabel
}

function normalizePhaseGroupLabel(label) {
  return String(label || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function getKnownPhaseGroupMatch(label) {
  const normalized = normalizePhaseGroupLabel(label)
  const matchedLabel = PHASE_GROUP_ORDER.find((baseLabel) => (
    normalized === baseLabel || normalized.startsWith(`${baseLabel} `)
  ))
  return matchedLabel || ''
}

function formatKnownPhaseGroupLabel(groupKey) {
  switch (String(groupKey || '').toLowerCase()) {
    case 'team':
      return 'Team'
    case 'gtd':
      return 'GTD'
    case 'og communities':
      return 'OG Communities'
    case 'fcfs':
      return 'FCFS'
    case 'public':
      return 'Public'
    default:
      return String(groupKey || '').trim()
  }
}

function groupPhasesForDisplay(phases = []) {
  const phaseEntries = phases.map((phase) => ({
    phase,
    ...getPhaseDisplayParts(phase),
  }))

  const hasGroupedEntries = phaseEntries.some((entry) => entry.grouped)
  const hasKnownStandaloneEntries = phaseEntries.some((entry) => !entry.grouped && Boolean(getKnownPhaseGroupMatch(entry.fullLabel)))

  if (!hasGroupedEntries && !hasKnownStandaloneEntries) {
    return [{ key: 'all-phases', label: '', items: phaseEntries }]
  }

  const grouped = []
  const keyToIndex = new Map()
  phaseEntries.forEach((entry) => {
    const knownStandaloneGroup = !entry.grouped ? getKnownPhaseGroupMatch(entry.fullLabel) : ''
    const groupLabel = entry.grouped
      ? entry.groupLabel
      : knownStandaloneGroup
        ? formatKnownPhaseGroupLabel(knownStandaloneGroup)
        : 'Other Phases'
    const groupKey = groupLabel.toLowerCase()
    if (!keyToIndex.has(groupKey)) {
      keyToIndex.set(groupKey, grouped.length)
      grouped.push({
        key: `${groupKey}-${grouped.length}`,
        label: groupLabel,
        items: [],
      })
    }
    grouped[keyToIndex.get(groupKey)].items.push(entry)
  })

  return grouped
}

function formatAdminLogTime(timestamp) {
  if (!timestamp) return 'Unknown time'
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return 'Unknown time'
  }
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat().format(Math.round(Number(value || 0)))
}

function formatRate(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return '0%'
  return `${amount.toFixed(amount >= 10 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}%`
}

function formatGameDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)))
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function formatGameIdentityLabel(entry) {
  if (!entry) return 'No player yet'
  return entry.xUsername || shortAddress(entry.walletAddress || '') || 'Anonymous'
}

function isRpcQuotaExceededError(error) {
  const message = String(error?.message || error?.reason || '')
  const code = Number(error?.code)
  return (
    code === -32001 ||
    /quota/i.test(message) ||
    /rate limit/i.test(message) ||
    /too many requests/i.test(message) ||
    /exceeded the quota usage/i.test(message)
  )
}

function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)))
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clampColor(value).toString(16).padStart(2, '0')).join('')}`
}

function hexToRgb(hex) {
  const normalized = String(hex || '').trim().replace('#', '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return { r: 140, g: 230, b: 255 }
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  const normalizedAlpha = Math.max(0, Math.min(1, Number(alpha) || 0))
  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`
}

function mixHex(hexA, hexB, weight = 0.5) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const ratio = Math.max(0, Math.min(1, Number(weight) || 0))
  return rgbToHex(
    a.r + ((b.r - a.r) * ratio),
    a.g + ((b.g - a.g) * ratio),
    a.b + ((b.b - a.b) * ratio)
  )
}

function rgbToHsl(r, g, b) {
  const nr = clampColor(r) / 255
  const ng = clampColor(g) / 255
  const nb = clampColor(b) / 255
  const max = Math.max(nr, ng, nb)
  const min = Math.min(nr, ng, nb)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case nr:
        h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6
        break
      case ng:
        h = ((nb - nr) / d + 2) / 6
        break
      default:
        h = ((nr - ng) / d + 4) / 6
        break
    }
  }

  return { h, s, l }
}

function hslToRgb(h, s, l) {
  const hue = ((Number(h) % 1) + 1) % 1
  const sat = Math.max(0, Math.min(1, Number(s) || 0))
  const light = Math.max(0, Math.min(1, Number(l) || 0))

  if (sat === 0) {
    const value = clampColor(light * 255)
    return { r: value, g: value, b: value }
  }

  const hueToRgb = (p, q, t) => {
    let next = t
    if (next < 0) next += 1
    if (next > 1) next -= 1
    if (next < 1 / 6) return p + (q - p) * 6 * next
    if (next < 1 / 2) return q
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
    return p
  }

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  return {
    r: clampColor(hueToRgb(p, q, hue + 1 / 3) * 255),
    g: clampColor(hueToRgb(p, q, hue) * 255),
    b: clampColor(hueToRgb(p, q, hue - 1 / 3) * 255),
  }
}

function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l)
  return rgbToHex(r, g, b)
}

async function extractPlaceholderPalette(imageSrc) {
  if (!imageSrc || typeof window === 'undefined') {
    return {
      accent: '#8ce6ff',
      accentSoft: '#c8f3ff',
      accentDeep: '#204e63',
      panel: '#0e1c28',
      ink: '#eff7ff',
    }
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 36
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          resolve({
            accent: '#8ce6ff',
            accentSoft: '#c8f3ff',
            accentDeep: '#204e63',
            panel: '#0e1c28',
            ink: '#eff7ff',
          })
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        const buckets = new Map()
        let darkRed = 0
        let darkGreen = 0
        let darkBlue = 0
        let darkCount = 0
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3]
          if (alpha < 180) continue
          const red = data[i]
          const green = data[i + 1]
          const blue = data[i + 2]
          const { h, s, l } = rgbToHsl(red, green, blue)
          const brightness = (red * 0.299) + (green * 0.587) + (blue * 0.114)

          if (brightness < 70) {
            darkRed += red
            darkGreen += green
            darkBlue += blue
            darkCount += 1
          }

          if (brightness < 55 || brightness > 240) continue
          const hueBucket = Math.round(h * 24)
          const satBucket = Math.round(s * 6)
          const lightBucket = Math.round(l * 6)
          const key = `${hueBucket}-${satBucket}-${lightBucket}`
          const weight = (s * 1.9) + (brightness / 255) + 0.25
          const existing = buckets.get(key) || { r: 0, g: 0, b: 0, score: 0, count: 0 }
          existing.r += red
          existing.g += green
          existing.b += blue
          existing.score += weight
          existing.count += 1
          buckets.set(key, existing)
        }
        if (!buckets.size) {
          resolve({
            accent: '#8ce6ff',
            accentSoft: '#c8f3ff',
            accentDeep: '#204e63',
            panel: '#0e1c28',
            ink: '#eff7ff',
          })
          return
        }

        let best = null
        buckets.forEach((entry) => {
          if (!best || entry.score > best.score) best = entry
        })

        const baseR = best.r / best.count
        const baseG = best.g / best.count
        const baseB = best.b / best.count
        const baseHsl = rgbToHsl(baseR, baseG, baseB)
        const accent = rgbToHex(baseR, baseG, baseB)
        const accentSoft = hslToHex(baseHsl.h, Math.max(0.42, baseHsl.s * 0.82), Math.min(0.82, Math.max(0.68, baseHsl.l + 0.2)))
        const accentDeep = hslToHex(baseHsl.h, Math.max(0.38, baseHsl.s * 0.9), Math.max(0.24, Math.min(0.38, baseHsl.l * 0.62)))
        const panelBase = darkCount
          ? rgbToHex(darkRed / darkCount, darkGreen / darkCount, darkBlue / darkCount)
          : mixHex(accentDeep, '#081119', 0.65)
        const panel = mixHex(panelBase, '#081119', 0.38)

        resolve({
          accent,
          accentSoft,
          accentDeep,
          panel,
          ink: '#f4fbff',
        })
      } catch {
        resolve({
          accent: '#8ce6ff',
          accentSoft: '#c8f3ff',
          accentDeep: '#204e63',
          panel: '#0e1c28',
          ink: '#eff7ff',
        })
      }
    }
    img.onerror = () => resolve({
      accent: '#8ce6ff',
      accentSoft: '#c8f3ff',
      accentDeep: '#204e63',
      panel: '#0e1c28',
      ink: '#eff7ff',
    })
    img.src = imageSrc
  })
}

function getStatusTone(status) {
  const text = String(status || '').toLowerCase()
  if (!text) return ''
  if (text.includes('error') || text.includes('failed') || text.includes('invalid') || text.includes('rejected')) return 'error'
  if (text.includes('complete') || text.includes('updated') || text.includes('saved') || text.includes('removed') || text.includes('reset')) return 'success'
  if (text.includes('confirming') || text.includes('loading') || text.includes('preparing') || text.includes('uploading') || text.includes('submitting') || text.includes('withdrawing') || text.includes('revealing') || text.includes('saving') || text.includes('updating') || text.includes('transferring') || text.includes('pausing') || text.includes('activating') || text.includes('finalizing')) return 'pending'
  if (
    text.includes('no ') ||
    text.includes('select ') ||
    text.includes('connect ') ||
    text.includes('pause mint') ||
    text.includes('sell out') ||
    text.includes('switch to') ||
    text.includes('not configured')
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

function formatAdminStatusMessage(status) {
  const raw = String(status || '').trim()
  if (!raw) return ''
  const noErrorPrefix = raw.replace(/^Error:\s*/i, '').trim()
  const normalized = noErrorPrefix.toLowerCase()

  const exactMap = {
    'install metamask': 'Install MetaMask to continue',
    'connection failed': 'Wallet connection failed. Try again',
    'wallet disconnected': 'Wallet disconnected',
    'connect wallet first': 'Connect your wallet to continue',
    'contract address is not configured': 'Contract address is not configured',
    'connected wallet is not the contract owner': 'Connected wallet is not the contract owner',
    'load game stats first': 'Load game stats before exporting',
    'admin session authorized': 'Admin session authorized',
    'admin activity log cleared': 'Admin activity log cleared',
    'admin activity log clear cancelled': 'Admin activity log clear canceled',
    'admin activity log exported': 'Admin activity log exported',
  }

  if (Object.prototype.hasOwnProperty.call(exactMap, normalized)) {
    return ensureMessagePunctuation(exactMap[normalized])
  }

  if (/^error:/i.test(raw)) {
    return ensureMessagePunctuation(`Action failed: ${noErrorPrefix}`)
  }

  return ensureMessagePunctuation(noErrorPrefix)
}

function notifyContractUpdated(source = 'admin') {
  const payload = { ts: Date.now(), source }
  try {
    localStorage.setItem('penguin:contract-updated', JSON.stringify(payload))
  } catch {
    // Ignore storage issues; the in-page event still propagates updates.
  }
  try {
    window.dispatchEvent(new CustomEvent('penguin:contract-updated', { detail: payload }))
  } catch {
    // Ignore event dispatch issues outside the browser.
  }
}

function FieldLabel({ label, children }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      {children}
    </label>
  )
}

function addMinutesToDatetimeLocal(value, minutes) {
  if (!value) return ''
  const base = new Date(value)
  if (Number.isNaN(base.getTime())) return ''
  base.setMinutes(base.getMinutes() + minutes)
  const offsetMs = base.getTimezoneOffset() * 60000
  return new Date(base.getTime() - offsetMs).toISOString().slice(0, 16)
}

function normalizeWhitelistAddress(value) {
  const trimmed = String(value || '').trim()
  return ethers.isAddress(trimmed) ? ethers.getAddress(trimmed) : null
}

function getAdminContractAddress() {
  return normalizeWhitelistAddress(CONTRACT_ADDRESS)
}

function parseUintList(value) {
  const rawEntries = String(value || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (!rawEntries.length) {
    return { values: [], error: 'Enter at least one value' }
  }

  const values = []
  for (const entry of rawEntries) {
    if (!/^\d+$/.test(entry)) {
      return { values: [], error: `Invalid integer: ${entry}` }
    }
    values.push(BigInt(entry))
  }

  return { values, error: '' }
}

function extractAddressMatches(value) {
  const text = String(value || '').trim()
  if (!text) {
    return { valid: [], invalidLikeCount: 0 }
  }

  const valid = []
  const exact = normalizeWhitelistAddress(text)
  if (exact) {
    valid.push(exact)
  } else {
    const regexMatches = text.match(/0x[a-fA-F0-9]{40}/g) || []
    regexMatches.forEach((match) => {
      const normalized = normalizeWhitelistAddress(match)
      if (normalized) valid.push(normalized)
    })
  }

  let invalidLikeCount = 0
  const invalidCandidates = text.match(/0x[a-zA-Z0-9]{1,}/g) || []
  invalidCandidates.forEach((candidate) => {
    if (!normalizeWhitelistAddress(candidate)) {
      invalidLikeCount += 1
    }
  })

  return { valid, invalidLikeCount }
}

function extractAddressesFromRows(rows) {
  const collected = []
  let invalidLikeCount = 0

  rows.forEach((row) => {
    const cells = Array.isArray(row) ? row : [row]
    cells.forEach((cell) => {
      const result = extractAddressMatches(cell)
      collected.push(...result.valid)
      invalidLikeCount += result.invalidLikeCount
    })
  })

  const duplicateCount = Math.max(0, collected.length - new Set(collected).size)
  return {
    addresses: Array.from(new Set(collected)),
    duplicateCount,
    invalidLikeCount,
  }
}

function extractAddressesFromWorkbook(workbook) {
  const allRows = workbook.SheetNames.flatMap((sheetName) => (
    XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' })
  ))
  return extractAddressesFromRows(allRows)
}

function buildGoogleSheetExportUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim()
  if (!trimmed) throw new Error('Enter a Google Sheets URL')

  const url = new URL(trimmed)
  const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error('Enter a valid Google Sheets URL')
  }

  const hashGidMatch = url.hash.match(/gid=(\d+)/)
  const gid = url.searchParams.get('gid') || hashGidMatch?.[1] || '0'
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`
}

function mergeWhitelistDraft(existingDraft, importedAddresses) {
  return analyzeAddressList([existingDraft, importedAddresses.join('\n')].filter(Boolean).join('\n')).valid.join('\n')
}

const INCLUDED_RARITY_TRAITS = ['Background', 'Body', 'Belly', 'Beak', 'Eyes', 'Head', 'Feet']
const RARITY_READ_BATCH_SIZE = 200
const RARITY_WRITE_BATCH_SIZE = 100
const PHASE_WHITELIST_WRITE_BATCH_SIZE = 100

function chunkRange(start, end) {
  const ids = []
  for (let i = start; i <= end; i += 1) ids.push(i)
  return ids
}

function parseRarityAttributes(raw, tokenId) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Token ${tokenId}: failed to parse token attributes`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Token ${tokenId}: token attributes is not an array`)
  }

  const traits = new Map()
  parsed.forEach((entry) => {
    const traitType = String(entry?.trait_type || '').trim()
    const value = String(entry?.value || '').trim()
    if (INCLUDED_RARITY_TRAITS.includes(traitType) && value) {
      traits.set(traitType, value)
    }
  })

  INCLUDED_RARITY_TRAITS.forEach((traitType) => {
    if (!traits.has(traitType)) {
      throw new Error(`Token ${tokenId}: missing trait "${traitType}"`)
    }
  })

  return traits
}

function parseRarityTraitsFromMetadata(raw, tokenId) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Token ${tokenId}: failed to parse token metadata`)
  }
  return parseRarityAttributes(JSON.stringify(parsed?.attributes || []), tokenId)
}

async function loadRarityTraitsForToken(contract, tokenId) {
  const rawAttributes = await contract.tokenAttributes(tokenId)
  if (rawAttributes && String(rawAttributes).trim()) {
    return parseRarityAttributes(rawAttributes, tokenId)
  }
  const metadataJson = await contract.tokenMetadataJson(tokenId)
  return parseRarityTraitsFromMetadata(metadataJson, tokenId)
}

function buildRarityFrequencyMap(tokenTraits) {
  const counts = new Map()
  tokenTraits.forEach(({ traits }) => {
    INCLUDED_RARITY_TRAITS.forEach((traitType) => {
      const value = traits.get(traitType)
      const key = `${traitType}::${value}`
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  })
  return counts
}

function calculateRarityScores(tokenTraits, counts, supply) {
  return tokenTraits.map(({ tokenId, traits }) => {
    let score = 0
    INCLUDED_RARITY_TRAITS.forEach((traitType) => {
      const value = traits.get(traitType)
      const count = counts.get(`${traitType}::${value}`)
      if (!count) {
        throw new Error(`Token ${tokenId}: missing frequency count for ${traitType}=${value}`)
      }
      score += -Math.log(count / supply)
    })
    return { tokenId, score: Math.round(score * 1000) }
  })
}

function buildRarityRanks(scoredTokens) {
  const sorted = [...scoredTokens].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.tokenId - b.tokenId
  })

  const ranks = new Map()
  sorted.forEach((item, index) => {
    ranks.set(item.tokenId, index + 1)
  })
  return { sorted, ranks }
}

function analyzeAddressList(value) {
  const rawEntries = String(value || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  const normalized = []
  const invalid = []
  const duplicate = []
  const seen = new Set()

  rawEntries.forEach((entry) => {
    const parsed = normalizeWhitelistAddress(entry)
    if (!parsed) {
      invalid.push(entry)
      return
    }
    if (seen.has(parsed)) {
      duplicate.push(parsed)
      return
    }
    seen.add(parsed)
    normalized.push(parsed)
  })

  return {
    totalEntries: rawEntries.length,
    valid: normalized,
    invalid,
    duplicate,
  }
}

async function safeRead(call, fallback) {
  return resilientRpcCall(call, {
    timeoutMs: 12000,
    retries: 2,
    fallback,
  })
}

async function readWithTimeout(call, timeoutMs = 12000) {
  return resilientRpcCall(call, {
    timeoutMs,
    retries: 2,
  })
}

async function readLogsWithRpcFallback(filter, rpcUrls, timeoutMs = 12000) {
  const urls = Array.isArray(rpcUrls) ? rpcUrls : []
  for (const url of urls) {
    const trimmed = String(url || '').trim()
    if (!trimmed) continue
    try {
      const provider = new ethers.JsonRpcProvider(trimmed)
      const logs = await resilientRpcCall(() => provider.getLogs(filter), {
        timeoutMs,
        retries: 2,
      })
      if (Array.isArray(logs)) return logs
    } catch {
      // Try next RPC.
    }
  }
  throw new Error('All RPC log readers failed')
}

async function readBlockNumberWithRpcFallback(rpcUrls, timeoutMs = 12000) {
  const urls = Array.isArray(rpcUrls) ? rpcUrls : []
  for (const url of urls) {
    const trimmed = String(url || '').trim()
    if (!trimmed) continue
    try {
      const provider = new ethers.JsonRpcProvider(trimmed)
      const blockNumber = await resilientRpcCall(() => provider.getBlockNumber(), {
        timeoutMs,
        retries: 2,
      })
      if (Number.isInteger(Number(blockNumber)) && Number(blockNumber) >= 0) {
        return Number(blockNumber)
      }
    } catch {
      // Try next RPC.
    }
  }
  throw new Error('Failed to read latest block number from RPCs')
}

function sortLogsNewestFirst(logs) {
  return [...logs].sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return b.blockNumber - a.blockNumber
    if (a.transactionIndex !== b.transactionIndex) return b.transactionIndex - a.transactionIndex
    return b.index - a.index
  })
}

async function rebuildPhaseWhitelistFromRpcLogs(contractAddress, phaseId, targetActiveCount, rpcUrls) {
  const normalizedContract = normalizeWhitelistAddress(contractAddress)
  if (!normalizedContract) throw new Error('Invalid contract address')

  const phaseTopic = ethers.zeroPadValue(ethers.toBeHex(BigInt(phaseId)), 32)
  const targetCount = Math.max(0, Number(targetActiveCount || 0))
  if (targetCount === 0) return []

  const latest = await readBlockNumberWithRpcFallback(rpcUrls, 10000)
  const step = 10000
  const maxRounds = 700

  const seen = new Set()
  const active = new Set()

  let rounds = 0
  for (let toBlock = latest; toBlock >= 0 && rounds < maxRounds; toBlock -= step) {
    rounds += 1
    const fromBlock = Math.max(0, toBlock - step + 1)
    const logs = await readLogsWithRpcFallback(
      {
        address: normalizedContract,
        fromBlock,
        toBlock,
        topics: [PHASE_WHITELIST_EVENT_TOPIC, phaseTopic],
      },
      rpcUrls,
      12000
    )

    const ordered = sortLogsNewestFirst(logs)
    for (const log of ordered) {
      const topic = log?.topics?.[2]
      if (!topic || String(topic).length < 42) continue

      const account = normalizeWhitelistAddress(`0x${String(topic).slice(-40)}`)
      if (!account || seen.has(account)) continue

      seen.add(account)
      let allowed = false
      try {
        allowed = BigInt(String(log?.data || '0x0')) !== 0n
      } catch {
        allowed = false
      }

      if (allowed) {
        active.add(account)
      }

      if (active.size >= targetCount) {
        return Array.from(active).sort((a, b) => a.localeCompare(b))
      }
    }

    if (toBlock === 0) break
  }

  return Array.from(active).sort((a, b) => a.localeCompare(b))
}

function normalizeConnectedAddress(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  try {
    return ethers.getAddress(trimmed)
  } catch {
    return trimmed
  }
}

function Admin() {
  const rpcProvider = useMemo(() => getSharedReadProvider(), [])
  const contractAddress = useMemo(() => getAdminContractAddress(), [])
  const [account, setAccount] = useState(null)
  const [owner, setOwner] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [status, setStatus] = useState('')
  const [lastTxHash, setLastTxHash] = useState('')
  const [activityLog, setActivityLog] = useState([])
  const [adminSessionToken, setAdminSessionToken] = useState('')
  const [adminSessionExpiryMs, setAdminSessionExpiryMs] = useState(0)
  const adminSessionPromiseRef = useRef(null)
  const [gameStats, setGameStats] = useState(() => createEmptyGameStats())
  const [gameStatsPeriod, setGameStatsPeriod] = useState('all')
  const [gameStatsPalette, setGameStatsPalette] = useState({
    accent: '#8ce6ff',
    accentSoft: '#c8f3ff',
    accentDeep: '#204e63',
    panel: '#0e1c28',
    ink: '#eff7ff',
  })
  const [isGameStatsLoading, setIsGameStatsLoading] = useState(false)
  const [gameStatsError, setGameStatsError] = useState('')
  const gameStatsRequestRef = useRef(0)
  const gameStatsInFlightRef = useRef(false)
  const gameStatsRefreshDelayRef = useRef(GAME_STATS_REFRESH_MS)
  const gameStatsRefreshTimerRef = useRef(null)
  const [isBusy, setIsBusy] = useState(false)
  const [activeBusyAction, setActiveBusyAction] = useState('')
  const [state, setState] = useState({
    totalSupply: 0,
    maxSupply: 0,
    maxPerWallet: 0,
    mintPriceEth: '0',
    evolveFeeEth: '0',
    evolveFeeToken: '',
    evolveFeeTokenAmountUsdc: '0',
    evolveFeeReceiver: '',
    mintActive: false,
    revealed: false,
    rarityFinalized: false,
    contractBalance: '0.0000',
    placeholderImage: '',
    royaltyReceiver: '',
    royaltyFeeBps: 0,
  })
  const [placeholderDraft, setPlaceholderDraft] = useState('')
  const [ownershipDraft, setOwnershipDraft] = useState('')
  const [globalPriceDraft, setGlobalPriceDraft] = useState('0')
  const [globalEvolveFeeUsdcDraft, setGlobalEvolveFeeUsdcDraft] = useState('0')
  const [globalEvolveFeeReceiverDraft, setGlobalEvolveFeeReceiverDraft] = useState('')
  const [isUploadingPlaceholderToPinata, setIsUploadingPlaceholderToPinata] = useState(false)
  const [globalSupplyDraft, setGlobalSupplyDraft] = useState('0')
  const [globalWalletDraft, setGlobalWalletDraft] = useState('0')
  const [royaltyReceiverDraft, setRoyaltyReceiverDraft] = useState('')
  const [royaltyFeeDraft, setRoyaltyFeeDraft] = useState('0')
  const [googleSheetUrlDraft, setGoogleSheetUrlDraft] = useState('')
  const [rarityTokenIdsDraft, setRarityTokenIdsDraft] = useState('')
  const [rarityScoresDraft, setRarityScoresDraft] = useState('')
  const [rarityRanksDraft, setRarityRanksDraft] = useState('')
  const [rarityPreview, setRarityPreview] = useState([])
  const [taskPinnedPostDraft, setTaskPinnedPostDraft] = useState(() => getTaskPinnedPostLink())
  const [tokenIdInput, setTokenIdInput] = useState('')
  const [tokenInspect, setTokenInspect] = useState(null)
  const [walletInspectInput, setWalletInspectInput] = useState('')
  const [walletInspect, setWalletInspect] = useState(null)
  const [phases, setPhases] = useState([])
  const [phaseDisplayOrder, setPhaseDisplayOrder] = useState(() => readStoredPhaseOrder(getAdminContractAddress()))
  const [draggingPhaseId, setDraggingPhaseId] = useState(null)
  const [expandedPhaseGroups, setExpandedPhaseGroups] = useState({})
  const [currentPhaseId, setCurrentPhaseId] = useState(null)
  const [supportsPhaseControls, setSupportsPhaseControls] = useState(false)
  const [supportsGlobalSetters, setSupportsGlobalSetters] = useState(false)
  const [supportsEvolveFeeControls, setSupportsEvolveFeeControls] = useState(false)
  const [supportsEvolveFeeReceiverControls, setSupportsEvolveFeeReceiverControls] = useState(false)
  const [supportsEvolveFeeTokenControls, setSupportsEvolveFeeTokenControls] = useState(false)
  const [supportsRoyaltyControls, setSupportsRoyaltyControls] = useState(false)
  const [phaseGapMinutes, setPhaseGapMinutes] = useState('5')
  const [phaseDurationMinutes, setPhaseDurationMinutes] = useState('60')
  const [activeTab, setActiveTab] = useState('controls')
  const [whitelistDraft, setWhitelistDraft] = useState('')
  const [whitelistDraftSource, setWhitelistDraftSource] = useState('')
  const [selectedWhitelistPhaseId, setSelectedWhitelistPhaseId] = useState('')
  const [phaseWhitelistAddresses, setPhaseWhitelistAddresses] = useState([])
  const [phaseWhitelistCounts, setPhaseWhitelistCounts] = useState({})
  const [phaseWhitelistMinted, setPhaseWhitelistMinted] = useState({})
  const [isWhitelistLoading, setIsWhitelistLoading] = useState(false)
  const [whitelistLoadError, setWhitelistLoadError] = useState('')
  const [whitelistSearch, setWhitelistSearch] = useState('')
  const [whitelistPage, setWhitelistPage] = useState(1)
  const [whitelistVersion, setWhitelistVersion] = useState(0)
  const whitelistFileInputRef = useRef(null)
  const phaseWhitelistCacheRef = useRef({})
  const accountRef = useRef(null)
  const statusMessage = useMemo(() => formatAdminStatusMessage(status), [status])
  const [phaseGroupRenameDrafts, setPhaseGroupRenameDrafts] = useState({})
  const [phaseDraft, setPhaseDraft] = useState({
    phaseId: '',
    groupTitle: '',
    title: '',
    priceEth: '0',
    startAt: '',
    endAt: '',
    maxSupply: '0',
    maxPerWallet: '0',
    enabled: true,
  })
  const placeholderDraftTrimmed = String(placeholderDraft || '').trim()
  const placeholderDraftCharCount = placeholderDraftTrimmed.length
  const placeholderOverSoftLimit = placeholderDraftCharCount > PLACEHOLDER_ONCHAIN_SOFT_LIMIT_CHARS
  const placeholderPreviewSource = useMemo(() => (
    normalizeOnchainImage(String(placeholderDraft || state.placeholderImage || '').trim())
  ), [placeholderDraft, state.placeholderImage])
  const premiumPlaceholderPreset = useMemo(() => createPremiumPlaceholderDataUri(), [])
  const evolveFeeUsdcInputValid = useMemo(() => isValidUsdcDraft(globalEvolveFeeUsdcDraft), [globalEvolveFeeUsdcDraft])
  const evolveFeeUsdcParsed = useMemo(() => {
    try {
      const feeUnits = usdcDraftToUnits(globalEvolveFeeUsdcDraft)
      return {
        feeUnits,
        feeLabel: usdcUnitsToDraft(feeUnits),
        error: '',
      }
    } catch (error) {
      return {
        feeUnits: 0n,
        feeLabel: '0',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }, [globalEvolveFeeUsdcDraft])

  const signAdminMaintenancePayload = useCallback(async (action) => {
    if (!window.ethereum) {
      throw new Error('Wallet provider not found')
    }
    const normalizedAccount = normalizeConnectedAddress(account)
    if (!normalizedAccount) {
      throw new Error('Connect wallet first')
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const signerAddress = normalizeConnectedAddress(await signer.getAddress())
    if (!signerAddress || signerAddress !== normalizedAccount) {
      throw new Error('Wallet mismatch. Reconnect and try again.')
    }

    const issuedAt = Date.now()
    const signedHost = typeof window !== 'undefined' ? window.location.host : ''
    const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${issuedAt}-${Math.random().toString(36).slice(2, 10)}`
    const message = [
      ADMIN_MAINTENANCE_SIGN_PREFIX,
      `Action:${action}`,
      `Address:${normalizedAccount}`,
      `ChainId:${CHAIN_ID_HEX}`,
      `Contract:${contractAddress || ''}`,
      `Host:${signedHost}`,
      `IssuedAt:${issuedAt}`,
      `Nonce:${nonce}`,
    ].join('\n')
    const signature = await signer.signMessage(message)

    return {
      action,
      address: normalizedAccount,
      issuedAt,
      nonce,
      message,
      signature,
    }
  }, [account, contractAddress])

  const signAdminSessionPayload = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error('Wallet provider not found')
    }
    const normalizedAccount = normalizeConnectedAddress(account)
    if (!normalizedAccount) {
      throw new Error('Connect wallet first')
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const signerAddress = normalizeConnectedAddress(await signer.getAddress())
    if (!signerAddress || signerAddress !== normalizedAccount) {
      throw new Error('Wallet mismatch. Reconnect and try again.')
    }

    const issuedAt = Date.now()
    const signedHost = typeof window !== 'undefined' ? window.location.host : ''
    const nonce = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${issuedAt}-${Math.random().toString(36).slice(2, 10)}`
    const message = [
      ADMIN_SESSION_SIGN_PREFIX,
      `Address:${normalizedAccount}`,
      `ChainId:${CHAIN_ID_HEX}`,
      `Contract:${contractAddress || ''}`,
      `Host:${signedHost}`,
      `IssuedAt:${issuedAt}`,
      `Nonce:${nonce}`,
    ].join('\n')
    const signature = await signer.signMessage(message)

    return {
      address: normalizedAccount,
      issuedAt,
      nonce,
      message,
      signature,
    }
  }, [account, contractAddress])

  const ensureAdminSession = useCallback(async ({ allowPrompt = true } = {}) => {
    const now = Date.now()
    if (adminSessionToken && (adminSessionExpiryMs - now) > ADMIN_SESSION_REFRESH_BUFFER_MS) {
      return adminSessionToken
    }
    if (!account || !isOwner) {
      throw new Error('Connect the owner wallet first')
    }
    if (!allowPrompt) {
      throw new Error('Admin session unavailable')
    }
    if (adminSessionPromiseRef.current) {
      return adminSessionPromiseRef.current
    }

    const request = (async () => {
      const payload = await signAdminSessionPayload()
      const response = await fetch(ADMIN_SESSION_API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) {
        throw new Error(String(data?.error || `Admin session failed (${response.status})`))
      }

      const token = String(data?.token || '').trim()
      const expiresInSec = Math.max(0, Number(data?.expiresInSec || 0))
      if (!token || expiresInSec <= 0) {
        throw new Error('Invalid admin session response')
      }
      setAdminSessionToken(token)
      setAdminSessionExpiryMs(Date.now() + (expiresInSec * 1000))
      return token
    })().finally(() => {
      adminSessionPromiseRef.current = null
    })

    adminSessionPromiseRef.current = request
    return request
  }, [account, adminSessionExpiryMs, adminSessionToken, isOwner, signAdminSessionPayload])

  const callAdminDataAction = useCallback(async (action, payload = {}, options = {}) => {
    const token = await ensureAdminSession(options)
    const response = await fetch(ADMIN_DATA_API_PATH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        ...payload,
      }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) {
      if (response.status === 401 || response.status === 403) {
        setAdminSessionToken('')
        setAdminSessionExpiryMs(0)
      }
      throw new Error(String(data?.error || `Admin data action failed (${response.status})`))
    }
    return data
  }, [ensureAdminSession])

  const callAdminMaintenanceAction = useCallback(async (action) => {
    const payload = await signAdminMaintenancePayload(action)
    const response = await fetch(ADMIN_MAINTENANCE_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.ok === false) {
      throw new Error(String(data?.error || `Admin action failed (${response.status})`))
    }
    return data
  }, [signAdminMaintenancePayload])

  const syncState = useCallback(async (walletAddress = null) => {
    if (!contractAddress) {
      setOwner('')
      setIsOwner(false)
      setSupportsEvolveFeeControls(false)
      setSupportsEvolveFeeReceiverControls(false)
      setSupportsEvolveFeeTokenControls(false)
      setSupportsRoyaltyControls(false)
      setStatus('Error: contract address is not configured')
      return
    }

    try {
      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, rpcProvider)
      const unsupported = Symbol('unsupported')
      const [contractOwner, totalSupply, maxSupply, maxPerWallet, mintPrice, mintActive, revealed, rarityFinalized, placeholderImage, contractBalance, evolveFeeRaw, evolveFeeReceiverRaw, evolveFeeTokenRaw, evolveFeeTokenAmountRaw, royaltyReceiverRaw, royaltyFeeBpsRaw] = await Promise.all([
        contract.owner(),
        contract.totalSupply(),
        contract.MAX_SUPPLY(),
        contract.MAX_PER_WALLET(),
        contract.mintPrice(),
        contract.mintActive(),
        contract.revealed(),
        safeRead(() => contract.rarityFinalized(), false),
        contract.placeholderImage(),
        rpcProvider.getBalance(contractAddress),
        safeRead(() => contract.evolveFee(), unsupported),
        safeRead(() => contract.evolveFeeReceiver(), unsupported),
        safeRead(() => contract.evolveFeeToken(), unsupported),
        safeRead(() => contract.evolveFeeTokenAmount(), unsupported),
        safeRead(() => contract.royaltyReceiver(), unsupported),
        safeRead(() => contract.royaltyFeeBps(), unsupported),
      ])

      const normalizedOwner = normalizeConnectedAddress(contractOwner)
      const normalizedWallet = normalizeConnectedAddress(walletAddress)
      const evolveFeeSupported = evolveFeeRaw !== unsupported
      const evolveFeeValue = evolveFeeSupported ? evolveFeeRaw : 0n
      const evolveFeeReceiverSupported = evolveFeeReceiverRaw !== unsupported
      const evolveFeeReceiver = evolveFeeReceiverSupported && normalizeWhitelistAddress(evolveFeeReceiverRaw)
        ? normalizeWhitelistAddress(evolveFeeReceiverRaw)
        : ''
      const evolveFeeTokenSupported = evolveFeeTokenRaw !== unsupported && evolveFeeTokenAmountRaw !== unsupported
      const evolveFeeToken = evolveFeeTokenSupported && normalizeWhitelistAddress(evolveFeeTokenRaw)
        ? normalizeWhitelistAddress(evolveFeeTokenRaw)
        : ''
      const evolveFeeTokenAmount = evolveFeeTokenSupported ? BigInt(evolveFeeTokenAmountRaw || 0n) : 0n
      const royaltySupported = royaltyReceiverRaw !== unsupported && royaltyFeeBpsRaw !== unsupported
      const royaltyReceiver = royaltySupported && normalizeWhitelistAddress(royaltyReceiverRaw)
        ? normalizeWhitelistAddress(royaltyReceiverRaw)
        : ''
      const royaltyFeeBps = royaltySupported ? Number(royaltyFeeBpsRaw || 0) : 0

      setOwner(normalizedOwner || contractOwner)
      setIsOwner(Boolean(normalizedWallet) && normalizedOwner === normalizedWallet)
      setSupportsEvolveFeeControls(evolveFeeSupported)
      setSupportsEvolveFeeReceiverControls(evolveFeeReceiverSupported)
      setSupportsEvolveFeeTokenControls(evolveFeeTokenSupported)
      setSupportsRoyaltyControls(royaltySupported)
      setState({
        totalSupply: Number(totalSupply),
        maxSupply: Number(maxSupply),
        maxPerWallet: Number(maxPerWallet),
        mintPriceEth: ethers.formatEther(mintPrice),
        evolveFeeEth: ethers.formatEther(evolveFeeValue),
        evolveFeeToken: evolveFeeToken || '',
        evolveFeeTokenAmountUsdc: usdcUnitsToDraft(evolveFeeTokenAmount),
        evolveFeeReceiver: evolveFeeReceiver || '',
        mintActive,
        revealed,
        rarityFinalized,
        contractBalance: formatEth(contractBalance),
        placeholderImage,
        royaltyReceiver: royaltyReceiver || '',
        royaltyFeeBps: royaltyFeeBps || 0,
      })
      setPlaceholderDraft(placeholderImage)
      setGlobalPriceDraft(ethers.formatEther(mintPrice))
      setGlobalEvolveFeeUsdcDraft(usdcUnitsToDraft(evolveFeeTokenAmount))
      setGlobalEvolveFeeReceiverDraft(evolveFeeReceiver || '')
      setGlobalSupplyDraft(String(Number(maxSupply)))
      setGlobalWalletDraft(String(Number(maxPerWallet)))
      setRoyaltyReceiverDraft(royaltyReceiver || '')
      setRoyaltyFeeDraft(String(royaltyFeeBps || 0))

      const [phaseCountRaw, currentPhase] = await Promise.all([
        safeRead(() => contract.phaseCount(), unsupported),
        safeRead(() => contract.currentPhaseId(), unsupported),
      ])

      const phaseApiSupported = phaseCountRaw !== unsupported && currentPhase !== unsupported
      const phaseCount = phaseApiSupported ? Number(phaseCountRaw || 0) : 0
      setSupportsPhaseControls(phaseApiSupported)
      setSupportsGlobalSetters(phaseApiSupported)

      if (phaseCount > 0) {
        const phaseResults = await Promise.all(
          Array.from({ length: phaseCount }, async (_, index) => {
            const [phase, whitelistCount] = await Promise.all([
              contract.getPhase(index),
              safeRead(() => contract.phaseWhitelistCount(index), 0),
            ])
            return {
              id: index,
              name: phase[0],
              price: phase[1],
              startTime: Number(phase[2]),
              endTime: Number(phase[3]),
              maxSupply: Number(phase[4]),
              maxPerWallet: Number(phase[5]),
              minted: Number(phase[6]),
              enabled: Boolean(phase[7]),
              whitelistCount: Number(whitelistCount),
            }
          })
        )
        setPhases(phaseResults)
        setPhaseWhitelistCounts(
          Object.fromEntries(phaseResults.map((phase) => [String(phase.id), phase.whitelistCount || 0]))
        )
      } else {
        setPhases([])
        setPhaseWhitelistCounts({})
      }

      setCurrentPhaseId(phaseApiSupported && (Array.isArray(currentPhase) ? currentPhase[0] : false) ? Number(currentPhase[1]) : null)
    } catch (err) {
      if (isRpcQuotaExceededError(err)) {
        setIsOwner(false)
        setStatus('Error: RPC quota exceeded on one endpoint. Retrying across fallbacks; refresh in 3-5 seconds.')
        return
      }
      setIsOwner(false)
      setSupportsEvolveFeeControls(false)
      setSupportsEvolveFeeReceiverControls(false)
      setSupportsEvolveFeeTokenControls(false)
      setSupportsRoyaltyControls(false)
      setStatus(`Error: ${err.message?.slice(0, 140) || 'Failed to load contract state'}`)
    }
  }, [contractAddress, rpcProvider])

  const inspectToken = useCallback(async () => {
    if (!contractAddress) {
      setStatus('Contract address is not configured')
      return
    }

    const tokenId = Number(tokenIdInput)
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      setStatus('Enter a valid token ID')
      return
    }
    try {
      setActiveBusyAction('inspect-token')
      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, rpcProvider)
      const [tokenOwner, tokenName, evolved, metadataJson] = await Promise.all([
        contract.ownerOf(tokenId),
        contract.tokenName(tokenId),
        contract.tokenEvolved3D(tokenId),
        contract.tokenMetadataJson(tokenId),
      ])
      setTokenInspect({
        tokenId,
        owner: tokenOwner,
        tokenName,
        evolved,
        parsedMetadata: parseMetadata(metadataJson),
      })
      setStatus('')
    } catch (err) {
      setTokenInspect(null)
      setStatus(`Error: ${err.reason || err.message?.slice(0, 140) || 'Token lookup failed'}`)
    } finally {
      setActiveBusyAction('')
    }
  }, [contractAddress, rpcProvider, tokenIdInput])

  useEffect(() => {
    let cancelled = false

    const hydrateWalletState = async () => {
      if (!window.ethereum) {
        await syncState(null)
        return
      }

      const selectedAddress = (
        typeof window.ethereum.selectedAddress === 'string' && window.ethereum.selectedAddress
          ? window.ethereum.selectedAddress
          : (Array.isArray(window.ethereum.accounts) ? window.ethereum.accounts[0] : null)
      )
      const next = normalizeConnectedAddress(selectedAddress) || null
      if (cancelled) return
      setAccount(next)
      await syncState(next)
    }

    hydrateWalletState().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [syncState])

  useEffect(() => {
    accountRef.current = account
  }, [account])

  useEffect(() => {
    if (account && isOwner) return
    adminSessionPromiseRef.current = null
    setAdminSessionToken('')
    setAdminSessionExpiryMs(0)
  }, [account, isOwner])

  const refreshActivityLog = useCallback(async ({ allowPrompt = true } = {}) => {
    const token = await ensureAdminSession({ allowPrompt })
    return fetchAdminActivityLog(token)
  }, [ensureAdminSession])

  useEffect(() => {
    const syncLog = (event) => {
      if (Array.isArray(event?.detail?.entries)) {
        setActivityLog(event.detail.entries)
        return
      }
      if (event?.detail?.entry) {
        setActivityLog((prev) => {
          const next = [event.detail.entry, ...(Array.isArray(prev) ? prev : [])]
          const deduped = next.filter((entry, index, list) => (
            list.findIndex((candidate) => candidate?.id === entry?.id) === index
          ))
          return deduped.slice(0, 200)
        })
      }
    }

    window.addEventListener(ADMIN_ACTIVITY_LOG_EVENT, syncLog)
    return () => {
      window.removeEventListener(ADMIN_ACTIVITY_LOG_EVENT, syncLog)
    }
  }, [])

  useEffect(() => {
    const canViewAdminLog = Boolean(account) && isOwner
    if (!canViewAdminLog) {
      setActivityLog([])
      return undefined
    }

    let cancelled = false

    const loadLog = async () => {
      try {
        const entries = await refreshActivityLog({ allowPrompt: false })
        if (!cancelled) setActivityLog(entries)
      } catch {
        if (!cancelled) setActivityLog([])
      }
    }

    loadLog()
    return () => {
      cancelled = true
    }
  }, [account, isOwner, refreshActivityLog])

  useEffect(() => {
    if (!statusMessage || !account || !isOwner) return
    const appendStatusLog = async () => {
      try {
        const token = await ensureAdminSession({ allowPrompt: false })
        await appendAdminActivityLog({
          level: getStatusTone(statusMessage) || 'info',
          source: 'admin',
          message: statusMessage,
        }, token)
      } catch {
        // Ignore logging failures.
      }
    }
    appendStatusLog()
  }, [statusMessage, account, ensureAdminSession, isOwner])

  useEffect(() => {
    if (!lastTxHash || !account || !isOwner) return
    const appendTxLog = async () => {
      try {
        const token = await ensureAdminSession({ allowPrompt: false })
        await appendAdminActivityLog({
          level: 'info',
          source: 'admin',
          message: 'Transaction submitted',
          txHash: lastTxHash,
        }, token)
      } catch {
        // Ignore logging failures.
      }
    }
    appendTxLog()
  }, [lastTxHash, account, ensureAdminSession, isOwner])

  useEffect(() => {
    if (!window.ethereum) return undefined

    const handleAccountsChanged = (accounts) => {
      const next = normalizeConnectedAddress(accounts?.[0]) || null
      setAccount(next)
      setLastTxHash('')
      adminSessionPromiseRef.current = null
      setAdminSessionToken('')
      setAdminSessionExpiryMs(0)
      syncState(next)
    }

    const handleChainChanged = () => {
      const next = accountRef.current
      if (!next) return
      setLastTxHash('')
      adminSessionPromiseRef.current = null
      setAdminSessionToken('')
      setAdminSessionExpiryMs(0)
      syncState(next)
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)
    window.ethereum.on?.('chainChanged', handleChainChanged)
    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [syncState])

  useEffect(() => {
    if (!String(tokenIdInput || '').trim()) {
      setTokenInspect(null)
    }
  }, [tokenIdInput, inspectToken])

  useEffect(() => {
    let cancelled = false
    const source = normalizeOnchainImage(state.placeholderImage || '')
    if (!source) {
      setGameStatsPalette({
        accent: '#8ce6ff',
        accentSoft: '#c8f3ff',
        accentDeep: '#204e63',
        panel: '#0e1c28',
        ink: '#eff7ff',
      })
      return undefined
    }

    extractPlaceholderPalette(source).then((nextPalette) => {
      if (!cancelled) setGameStatsPalette(nextPalette)
    }).catch(() => {
      if (!cancelled) {
        setGameStatsPalette({
          accent: '#8ce6ff',
          accentSoft: '#c8f3ff',
          accentDeep: '#204e63',
          panel: '#0e1c28',
          ink: '#eff7ff',
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [state.placeholderImage])

  useEffect(() => {
    const loadPhaseWhitelist = async () => {
      if (activeTab !== 'whitelist' || !supportsPhaseControls || selectedWhitelistPhaseId === '') {
        setPhaseWhitelistAddresses([])
        setWhitelistLoadError('')
        setIsWhitelistLoading(false)
        return
      }

      const phaseId = Number(selectedWhitelistPhaseId)
      if (!Number.isInteger(phaseId) || phaseId < 0) {
        setPhaseWhitelistAddresses([])
        setWhitelistLoadError('')
        setIsWhitelistLoading(false)
        return
      }

      if (!contractAddress) {
        setPhaseWhitelistAddresses([])
        setWhitelistLoadError('')
        setIsWhitelistLoading(false)
        return
      }

      setIsWhitelistLoading(true)
      setWhitelistLoadError('')

      try {
        const circuit = getRpcCircuitState()
        if (circuit.isOpen) {
          const cached = phaseWhitelistCacheRef.current[String(phaseId)]
          if (Array.isArray(cached)) {
            setPhaseWhitelistAddresses(cached)
            setWhitelistLoadError('RPC is busy. Showing cached whitelist data; retry in a few seconds.')
            return
          }
          setPhaseWhitelistAddresses([])
          setWhitelistLoadError('RPC is temporarily busy. Retry loading this whitelist in a few seconds.')
          return
        }

        const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, rpcProvider)
        const targetCount = Number(await safeRead(
          () => readWithTimeout(() => contract.phaseWhitelistCount(phaseId), 10000),
          0
        ))

        const reconstructed = await readWithTimeout(
          () => rebuildPhaseWhitelistFromRpcLogs(contractAddress, phaseId, targetCount, ETH_SEPOLIA_RPC_URLS),
          45000
        )

        if (Array.isArray(reconstructed) && (reconstructed.length > 0 || targetCount === 0)) {
          phaseWhitelistCacheRef.current[String(phaseId)] = reconstructed
          setPhaseWhitelistAddresses(reconstructed)
          setWhitelistLoadError(
            targetCount > 0 && reconstructed.length < targetCount
              ? `Loaded ${reconstructed.length} of ${targetCount} wallets. Some wallets may still be loading.`
              : ''
          )
          return
        }

        const addresses = await readWithTimeout(() => contract.getPhaseWhitelist(phaseId), 15000)
        if (!Array.isArray(addresses) || addresses.length === 0) {
          setPhaseWhitelistAddresses([])
          setWhitelistLoadError('')
          return
        }

        const activeFlags = await Promise.all(
          addresses.map((address) => safeRead(() => readWithTimeout(() => contract.isPhaseWhitelisted(phaseId, address), 8000), false))
        )
        setPhaseWhitelistAddresses(
          addresses
            .filter((address, index) => Boolean(activeFlags[index]))
            .map((address) => normalizeWhitelistAddress(address) || address)
        )
        phaseWhitelistCacheRef.current[String(phaseId)] = addresses
          .filter((address, index) => Boolean(activeFlags[index]))
          .map((address) => normalizeWhitelistAddress(address) || address)
        setWhitelistLoadError('')
      } catch {
        const cached = phaseWhitelistCacheRef.current[String(phaseId)]
        if (Array.isArray(cached)) {
          setPhaseWhitelistAddresses(cached)
          setWhitelistLoadError('Could not refresh whitelist from RPC right now. Showing cached data.')
        } else {
          setPhaseWhitelistAddresses([])
          setWhitelistLoadError('Could not fetch the full on-chain whitelist list right now. You can still add or remove wallets by pasting addresses.')
        }
      } finally {
        setIsWhitelistLoading(false)
      }
    }

    loadPhaseWhitelist().catch(() => {
      setPhaseWhitelistAddresses([])
      setWhitelistLoadError('Could not fetch the full on-chain whitelist list right now. You can still add or remove wallets by pasting addresses.')
      setIsWhitelistLoading(false)
    })
  }, [activeTab, selectedWhitelistPhaseId, supportsPhaseControls, whitelistVersion, rpcProvider, contractAddress])

  useEffect(() => {
    setWhitelistSearch('')
    setWhitelistPage(1)
    setPhaseWhitelistMinted({})
  }, [selectedWhitelistPhaseId])

  const clearActivityLog = async () => {
    const confirmed = window.confirm('Clear the admin activity log history?')
    if (!confirmed) {
      setStatus('Admin activity log clear cancelled')
      return
    }
    try {
      const token = await ensureAdminSession()
      await clearAdminActivityLog(token)
      setActivityLog([])
      setStatus('Admin activity log cleared')
    } catch {
      setStatus('Error: failed to clear admin activity log')
    }
  }

  const exportActivityLog = () => {
    try {
      const blob = new Blob([JSON.stringify(activityLog, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `admin-activity-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus('Admin activity log exported')
    } catch {
      setStatus('Error: failed to export admin activity log')
    }
  }

  const fetchGameStatsSummary = useCallback(async (silent = false) => {
    if (gameStatsInFlightRef.current) return

    const requestId = gameStatsRequestRef.current + 1
    gameStatsRequestRef.current = requestId
    gameStatsInFlightRef.current = true

    try {
      if (!silent) setIsGameStatsLoading(true)
      if (!silent) setGameStatsError('')
      const payload = await callAdminDataAction(
        'game_stats_summary',
        {
          period: gameStatsPeriod,
          sourceMode: 'puzzle_submission',
        },
        { allowPrompt: !silent }
      )

      const summary = normalizeGameStatsSummary(payload)
      if (!summary.summaryVersion && !summary.lastUpdated && !summary.trackedSince && !summary.leaderboardEntries) {
        throw new Error('Game stats endpoint is not deployed yet')
      }

      if (gameStatsRequestRef.current !== requestId) return
      setGameStats(summary)
      setGameStatsError('')
      gameStatsRefreshDelayRef.current = GAME_STATS_REFRESH_MS
    } catch (err) {
      if (gameStatsRequestRef.current !== requestId) return
      const message = String(err?.message || 'Game stats unavailable')
      setGameStatsError(
        message === 'Admin session unavailable'
          ? 'Authorize admin session with Refresh to load game stats'
          : message
      )
      gameStatsRefreshDelayRef.current = Math.min(
        GAME_STATS_REFRESH_MAX_MS,
        Math.max(GAME_STATS_REFRESH_MS, gameStatsRefreshDelayRef.current * 2)
      )
    } finally {
      if (gameStatsRequestRef.current === requestId) {
        gameStatsInFlightRef.current = false
      }
      if (!silent) setIsGameStatsLoading(false)
    }
  }, [callAdminDataAction, gameStatsPeriod])

  const authorizeAdminSession = useCallback(async () => {
    try {
      await ensureAdminSession({ allowPrompt: true })
      if (activeTab === 'logs') {
        const entries = await refreshActivityLog({ allowPrompt: false })
        setActivityLog(entries)
      } else if (activeTab === 'game-stats') {
        await fetchGameStatsSummary(false)
      }
      setStatus('Admin session authorized')
    } catch (err) {
      setStatus(`Error: ${err?.message || 'Failed to authorize admin session'}`)
    }
  }, [activeTab, ensureAdminSession, fetchGameStatsSummary, refreshActivityLog])

  const reconcileLeaderboardWithPuzzle = async () => {
    try {
      setActiveBusyAction('reconcile-leaderboard')
      setStatus('Reconciling leaderboard with puzzle submissions...')

      const payload = await callAdminMaintenanceAction('reconcile_leaderboard_with_puzzle')

      const removedCount = Number(payload?.removedCount || 0)
      const keptCount = Number(payload?.keptCount || 0)
      setStatus(
        removedCount > 0
          ? `Removed ${removedCount} leaderboard entr${removedCount === 1 ? 'y' : 'ies'} without puzzle submissions. ${keptCount} valid entr${keptCount === 1 ? 'y remains' : 'ies remain'}.`
          : `Leaderboard already clean. ${keptCount} valid entr${keptCount === 1 ? 'y remains' : 'ies remain'}.`
      )

      await fetchGameStatsSummary(true)
    } catch (err) {
      setStatus(`Error: ${err?.message || 'Failed to reconcile leaderboard'}`)
    } finally {
      setActiveBusyAction('')
    }
  }

  const repairLeaderboardFromPuzzle = async () => {
    try {
      setActiveBusyAction('repair-leaderboard')
      setStatus('Repairing leaderboard stats from puzzle submissions...')

      const payload = await callAdminMaintenanceAction('repair_leaderboard_from_puzzle')

      const repairedCount = Number(payload?.repairedCount || 0)
      const previousCount = Number(payload?.previousCount || 0)
      setStatus(
        repairedCount > 0
          ? `Rebuilt ${repairedCount} leaderboard entr${repairedCount === 1 ? 'y' : 'ies'} from puzzle submissions. Previously stored: ${previousCount}.`
          : 'No leaderboard rows could be rebuilt from puzzle submissions.'
      )

      await fetchGameStatsSummary(true)
    } catch (err) {
      setStatus(`Error: ${err?.message || 'Failed to repair leaderboard'}`)
    } finally {
      setActiveBusyAction('')
    }
  }

  useEffect(() => {
    if (activeTab !== 'game-stats') return undefined

    let cancelled = false
    gameStatsRefreshDelayRef.current = GAME_STATS_REFRESH_MS

    const clearTimer = () => {
      if (gameStatsRefreshTimerRef.current) {
        clearTimeout(gameStatsRefreshTimerRef.current)
        gameStatsRefreshTimerRef.current = null
      }
    }

    const scheduleNext = (delayMs = gameStatsRefreshDelayRef.current) => {
      if (cancelled) return
      clearTimer()
      gameStatsRefreshTimerRef.current = setTimeout(async () => {
        await fetchGameStatsSummary(true)
        scheduleNext(gameStatsRefreshDelayRef.current)
      }, Math.max(5000, Number(delayMs) || GAME_STATS_REFRESH_MS))
    }

    fetchGameStatsSummary(true).finally(() => {
      scheduleNext(gameStatsRefreshDelayRef.current)
    })

    const refreshNow = () => {
      if (document.visibilityState === 'visible') {
        gameStatsRefreshDelayRef.current = GAME_STATS_REFRESH_MS
        fetchGameStatsSummary(true)
        scheduleNext(gameStatsRefreshDelayRef.current)
      }
    }

    window.addEventListener('focus', refreshNow)
    document.addEventListener('visibilitychange', refreshNow)

    return () => {
      cancelled = true
      clearTimer()
      window.removeEventListener('focus', refreshNow)
      document.removeEventListener('visibilitychange', refreshNow)
    }
  }, [activeTab, fetchGameStatsSummary])

  const exportGameStatsCard = async () => {
    if (!gameStats.lastUpdated && !gameStats.trackedSince && !gameStats.leaderboardEntries) {
      setStatus('Load game stats first')
      return
    }

    try {
      await document.fonts?.ready
    } catch {
      // Continue with browser fallback fonts.
    }

    try {
      const EXPORT_WIDTH = 3840
      const EXPORT_HEIGHT = 2160
      const DESIGN_WIDTH = 1600
      const DESIGN_HEIGHT = 980
      const canvas = document.createElement('canvas')
      canvas.width = EXPORT_WIDTH
      canvas.height = EXPORT_HEIGHT
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas export unavailable')
      const scale = Math.min(EXPORT_WIDTH / DESIGN_WIDTH, EXPORT_HEIGHT / DESIGN_HEIGHT)
      const offsetX = (EXPORT_WIDTH - (DESIGN_WIDTH * scale)) / 2
      const offsetY = (EXPORT_HEIGHT - (DESIGN_HEIGHT * scale)) / 2
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY)
      const exportAccent = gameStatsAccent
      const exportAccentSoft = mixHex(exportAccent, '#ffffff', 0.28)
      const hotAccent = '#ff4d8d'
      const exportInk = '#0f172a'
      const exportMutedText = '#475569'
      const exportSoftText = '#64748b'
      const topRows = Array.isArray(gameStats.leaderboardTop) ? gameStats.leaderboardTop.slice(0, 3) : []
      const topPerformer = gameStats.topPerformer || topRows[0] || null
      const latestQualified = gameStats.latestQualified || null
      const latestQualifiedAt = Number(
        latestQualified?.qualifiedAt ||
        latestQualified?.submittedAt ||
        latestQualified?.timestamp ||
        latestQualified?.updatedAt ||
        0
      )
      const proofShare = qualifiedPlayers > 0 ? (proofSubmittedPlayers / qualifiedPlayers) : 0
      const cardItems = [
        { label: 'Qualified Players', value: formatCompactNumber(qualifiedPlayers) },
        { label: 'Proof Submitted', value: formatCompactNumber(proofSubmittedPlayers) },
        { label: 'Proof Pending', value: formatCompactNumber(proofPendingPlayers) },
        { label: 'Best Score', value: formatCompactNumber(gameStats.bestScore) },
      ]

      const drawPanel = (x, y, width, height, radius = 20, tint = '#ffffff') => {
        ctx.save()
        ctx.shadowColor = 'rgba(15, 23, 42, 0.08)'
        ctx.shadowBlur = 24
        ctx.shadowOffsetY = 8
        ctx.fillStyle = tint
        ctx.strokeStyle = withAlpha(exportAccent, 0.16)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(x, y, width, height, radius)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }

      const drawLabelValueRow = (x, y, width, label, value) => {
        ctx.fillStyle = exportSoftText
        ctx.font = '600 15px "Trebuchet MS", sans-serif'
        ctx.fillText(label.toUpperCase(), x, y)
        ctx.fillStyle = exportInk
        ctx.font = '700 19px "Trebuchet MS", sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(value, x + width, y)
        ctx.textAlign = 'left'
      }

      const drawTextClamp = (text, x, y, maxWidth, font, color) => {
        ctx.font = font
        ctx.fillStyle = color
        const raw = String(text || '')
        if (ctx.measureText(raw).width <= maxWidth) {
          ctx.fillText(raw, x, y)
          return
        }
        let candidate = raw
        while (candidate.length > 1 && ctx.measureText(`${candidate}...`).width > maxWidth) {
          candidate = candidate.slice(0, -1)
        }
        ctx.fillText(`${candidate}...`, x, y)
      }

      const background = ctx.createLinearGradient(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)
      background.addColorStop(0, '#fdf2f8')
      background.addColorStop(0.48, '#eff6ff')
      background.addColorStop(1, '#ecfeff')
      ctx.fillStyle = background
      ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT)

      ctx.fillStyle = withAlpha(hotAccent, 0.18)
      ctx.beginPath()
      ctx.arc(1510, 98, 190, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = withAlpha(exportAccent, 0.16)
      ctx.beginPath()
      ctx.arc(128, 840, 220, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = withAlpha('#22c55e', 0.12)
      ctx.beginPath()
      ctx.arc(620, 880, 160, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = exportAccentSoft
      ctx.font = '800 78px "Trebuchet MS", sans-serif'
      ctx.fillText('8BITPENGUINS', 64, 104)

      ctx.fillStyle = exportInk
      ctx.font = '600 30px "Trebuchet MS", sans-serif'
      ctx.fillText(`${selectedGameStatsPeriodLabel} GAME SNAPSHOT`, 68, 172)

      ctx.fillStyle = exportMutedText
      ctx.font = '400 18px "Trebuchet MS", sans-serif'
      const trackedSinceLabel = gameStats.trackedSince ? formatAdminLogTime(gameStats.trackedSince) : 'Tracking begins at first puzzle submission'
      ctx.fillText(`Since ${trackedSinceLabel}`, 68, 204)
      ctx.fillStyle = withAlpha(exportAccent, 0.62)
      ctx.fillRect(64, 222, 1472, 3)

      drawPanel(1132, 52, 418, 158, 16, 'rgba(255,255,255,0.94)')
      ctx.fillStyle = exportSoftText
      ctx.font = '600 16px "Trebuchet MS", sans-serif'
      ctx.fillText('LAST UPDATED', 1160, 100)
      ctx.fillStyle = exportInk
      ctx.font = '700 24px "Trebuchet MS", sans-serif'
      drawTextClamp(formatAdminLogTime(gameStats.lastUpdated), 1160, 136, 350, '700 24px "Trebuchet MS", sans-serif', exportInk)
      ctx.fillStyle = exportMutedText
      ctx.font = '400 15px "Trebuchet MS", sans-serif'
      ctx.fillText(`Exported ${formatAdminLogTime(Date.now())}`, 1160, 170)

      cardItems.forEach((card, index) => {
        const col = index % 2
        const row = Math.floor(index / 2)
        const x = 64 + (col * 380)
        const y = 252 + (row * 124)
        const tint = index === 0
          ? 'rgba(255,255,255,0.96)'
          : index === 1
            ? 'rgba(240,253,250,0.96)'
            : index === 2
              ? 'rgba(255,251,235,0.96)'
              : 'rgba(239,246,255,0.96)'
        drawPanel(x, y, 356, 104, 14, tint)
        ctx.fillStyle = exportSoftText
        ctx.font = '600 16px "Trebuchet MS", sans-serif'
        ctx.fillText(card.label.toUpperCase(), x + 20, y + 32)
        ctx.fillStyle = exportInk
        ctx.font = '700 36px "Trebuchet MS", sans-serif'
        ctx.fillText(card.value, x + 20, y + 76)
      })

      drawPanel(840, 252, 710, 104, 14, 'rgba(255,255,255,0.96)')
      ctx.fillStyle = exportSoftText
      ctx.font = '600 16px "Trebuchet MS", sans-serif'
      ctx.fillText('PROOF COMPLETION', 864, 286)
      ctx.fillStyle = exportInk
      ctx.font = '700 30px "Trebuchet MS", sans-serif'
      ctx.fillText(`${formatRate(proofSubmissionRate)} submitted`, 864, 327)
      ctx.fillStyle = withAlpha(exportAccent, 0.16)
      ctx.beginPath()
      ctx.roundRect(1200, 284, 320, 16, 999)
      ctx.fill()
      ctx.fillStyle = hotAccent
      ctx.beginPath()
      ctx.roundRect(1200, 284, Math.max(10, Math.round(320 * proofShare)), 16, 999)
      ctx.fill()

      const leaderboardY = 520
      drawPanel(64, leaderboardY, 980, 390, 18, 'rgba(255,255,255,0.96)')
      ctx.fillStyle = hotAccent
      ctx.font = '700 19px "Trebuchet MS", sans-serif'
      ctx.fillText('TOP LEADERBOARD (TOP 3)', 92, leaderboardY + 36)
      ctx.fillStyle = exportSoftText
      ctx.font = '600 14px "Trebuchet MS", sans-serif'
      ctx.fillText('RANK', 94, leaderboardY + 68)
      ctx.fillText('PLAYER', 176, leaderboardY + 68)
      ctx.fillText('SCORE', 650, leaderboardY + 68)
      ctx.fillText('MOVES', 770, leaderboardY + 68)
      ctx.fillText('TIME', 892, leaderboardY + 68)
      ctx.strokeStyle = withAlpha(exportAccent, 0.24)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(90, leaderboardY + 78)
      ctx.lineTo(1028, leaderboardY + 78)
      ctx.stroke()

      if (topRows.length > 0) {
        topRows.forEach((entry, index) => {
          const rowY = leaderboardY + 132 + (index * 78)
          const rowTop = rowY - 40
          ctx.fillStyle = index === 0
            ? 'rgba(236, 72, 153, 0.12)'
            : 'rgba(56, 189, 248, 0.12)'
          ctx.beginPath()
          ctx.roundRect(90, rowTop, 938, 62, 12)
          ctx.fill()
          ctx.fillStyle = index === 0 ? hotAccent : exportAccent
          ctx.font = '700 22px "Trebuchet MS", sans-serif'
          ctx.fillText(`#${index + 1}`, 98, rowY)
          drawTextClamp(
            formatGameIdentityLabel(entry),
            176,
            rowY,
            420,
            '700 20px "Trebuchet MS", sans-serif',
            exportInk
          )
          ctx.textAlign = 'right'
          ctx.fillStyle = exportInk
          ctx.font = '700 20px "Trebuchet MS", sans-serif'
          ctx.fillText(formatCompactNumber(entry.score || 0), 728, rowY)
          ctx.fillStyle = exportMutedText
          ctx.font = '500 17px "Trebuchet MS", sans-serif'
          ctx.fillText(formatCompactNumber(entry.moves || 0), 844, rowY)
          ctx.fillText(formatGameDuration(entry.timeSec || 0), 966, rowY)
          ctx.textAlign = 'left'
        })
      } else {
        ctx.fillStyle = exportMutedText
        ctx.font = '400 20px "Trebuchet MS", sans-serif'
        ctx.fillText('No ranked qualified players yet.', 92, leaderboardY + 132)
      }

      const signalX = 1070
      const signalY = 382
      const signalWidth = 480
      drawPanel(signalX, signalY, signalWidth, 488, 18, 'rgba(255,255,255,0.96)')
      ctx.fillStyle = hotAccent
      ctx.font = '700 20px "Trebuchet MS", sans-serif'
      ctx.fillText('KEY SIGNALS', signalX + 24, signalY + 34)
      drawLabelValueRow(signalX + 24, signalY + 74, signalWidth - 48, 'Qualification Rate', formatRate(gameStats.runQualificationRate))
      drawLabelValueRow(signalX + 24, signalY + 108, signalWidth - 48, 'Submission Coverage', analyticsCoverageLabel)
      drawLabelValueRow(signalX + 24, signalY + 142, signalWidth - 48, 'Qualified Coverage', qualifiedCoverageLabel)
      drawLabelValueRow(signalX + 24, signalY + 176, signalWidth - 48, 'Proof Submitted', formatCompactNumber(proofSubmittedPlayers))
      drawLabelValueRow(signalX + 24, signalY + 210, signalWidth - 48, 'Avg Qualified Score', formatCompactNumber(gameStats.averageQualifiedScore))

      drawPanel(signalX + 20, signalY + 246, signalWidth - 40, 92, 14, 'rgba(248,250,252,0.96)')
      ctx.fillStyle = exportSoftText
      ctx.font = '600 15px "Trebuchet MS", sans-serif'
      ctx.fillText('TOP PERFORMER', signalX + 40, signalY + 274)
      drawTextClamp(
        topPerformer ? formatGameIdentityLabel(topPerformer) : 'No ranked player yet',
        signalX + 40,
        signalY + 308,
        signalWidth - 80,
        '700 20px "Trebuchet MS", sans-serif',
        exportInk
      )

      drawPanel(signalX + 20, signalY + 352, signalWidth - 40, 124, 14, 'rgba(248,250,252,0.96)')
      ctx.fillStyle = exportSoftText
      ctx.font = '600 15px "Trebuchet MS", sans-serif'
      ctx.fillText('LATEST QUALIFIED', signalX + 40, signalY + 380)
      const latestIdentity = latestQualified ? formatGameIdentityLabel(latestQualified) : 'No recent qualified run'
      drawTextClamp(
        latestIdentity,
        signalX + 40,
        signalY + 412,
        signalWidth - 80,
        '700 19px "Trebuchet MS", sans-serif',
        exportInk
      )
      drawTextClamp(
        latestQualified
          ? `${formatAdminLogTime(latestQualifiedAt)} | Score ${formatCompactNumber(latestQualified.score || 0)}`
          : 'Waiting for next qualified submission',
        signalX + 40,
        signalY + 440,
        signalWidth - 80,
        '600 15px "Trebuchet MS", sans-serif',
        exportMutedText
      )

      ctx.fillStyle = exportMutedText
      ctx.font = '500 16px "Trebuchet MS", sans-serif'
      ctx.fillText(
        `Updated ${formatAdminLogTime(gameStats.lastUpdated)} | Puzzle submissions ${formatCompactNumber(gameStats.totalRuns)} | Source: Puzzle Submissions`,
        64,
        944
      )

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `penguins-play-to-wl-${gameStatsPeriod}-stats-${Date.now()}.png`
      link.click()
      setStatus(`${selectedGameStatsPeriodLabel} game stats card exported`)
    } catch (err) {
      setStatus(`Error: ${err?.message || 'Failed to export game stats card'}`)
    }
  }

  const connect = async () => {
    if (!window.ethereum) {
      setStatus('Install MetaMask')
      return
    }
    try {
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const next = normalizeConnectedAddress(await signer.getAddress())
      setAccount(next)
      setStatus('')
      await syncState(next)
    } catch {
      setStatus('Connection failed')
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setIsOwner(false)
    setLastTxHash('')
    adminSessionPromiseRef.current = null
    setAdminSessionToken('')
    setAdminSessionExpiryMs(0)
    setStatus('Wallet disconnected')
  }

  const ensureConfiguredEthereumNetwork = async () => {
    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (currentChainId === CHAIN_ID_HEX) return true

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      })
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
        setStatus(`Switch to ${CHAIN_NAME} in your wallet`)
        return false
      }
    }
  }

  const runOwnerAction = async (label, fn, busyKey = label) => {
    if (!contractAddress) {
      setStatus('Contract address is not configured')
      return false
    }
    if (!account) {
      setStatus('Connect wallet first')
      return false
    }
    if (!isOwner) {
      setStatus('Connected wallet is not the contract owner')
      return false
    }

    try {
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return false
      setActiveBusyAction(busyKey)
      setIsBusy(true)
      setStatus(`${label}...`)
      setLastTxHash('')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, signer)
      const tx = await fn(contract)
      setLastTxHash(tx.hash)
      setStatus('Confirming...')
      await tx.wait()
      await syncState(account)
      setWhitelistVersion((prev) => prev + 1)
      notifyContractUpdated(label)
      setStatus(`${label} complete`)
      return true
    } catch (err) {
      setStatus(`Error: ${err.reason || err.shortMessage || err.message?.slice(0, 160) || 'Transaction failed'}`)
      return false
    } finally {
      setActiveBusyAction('')
      setIsBusy(false)
    }
  }

  const isBusyAction = (key) => activeBusyAction === key

  const revealAndFinalizeSafe = async () => {
    if (!contractAddress) {
      setStatus('Contract address is not configured')
      return false
    }
    if (!account) {
      setStatus('Connect wallet first')
      return false
    }
    if (!isOwner) {
      setStatus('Connected wallet is not the contract owner')
      return false
    }

    const busyKey = 'reveal-finalize-safe'
    try {
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return false
      setActiveBusyAction(busyKey)
      setIsBusy(true)
      setLastTxHash('')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, signer)

      let didReveal = false
      if (!state.revealed) {
        setStatus('Revealing collection...')
        const revealTx = await contract.setRevealed(true)
        setLastTxHash(revealTx.hash)
        setStatus('Confirming reveal...')
        await revealTx.wait()
        didReveal = true
      }

      const [supplyRaw, maxSupplyRaw, mintActive, rarityFinalized] = await Promise.all([
        contract.totalSupply(),
        contract.MAX_SUPPLY(),
        contract.mintActive(),
        safeRead(() => contract.rarityFinalized(), false),
      ])

      const supply = Number(supplyRaw || 0)
      const maxSupply = Number(maxSupplyRaw || 0)

      if (rarityFinalized) {
        await syncState(account)
        setWhitelistVersion((prev) => prev + 1)
        notifyContractUpdated('Reveal + Finalize (Safe)')
        setStatus(didReveal ? 'Reveal complete. Rarity is already finalized.' : 'Rarity is already finalized.')
        return true
      }

      const canFinalizeNow = supply > 0 && (supply === maxSupply || !mintActive)
      if (!canFinalizeNow) {
        await syncState(account)
        setWhitelistVersion((prev) => prev + 1)
        notifyContractUpdated('Reveal + Finalize (Safe)')
        if (supply <= 0) {
          setStatus(didReveal
            ? 'Reveal complete. Rarity not finalized because no tokens are minted yet.'
            : 'Rarity not finalized because no tokens are minted yet.')
        } else {
          setStatus(didReveal
            ? `Reveal complete. Rarity not finalized because mint is active (${supply}/${maxSupply}).`
            : `Rarity not finalized because mint is active (${supply}/${maxSupply}).`)
        }
        return true
      }

      setStatus('Finalizing rarity...')
      const finalizeTx = await contract.finalizeRarity()
      setLastTxHash(finalizeTx.hash)
      setStatus('Confirming rarity finalization...')
      await finalizeTx.wait()

      await syncState(account)
      setWhitelistVersion((prev) => prev + 1)
      notifyContractUpdated('Reveal + Finalize (Safe)')
      setStatus('Reveal + rarity finalization complete')
      return true
    } catch (err) {
      setStatus(`Error: ${err.reason || err.shortMessage || err.message?.slice(0, 160) || 'Reveal + finalize failed'}`)
      return false
    } finally {
      setActiveBusyAction('')
      setIsBusy(false)
    }
  }

  const inspectWallet = async () => {
    if (!contractAddress) {
      setStatus('Contract address is not configured')
      return
    }

    const address = normalizeWhitelistAddress(walletInspectInput)
    if (!address) {
      setStatus('Enter a valid wallet address')
      return
    }
    try {
      setActiveBusyAction('inspect-wallet')
      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, rpcProvider)
      const [minted, balance] = await Promise.all([
        contract.mintedPerWallet(address),
        contract.balanceOf(address),
      ])
      setWalletInspect({
        address,
        minted: Number(minted),
        balance: Number(balance),
      })
      setStatus('')
    } catch (err) {
      setWalletInspect(null)
      setStatus(`Error: ${err.reason || err.message?.slice(0, 140) || 'Wallet lookup failed'}`)
    } finally {
      setActiveBusyAction('')
    }
  }

  const exportSnapshot = () => {
    const snapshot = {
      contractAddress: CONTRACT_ADDRESS,
      owner,
      state,
      currentPhaseId,
      phases,
      tokenInspect,
      walletInspect,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `penguins-admin-snapshot-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const saveTaskPageSettings = () => {
    if (!isValidPinnedPostLink(taskPinnedPostDraft)) {
      setStatus('Enter a valid X/Twitter post URL')
      return
    }

    const payload = saveTaskPinnedPostLink(taskPinnedPostDraft)
    setTaskPinnedPostDraft(payload.link)
    setStatus('Task page pinned post link updated')
  }

  const resetTaskPageSettings = () => {
    const payload = resetTaskPinnedPostLink()
    setTaskPinnedPostDraft(payload.link)
    setStatus('Task page pinned post link reset to default')
  }

  const saveRoyaltySettings = async () => {
    const feeBps = Number(royaltyFeeDraft || '0')
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) {
      setStatus('Royalty fee must be an integer between 0 and 10000 bps')
      return
    }

    const normalizedReceiver = normalizeWhitelistAddress(royaltyReceiverDraft)
    if (feeBps > 0 && !normalizedReceiver) {
      setStatus('Enter a valid royalty receiver address when fee is above 0 bps')
      return
    }

    const receiver = feeBps > 0 ? normalizedReceiver : ethers.ZeroAddress
    await runOwnerAction(
      'Updating royalty settings',
      (contract) => contract.setRoyaltyInfo(receiver, BigInt(feeBps)),
      'update-royalty-settings'
    )
  }

  const saveEvolveFeeSettings = async () => {
    let feeTokenAmount
    try {
      feeTokenAmount = usdcDraftToUnits(globalEvolveFeeUsdcDraft)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Evolve fee must be a valid USDC amount')
      return
    }

    const normalizedReceiver = normalizeWhitelistAddress(globalEvolveFeeReceiverDraft)
    if (feeTokenAmount > 0n && !normalizedReceiver) {
      setStatus('Enter a valid fee receiver address when USDC fee is above 0')
      return
    }

    if (!contractAddress) {
      setStatus('Contract address is not configured')
      return
    }
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    if (!isOwner) {
      setStatus('Connected wallet is not the contract owner')
      return
    }

    try {
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return
      setActiveBusyAction('update-evolve-fee-settings')
      setIsBusy(true)
      setStatus('Updating USDC evolve fee settings...')
      setLastTxHash('')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, signer)

      const receiver = feeTokenAmount > 0n
        ? normalizedReceiver
        : (normalizedReceiver || normalizeWhitelistAddress(state.evolveFeeReceiver) || ethers.ZeroAddress)
      const token = feeTokenAmount > 0n ? MAINNET_USDC_ADDRESS : ethers.ZeroAddress

      const setEthZeroTx = await contract.setEvolveFeeInfo(receiver, 0n)
      setLastTxHash(setEthZeroTx.hash)
      setStatus('Confirming ETH fee disable...')
      await setEthZeroTx.wait()

      const setTokenTx = await contract.setEvolveFeeTokenInfo(token, feeTokenAmount)
      setLastTxHash(setTokenTx.hash)
      setStatus('Confirming USDC fee update...')
      await setTokenTx.wait()

      await syncState(account)
      notifyContractUpdated('USDC evolve fee settings updated')
      setStatus('USDC evolve fee settings complete')
    } catch (err) {
      setStatus(`Error: ${err.reason || err.shortMessage || err.message?.slice(0, 160) || 'Transaction failed'}`)
    } finally {
      setActiveBusyAction('')
      setIsBusy(false)
    }
  }

  const uploadPlaceholderDraftToPinata = async () => {
    if (!placeholderDraftTrimmed) {
      setStatus('Enter a placeholder image first')
      return
    }

    try {
      setIsUploadingPlaceholderToPinata(true)
      setStatus('Uploading placeholder to Pinata...')

      const blob = await placeholderDraftToBlob(placeholderDraftTrimmed)
      const extension = inferBlobExtension(blob.type)
      const timestamp = Date.now()
      const fileName = `placeholder_${timestamp}.${extension}`
      const uploaded = await uploadBlobToIPFS(blob, {
        extension,
        fileName,
        keyvalues: {
          app: '8bit-penguins-admin',
          kind: 'placeholder',
          contract: String(contractAddress || ''),
        },
      })

      const nextPlaceholder = `ipfs://${uploaded.cid}`
      setPlaceholderDraft(nextPlaceholder)
      setStatus(`Placeholder uploaded to Pinata: ${nextPlaceholder}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Placeholder upload failed: ${message}`)
    } finally {
      setIsUploadingPlaceholderToPinata(false)
    }
  }

  const submitFinalRarityBatch = async () => {
    const tokenIds = parseUintList(rarityTokenIdsDraft)
    if (tokenIds.error) {
      setStatus(tokenIds.error)
      return
    }

    const scores = parseUintList(rarityScoresDraft)
    if (scores.error) {
      setStatus(scores.error)
      return
    }

    const ranks = parseUintList(rarityRanksDraft)
    if (ranks.error) {
      setStatus(ranks.error)
      return
    }

    if (tokenIds.values.length !== scores.values.length || tokenIds.values.length !== ranks.values.length) {
      setStatus('Token IDs, scores, and ranks must have the same number of values')
      return
    }

    const ok = await runOwnerAction(
      `Submitting final rarity batch (${tokenIds.values.length})`,
      (contract) => contract.setFinalRarityData(tokenIds.values, scores.values, ranks.values),
      'submit-final-rarity-batch'
    )

    if (ok) {
      setRarityTokenIdsDraft('')
      setRarityScoresDraft('')
      setRarityRanksDraft('')
    }
  }

  const submitFinalizeRarity = async () => {
    if (state.totalSupply <= 0) {
      setStatus('No tokens minted yet')
      return
    }
    if (state.totalSupply !== state.maxSupply && state.mintActive) {
      setStatus(`Pause mint or sell out first: ${state.totalSupply}/${state.maxSupply}`)
      return
    }

    await runOwnerAction('Finalizing rarity', (contract) => contract.finalizeRarity(), 'finalize-rarity')
  }

  const autoFinalizeRarity = async () => {
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    if (!isOwner) {
      setStatus('Connected wallet is not the contract owner')
      return
    }

    try {
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return

      setActiveBusyAction('auto-finalize-rarity')
      setIsBusy(true)
      setLastTxHash('')
      setStatus('Preparing automatic rarity finalization...')

      if (!contractAddress) {
        setStatus('Contract address is not configured')
        return
      }

      const readContract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, rpcProvider)
      const [supplyRaw, maxSupplyRaw, alreadyFinalized] = await Promise.all([
        readContract.totalSupply(),
        readContract.MAX_SUPPLY(),
        readContract.rarityFinalized(),
      ])

      const supply = Number(supplyRaw)
      const maxSupply = Number(maxSupplyRaw)

      if (alreadyFinalized) {
        setStatus('Rarity is already finalized')
        return
      }
      const mintActive = await readContract.mintActive()

      if (supply <= 0) {
        setStatus('No tokens minted yet')
        return
      }
      if (supply !== maxSupply && mintActive) {
        setStatus(`Collection is not sold out and mint is still active (${supply}/${maxSupply})`)
        return
      }

        const tokenTraits = []
        for (let start = 1; start <= supply; start += RARITY_READ_BATCH_SIZE) {
          const end = Math.min(supply, start + RARITY_READ_BATCH_SIZE - 1)
          const ids = chunkRange(start, end)
          setStatus(`Loading token attributes ${start}-${end} of ${supply}...`)
          const traitBatch = await Promise.all(ids.map(async (tokenId) => ({
            tokenId,
            traits: await loadRarityTraitsForToken(readContract, tokenId),
          })))
          traitBatch.forEach((entry) => {
            tokenTraits.push(entry)
          })
        }

      setStatus('Calculating final rarity scores...')
      const counts = buildRarityFrequencyMap(tokenTraits)
      const scoredTokens = calculateRarityScores(tokenTraits, counts, supply)
      const { sorted, ranks } = buildRarityRanks(scoredTokens)
      setRarityPreview(sorted.slice(0, 10))

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const writeContract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, signer)

      for (let start = 0; start < sorted.length; start += RARITY_WRITE_BATCH_SIZE) {
        const batch = sorted.slice(start, start + RARITY_WRITE_BATCH_SIZE)
        const tokenIds = batch.map((item) => BigInt(item.tokenId))
        const scores = batch.map((item) => BigInt(item.score))
        const batchRanks = batch.map((item) => BigInt(ranks.get(item.tokenId)))
        setStatus(`Uploading rarity batch ${start + 1}-${start + batch.length} of ${sorted.length}...`)
        const tx = await writeContract.setFinalRarityData(tokenIds, scores, batchRanks)
        setLastTxHash(tx.hash)
        await tx.wait()
      }

      setStatus('Submitting finalize transaction...')
      const finalizeTx = await writeContract.finalizeRarity()
      setLastTxHash(finalizeTx.hash)
      await finalizeTx.wait()

      await syncState(account)
      notifyContractUpdated('auto-finalize-rarity')
      setStatus('Automatic rarity finalization complete')
    } catch (err) {
      setStatus(`Error: ${err.reason || err.shortMessage || err.message?.slice(0, 160) || 'Automatic rarity finalization failed'}`)
    } finally {
      setActiveBusyAction('')
      setIsBusy(false)
    }
  }

  const loadPhaseIntoForm = (phase) => {
    const parts = parsePhaseNameParts(phase.name || '', '')
    setPhaseDraft({
      phaseId: String(phase.id),
      groupTitle: parts.grouped ? parts.groupLabel : '',
      title: parts.grouped ? parts.subLabel : (parts.fullLabel || ''),
      priceEth: ethers.formatEther(phase.price || 0n),
      startAt: toDatetimeLocal(phase.startTime),
      endAt: toDatetimeLocal(phase.endTime),
      maxSupply: String(phase.maxSupply || 0),
      maxPerWallet: String(phase.maxPerWallet || 0),
      enabled: Boolean(phase.enabled),
    })
  }

  const resetPhaseForm = () => {
    setPhaseDraft({
      phaseId: '',
      groupTitle: '',
      title: '',
      priceEth: '0',
      startAt: '',
      endAt: '',
      maxSupply: '0',
      maxPerWallet: '0',
      enabled: true,
    })
  }

  const transferOwnershipWithConfirmation = async () => {
    const target = normalizeWhitelistAddress(ownershipDraft)
    if (!target) {
      setStatus('Enter a valid ownership address')
      return
    }
    if (owner && target.toLowerCase() === String(owner).toLowerCase()) {
      setStatus('New owner must be different from current owner')
      return
    }

    const confirmed = window.confirm(
      `Transfer ownership to ${target}? This action requires wallet confirmation and cannot be reverted by this wallet.`
    )
    if (!confirmed) {
      setStatus('Ownership transfer cancelled')
      return
    }

    await runOwnerAction('Transferring ownership', (contract) => contract.transferOwnership(target))
  }

  const savePhase = () => {
    const composedName = composePhaseName(phaseDraft.groupTitle, phaseDraft.title)
    if (!composedName) {
      setStatus('Phase name is required')
      return
    }

    const phaseId = phaseDraft.phaseId === '' ? phases.length : Number(phaseDraft.phaseId)
    if (!Number.isInteger(phaseId) || phaseId < 0) {
      setStatus('Invalid phase ID')
      return
    }

    runOwnerAction('Saving phase', (contract) => contract.upsertPhase(
      phaseId,
      composedName,
      ethers.parseEther(phaseDraft.priceEth || '0'),
      fromDatetimeLocal(phaseDraft.startAt),
      fromDatetimeLocal(phaseDraft.endAt),
      BigInt(phaseDraft.maxSupply || '0'),
      BigInt(phaseDraft.maxPerWallet || '0'),
      Boolean(phaseDraft.enabled)
    ))
  }

  const renamePhaseGroup = async (group) => {
    if (!group?.label) {
      setStatus('Select a valid phase group first')
      return
    }
    const nextGroupTitle = String(phaseGroupRenameDrafts[group.key] ?? group.label).trim().replace(/\s+/g, ' ')
    if (!nextGroupTitle) {
      setStatus('Group name is required')
      return
    }
    if (nextGroupTitle === group.label) {
      setStatus(`No changes to save for ${group.label}`)
      return
    }

    const phaseUpdates = group.items
      .map(({ phase, subLabel, fullLabel }) => {
        const phaseTitle = String(subLabel || fullLabel || `Phase ${Number(phase.id) + 1}`).trim()
        const nextName = composePhaseName(nextGroupTitle, phaseTitle)
        return {
          phase,
          nextName,
          currentName: String(phase.name || '').trim(),
        }
      })
      .filter((entry) => entry.nextName && entry.nextName !== entry.currentName)

    if (phaseUpdates.length === 0) {
      setStatus(`No phase names to update in ${group.label}`)
      return
    }

    const confirmed = window.confirm(
      `Rename group "${group.label}" to "${nextGroupTitle}" for ${phaseUpdates.length} phase${phaseUpdates.length === 1 ? '' : 's'}?`
    )
    if (!confirmed) {
      setStatus('Group rename cancelled')
      return
    }

    if (!contractAddress) {
      setStatus('Contract address is not configured')
      return
    }
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    if (!isOwner) {
      setStatus('Connected wallet is not the contract owner')
      return
    }

    try {
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return

      const busyKey = `rename-phase-group-${group.key}`
      setActiveBusyAction(busyKey)
      setIsBusy(true)
      setLastTxHash('')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, signer)

      for (let index = 0; index < phaseUpdates.length; index += 1) {
        const { phase, nextName } = phaseUpdates[index]
        setStatus(`Renaming ${group.label}: ${index + 1}/${phaseUpdates.length}...`)
        const tx = await contract.upsertPhase(
          Number(phase.id),
          nextName,
          phase.price || 0n,
          BigInt(phase.startTime || 0),
          BigInt(phase.endTime || 0),
          BigInt(phase.maxSupply || 0),
          BigInt(phase.maxPerWallet || 0),
          Boolean(phase.enabled)
        )
        setLastTxHash(tx.hash)
        setStatus('Confirming...')
        await tx.wait()
      }

      await syncState(account)
      setWhitelistVersion((prev) => prev + 1)
      notifyContractUpdated(`rename-phase-group-${group.key}`)
      setStatus(`Group name updated to ${nextGroupTitle}`)
    } catch (err) {
      setStatus(`Error: ${err.reason || err.shortMessage || err.message?.slice(0, 160) || 'Group rename failed'}`)
    } finally {
      setActiveBusyAction('')
      setIsBusy(false)
    }
  }

  const applyNextPhaseGap = () => {
    const phaseId = phaseDraft.phaseId === '' ? phases.length : Number(phaseDraft.phaseId)
    const previousPhase = phases
      .filter((phase) => phase.id < phaseId && phase.endTime > 0)
      .sort((a, b) => b.id - a.id)[0]

    if (!previousPhase) {
      setStatus('No previous phase with an end time found')
      return
    }

    const gap = Number(phaseGapMinutes || '5')
    const previousEndLocal = toDatetimeLocal(previousPhase.endTime)
    const nextStart = addMinutesToDatetimeLocal(previousEndLocal, Number.isFinite(gap) ? gap : 5)
    if (!nextStart) {
      setStatus('Failed to calculate next phase start')
      return
    }

    setPhaseDraft((prev) => ({ ...prev, startAt: nextStart }))
    setStatus(`Next phase start set to ${gap || 5} minutes after previous phase end`)
  }

  const applyPhaseDuration = () => {
    if (!phaseDraft.startAt) {
      setStatus('Set a phase start time first')
      return
    }

    const duration = Number(phaseDurationMinutes || '60')
    const nextEnd = addMinutesToDatetimeLocal(phaseDraft.startAt, Number.isFinite(duration) ? duration : 60)
    if (!nextEnd) {
      setStatus('Failed to calculate phase end time')
      return
    }

    setPhaseDraft((prev) => ({ ...prev, endAt: nextEnd }))
    setStatus(`Phase end set to ${duration || 60} minutes after start`)
  }

  const checkPhaseOverlap = () => {
    const phaseId = phaseDraft.phaseId === '' ? phases.length : Number(phaseDraft.phaseId)
    const draftStart = fromDatetimeLocal(phaseDraft.startAt)
    const draftEnd = fromDatetimeLocal(phaseDraft.endAt)

    if (!draftStart || !draftEnd || draftEnd <= draftStart) {
      setStatus('Set a valid phase start and end time first')
      return
    }

    const overlap = phases.find((phase) => {
      if (phase.id === phaseId || !phase.enabled) return false
      if (!phase.startTime || !phase.endTime) return false
      return draftStart < phase.endTime && draftEnd > phase.startTime
    })

    if (overlap) {
      setStatus(`Overlap found with phase ${overlap.id}: ${overlap.name || `Phase ${overlap.id}`}`)
      return
    }

    setStatus('No phase overlap detected')
  }

  const progress = state.maxSupply > 0 ? (state.totalSupply / state.maxSupply) * 100 : 0
  const adminReady = Boolean(account) && isOwner
  const ownerResolved = Boolean(owner)
  const gateTitle = !account
    ? 'Owner Wallet Required'
    : ownerResolved
      ? 'Admin Access Restricted'
      : 'Verifying Owner Access'
  const gateCopy = !account
    ? 'Connect the owner wallet to unlock the dashboard.'
    : ownerResolved
      ? 'Connected wallet does not match the on-chain owner for this contract.'
      : 'Fetching on-chain owner to verify admin access...'
  const gateAccessLabel = !account
    ? 'Not Connected'
    : ownerResolved
      ? 'Not Authorized'
      : 'Verifying Access'
  const gateAccessHint = !account
    ? 'Connect wallet to begin owner verification.'
    : ownerResolved
      ? 'Use the owner wallet or switch account.'
      : `Checking contract owner on ${CHAIN_NAME}.`
  const hasUsableAdminSession = Boolean(adminSessionToken) && (adminSessionExpiryMs - Date.now()) > ADMIN_SESSION_REFRESH_BUFFER_MS
  const gameStatsReady = Boolean(gameStats.lastUpdated || gameStats.trackedSince || gameStats.leaderboardEntries)
  const showGameStatsRedeployHint = Boolean(gameStatsError) && !/\b(session|authorize|owner wallet|connect wallet)\b/i.test(String(gameStatsError || ''))
  const selectedGameStatsPeriodLabel = GAME_STATS_PERIODS.find((item) => item.id === gameStatsPeriod)?.label || 'All Time'
  const gameStatsAccent = gameStatsPalette.accent
  const gameStatsAccentSoft = gameStatsPalette.accentSoft
  const gameStatsAccentDeep = gameStatsPalette.accentDeep
  const gameStatsPanel = gameStatsPalette.panel
  const trackedPlayers = Math.max(0, Number(gameStats.trackedPlayers || 0))
  const qualifiedPlayers = Math.max(0, Number(gameStats.qualifiedPlayers || 0))
  const trackedQualifiedPlayers = Math.max(0, Number(gameStats.trackedQualifiedPlayers || 0))
  const rawProofSubmittedPlayers = Math.max(
    0,
    Number(gameStats.proofSubmittedPlayers || gameStats.qualifiedSubmissionCount || 0)
  )
  const rawProofPendingPlayers = Math.max(0, Number(gameStats.proofPendingPlayers || 0))
  const proofSubmittedPlayers = Math.min(rawProofSubmittedPlayers, qualifiedPlayers || rawProofSubmittedPlayers)
  const derivedProofPendingPlayers = Math.max(qualifiedPlayers - proofSubmittedPlayers, 0)
  const proofPendingPlayers = rawProofPendingPlayers > 0 ? rawProofPendingPlayers : derivedProofPendingPlayers
  const proofStatusTotal = proofSubmittedPlayers + proofPendingPlayers
  const proofDataMismatch = qualifiedPlayers > 0 && Math.abs(proofStatusTotal - qualifiedPlayers) > 2
  const proofSubmissionRate = qualifiedPlayers > 0
    ? (proofSubmittedPlayers / qualifiedPlayers) * 100
    : 0
  const hasSubmissionData = Number(gameStats.totalRuns || 0) > 0 || trackedPlayers > 0
  const analyticsCoverageRate = Math.max(0, Math.min(100, Number(gameStats.analyticsCoverageRate || (gameStats.usersPlayed > 0 ? (trackedPlayers / Number(gameStats.usersPlayed || 1)) * 100 : 0))))
  const qualifiedCoverageRate = Math.max(0, Math.min(100, Number(gameStats.qualifiedCoverageRate || (qualifiedPlayers > 0 ? (trackedQualifiedPlayers / qualifiedPlayers) * 100 : 0))))
  const analyticsCoverageLabel = hasSubmissionData ? formatRate(analyticsCoverageRate) : 'No submission data'
  const qualifiedCoverageLabel = trackedQualifiedPlayers > 0 ? formatRate(qualifiedCoverageRate) : 'No qualified data'
  const gameStatsPrimary = [
    { label: 'Known Players', value: formatCompactNumber(gameStats.usersPlayed), note: 'Unique identities in puzzle submissions' },
    { label: 'Qualified Players', value: formatCompactNumber(qualifiedPlayers), note: `${formatCompactNumber(gameStats.qualifiedSubmissionCount)} qualified submissions recorded` },
    { label: 'Proof Submitted', value: formatCompactNumber(proofSubmittedPlayers), note: `${formatRate(proofSubmissionRate)} of qualified players submitted proof` },
    { label: 'Proof Pending', value: formatCompactNumber(proofPendingPlayers), note: 'Qualified players still pending proof' },
    { label: 'Best Score', value: formatCompactNumber(gameStats.bestScore), note: 'Highest qualified score from Puzzle Submissions' },
  ]
  const gameStatsQuickFacts = [
    { label: 'Qualification Rate', value: formatRate(gameStats.runQualificationRate) },
    { label: 'Submission Coverage', value: analyticsCoverageLabel },
    { label: 'Qualified Coverage', value: qualifiedCoverageLabel },
    { label: 'Total Submissions', value: formatCompactNumber(gameStats.totalRuns) },
    { label: 'Avg Qualified Score', value: formatCompactNumber(gameStats.averageQualifiedScore) },
    { label: 'Avg Qualified Time', value: formatGameDuration(gameStats.averageQualifiedTimeSec) },
  ]
  const topPerformerEntry = gameStats.topPerformer || (Array.isArray(gameStats.leaderboardTop) ? gameStats.leaderboardTop[0] : null) || null
  const latestQualifiedEntry = gameStats.latestQualified || null
  const latestQualifiedAt = Number(
    latestQualifiedEntry?.qualifiedAt ||
    latestQualifiedEntry?.submittedAt ||
    latestQualifiedEntry?.timestamp ||
    latestQualifiedEntry?.updatedAt ||
    0
  )
  const gameStatsWatchlist = (() => {
    const alerts = []
    const activeRuns = Math.max(0, Number(gameStats.activeRuns || 0))
    const completedRuns = Math.max(0, Number(gameStats.completedRuns || 0))
    if (!hasSubmissionData) {
      alerts.push({
        severity: 'warn',
        label: 'Puzzle submission feed missing',
        detail: 'No puzzle submissions were found in this window. Verify Apps Script writes and deploy status.',
      })
    } else if (analyticsCoverageRate < 45) {
      alerts.push({
        severity: 'warn',
        label: 'Low submission coverage',
        detail: `${formatRate(analyticsCoverageRate)} of known players are represented in puzzle submissions. Target > 60%.`,
      })
    } else {
      alerts.push({
        severity: 'ok',
        label: 'Submission coverage healthy',
        detail: `${formatRate(analyticsCoverageRate)} of known players are represented in puzzle submissions.`,
      })
    }

    if (trackedQualifiedPlayers > 0 && qualifiedCoverageRate < 65) {
      alerts.push({
        severity: 'warn',
        label: 'Qualified coverage lag',
        detail: `${formatRate(qualifiedCoverageRate)} of qualified players are represented in puzzle submissions.`,
      })
    }

    if (proofPendingPlayers > Math.max(5, Math.round(qualifiedPlayers * 0.4))) {
      alerts.push({
        severity: 'warn',
        label: 'High proof pending backlog',
        detail: `${formatCompactNumber(proofPendingPlayers)} qualified players are still pending proof.`,
      })
    }

    if (proofDataMismatch) {
      alerts.push({
        severity: 'info',
        label: 'Proof totals need verification',
        detail: `Submitted + pending (${formatCompactNumber(proofStatusTotal)}) does not fully align with qualified players (${formatCompactNumber(qualifiedPlayers)}).`,
      })
    }

    if (activeRuns > Math.max(6, Math.round(completedRuns * 0.35))) {
      alerts.push({
        severity: 'info',
        label: 'High active run backlog',
        detail: `${formatCompactNumber(activeRuns)} active runs vs ${formatCompactNumber(completedRuns)} completed runs.`,
      })
    }

    if (Number(gameStats.leaderboardEntries || 0) > 0 && proofSubmittedPlayers + 2 < qualifiedPlayers) {
      alerts.push({
        severity: 'info',
        label: 'Proof submissions behind qualifiers',
        detail: `${formatCompactNumber(proofSubmittedPlayers)} proofs vs ${formatCompactNumber(qualifiedPlayers)} qualified players.`,
      })
    }

    if (alerts.length === 0) {
      alerts.push({
        severity: 'ok',
        label: 'No major issues',
        detail: 'Puzzle submissions, qualifiers, and leaderboard signals are aligned.',
      })
    }

    return alerts.slice(0, 4)
  })()
  useEffect(() => {
    setPhaseDisplayOrder((prev) => {
      const phaseIds = phases
        .map((phase) => Number(phase.id))
        .filter((value) => Number.isInteger(value) && value >= 0)
      const previous = Array.isArray(prev) ? prev : []
      const retained = previous.filter((id) => phaseIds.includes(id))
      const missing = phaseIds.filter((id) => !retained.includes(id))
      const next = [...retained, ...missing]
      const unchanged = previous.length === next.length && previous.every((value, idx) => value === next[idx])
      return unchanged ? previous : next
    })
  }, [phases])

  useEffect(() => {
    writeStoredPhaseOrder(contractAddress, phaseDisplayOrder)
  }, [contractAddress, phaseDisplayOrder])

  const orderedPhases = useMemo(() => {
    if (!phases.length) return []
    if (!phaseDisplayOrder.length) return phases
    const indexById = new Map(
      phaseDisplayOrder.map((id, index) => [Number(id), index])
    )
    return [...phases].sort((a, b) => {
      const aIndex = indexById.has(Number(a.id)) ? indexById.get(Number(a.id)) : Number.MAX_SAFE_INTEGER
      const bIndex = indexById.has(Number(b.id)) ? indexById.get(Number(b.id)) : Number.MAX_SAFE_INTEGER
      if (aIndex !== bIndex) return aIndex - bIndex
      return Number(a.id) - Number(b.id)
    })
  }, [phases, phaseDisplayOrder])

  const groupedPhases = useMemo(() => groupPhasesForDisplay(orderedPhases), [orderedPhases])

  useEffect(() => {
    setPhaseGroupRenameDrafts((prev) => {
      const next = {}
      groupedPhases.forEach((group) => {
        if (!group.label) return
        next[group.key] = Object.prototype.hasOwnProperty.call(prev, group.key) ? prev[group.key] : group.label
      })
      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)
      const changed = prevKeys.length !== nextKeys.length || nextKeys.some((key) => prev[key] !== next[key])
      return changed ? next : prev
    })
  }, [groupedPhases])

  const handlePhaseDragStart = useCallback((phaseId, event) => {
    setDraggingPhaseId(Number(phaseId))
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(phaseId))
    }
  }, [])

  const handlePhaseDrop = useCallback((targetPhaseId, event) => {
    event?.preventDefault?.()
    const draggedRaw = event?.dataTransfer?.getData('text/plain')
    const draggedFromTransfer = Number.parseInt(String(draggedRaw || ''), 10)
    const draggedPhaseId = Number.isInteger(draggedFromTransfer) ? draggedFromTransfer : Number(draggingPhaseId)
    const targetId = Number(targetPhaseId)
    if (!Number.isInteger(draggedPhaseId) || !Number.isInteger(targetId) || draggedPhaseId === targetId) {
      setDraggingPhaseId(null)
      return
    }
    setPhaseDisplayOrder((prev) => {
      const base = prev.length
        ? [...prev]
        : orderedPhases.map((phase) => Number(phase.id))
      const dragIndex = base.indexOf(draggedPhaseId)
      const targetIndex = base.indexOf(targetId)
      if (dragIndex < 0 || targetIndex < 0) return prev
      const next = [...base]
      next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, draggedPhaseId)
      return next
    })
    setDraggingPhaseId(null)
  }, [draggingPhaseId, orderedPhases])

  const handlePhaseDragEnd = useCallback(() => {
    setDraggingPhaseId(null)
  }, [])

  useEffect(() => {
    setExpandedPhaseGroups((prev) => {
      const next = {}
      let changed = false
      groupedPhases.forEach((group) => {
        if (!group.label) return
        const existing = Object.prototype.hasOwnProperty.call(prev, group.key) ? prev[group.key] : true
        next[group.key] = existing
        if (!Object.prototype.hasOwnProperty.call(prev, group.key)) {
          changed = true
        }
      })
      Object.keys(prev).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(next, key)) {
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [groupedPhases])
  const selectedWhitelistPhase = phases.find((phase) => String(phase.id) === String(selectedWhitelistPhaseId)) || null
  const selectedWhitelistPhaseParts = selectedWhitelistPhase ? getPhaseDisplayParts(selectedWhitelistPhase) : null
  const selectedWhitelistAssignedCount = selectedWhitelistPhase ? Number(phaseWhitelistCounts[String(selectedWhitelistPhase.id)] || 0) : 0
  const whitelistAnalysis = useMemo(() => analyzeAddressList(whitelistDraft), [whitelistDraft])
  const hasReliableWhitelistList = !whitelistLoadError
  const isWhitelistListComplete = phaseWhitelistAddresses.length === selectedWhitelistAssignedCount
  const whitelistExistingSet = useMemo(() => new Set(phaseWhitelistAddresses), [phaseWhitelistAddresses])
  const whitelistToAdd = useMemo(
    () => hasReliableWhitelistList
      ? whitelistAnalysis.valid.filter((address) => !whitelistExistingSet.has(address))
      : whitelistAnalysis.valid,
    [whitelistAnalysis, whitelistExistingSet, hasReliableWhitelistList]
  )
  const whitelistToRemove = useMemo(
    () => hasReliableWhitelistList
      ? whitelistAnalysis.valid.filter((address) => whitelistExistingSet.has(address))
      : whitelistAnalysis.valid,
    [whitelistAnalysis, whitelistExistingSet, hasReliableWhitelistList]
  )
  const filteredWhitelistAddresses = useMemo(() => {
    const query = whitelistSearch.trim().toLowerCase()
    if (!query) return phaseWhitelistAddresses
    return phaseWhitelistAddresses.filter((address) => address.toLowerCase().includes(query))
  }, [phaseWhitelistAddresses, whitelistSearch])
  const whitelistPageSize = 50
  const whitelistTotalPages = Math.max(1, Math.ceil(filteredWhitelistAddresses.length / whitelistPageSize))
  const paginatedWhitelistAddresses = useMemo(() => {
    const start = (whitelistPage - 1) * whitelistPageSize
    return filteredWhitelistAddresses.slice(start, start + whitelistPageSize)
  }, [filteredWhitelistAddresses, whitelistPage])

  useEffect(() => {
    const loadWhitelistMinted = async () => {
      if (activeTab !== 'whitelist' || !supportsPhaseControls || !selectedWhitelistPhase || paginatedWhitelistAddresses.length === 0) {
        setPhaseWhitelistMinted({})
        return
      }

      if (!contractAddress) {
        setPhaseWhitelistMinted({})
        return
      }

      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, rpcProvider)
      const entries = await Promise.all(
        paginatedWhitelistAddresses.map(async (address) => {
          const minted = await safeRead(() => contract.phaseMintedPerWallet(selectedWhitelistPhase.id, address), 0)
          return [address, Number(minted || 0)]
        })
      )
      setPhaseWhitelistMinted(Object.fromEntries(entries))
    }

    loadWhitelistMinted().catch(() => setPhaseWhitelistMinted({}))
  }, [activeTab, contractAddress, supportsPhaseControls, selectedWhitelistPhase, paginatedWhitelistAddresses, rpcProvider])

  useEffect(() => {
    if (whitelistPage > whitelistTotalPages) {
      setWhitelistPage(whitelistTotalPages)
    }
  }, [whitelistPage, whitelistTotalPages])

  const addWhitelistEntries = async () => {
    if (whitelistAnalysis.valid.length === 0) {
      setStatus('Enter at least one valid wallet address')
      return
    }

    if (selectedWhitelistPhaseId === '') {
      setStatus('Select a phase first')
      return
    }

    const duplicateCount = whitelistAnalysis.duplicate.length
    const invalidCount = whitelistAnalysis.invalid.length

    if (whitelistToAdd.length === 0) {
      setStatus('All valid addresses are already assigned to this phase')
      return
    }

    const ok = await runOwnerAction('Updating phase whitelist', (contract) => contract.setPhaseWhitelist(
      BigInt(selectedWhitelistPhaseId),
      whitelistToAdd,
      true
    ), 'add-phase-whitelist')
    if (!ok) return

    setWhitelistDraft('')
    setWhitelistDraftSource('')
    setWhitelistSearch('')
    const skipped = duplicateCount + invalidCount
    const sourceLabel = whitelistDraftSource || 'draft'
    setStatus(
      skipped > 0
        ? `Added ${whitelistToAdd.length} address${whitelistToAdd.length !== 1 ? 'es' : ''} from ${sourceLabel}, skipped ${skipped}`
        : `Added ${whitelistToAdd.length} whitelist address${whitelistToAdd.length !== 1 ? 'es' : ''} from ${sourceLabel}`
    )
  }

  const removeWhitelistEntries = async () => {
    if (whitelistAnalysis.valid.length === 0) {
      setStatus('Enter at least one valid wallet address')
      return
    }

    if (selectedWhitelistPhaseId === '') {
      setStatus('Select a phase first')
      return
    }

    const missingCount = whitelistAnalysis.valid.length - whitelistToRemove.length
    const invalidCount = whitelistAnalysis.invalid.length

    if (whitelistToRemove.length === 0) {
      const sourceLabel = whitelistDraftSource || 'draft'
      setStatus(
        missingCount > 0 || invalidCount > 0
          ? `No matching whitelist addresses found in ${sourceLabel}. Skipped ${missingCount + invalidCount} address${missingCount + invalidCount !== 1 ? 'es' : ''}`
          : `No matching whitelist addresses found in ${sourceLabel}`
      )
      return
    }

    const ok = await runOwnerAction('Removing phase whitelist addresses', (contract) => contract.setPhaseWhitelist(
      BigInt(selectedWhitelistPhaseId),
      whitelistToRemove,
      false
    ), 'remove-phase-whitelist')
    if (!ok) return

    setWhitelistDraft('')
    setWhitelistDraftSource('')
    setWhitelistSearch('')
    const sourceLabel = whitelistDraftSource || 'draft'
    setStatus(
      missingCount + invalidCount > 0
        ? `Removed ${whitelistToRemove.length} address${whitelistToRemove.length !== 1 ? 'es' : ''} from ${sourceLabel}, skipped ${missingCount + invalidCount}`
        : `Removed ${whitelistToRemove.length} whitelist address${whitelistToRemove.length !== 1 ? 'es' : ''} from ${sourceLabel}`
    )
  }

  const removeAllPhaseWhitelistEntries = async () => {
    if (selectedWhitelistPhaseId === '') {
      setStatus('Select a phase first')
      return
    }

    if (phaseWhitelistAddresses.length === 0) {
      setStatus('No on-chain whitelist addresses found for this phase')
      return
    }

    if (!hasReliableWhitelistList || !isWhitelistListComplete) {
      setStatus('Could not load the full phase whitelist yet. Wait for load to finish, then retry remove all.')
      return
    }

    const confirmation = window.confirm(
      `Remove all ${phaseWhitelistAddresses.length} whitelist address${phaseWhitelistAddresses.length !== 1 ? 'es' : ''} from phase ${selectedWhitelistPhaseId}?`
    )
    if (!confirmation) {
      setStatus('Remove all cancelled')
      return
    }

    if (!contractAddress) {
      setStatus('Contract address is not configured')
      return
    }
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    if (!isOwner) {
      setStatus('Connected wallet is not the contract owner')
      return
    }

    const phaseId = BigInt(selectedWhitelistPhaseId)
    const totalAddresses = phaseWhitelistAddresses.length
    const totalBatches = Math.ceil(totalAddresses / PHASE_WHITELIST_WRITE_BATCH_SIZE)

    try {
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return

      setActiveBusyAction('remove-phase-whitelist-all')
      setIsBusy(true)
      setLastTxHash('')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, ADMIN_CONTRACT_ABI, signer)

      for (let index = 0; index < totalBatches; index += 1) {
        const start = index * PHASE_WHITELIST_WRITE_BATCH_SIZE
        const batch = phaseWhitelistAddresses.slice(start, start + PHASE_WHITELIST_WRITE_BATCH_SIZE)
        if (batch.length === 0) continue

        setStatus(`Removing phase whitelist batch ${index + 1}/${totalBatches}...`)
        const tx = await contract.setPhaseWhitelist(phaseId, batch, false)
        setLastTxHash(tx.hash)
        await tx.wait()
      }

      await syncState(account)
      setWhitelistVersion((prev) => prev + 1)
      notifyContractUpdated('remove-phase-whitelist-all')
      setWhitelistDraft('')
      setWhitelistDraftSource('')
      setWhitelistSearch('')
      setWhitelistPage(1)
      setStatus(`Removed all ${totalAddresses} whitelist address${totalAddresses !== 1 ? 'es' : ''} from phase ${selectedWhitelistPhaseId}`)
    } catch (err) {
      setStatus(`Error: ${err.reason || err.shortMessage || err.message?.slice(0, 160) || 'Transaction failed'}`)
    } finally {
      setActiveBusyAction('')
      setIsBusy(false)
    }
  }

  const removePhaseWhitelistEntry = async (phaseId, address) => {
    const ok = await runOwnerAction('Removing phase whitelist address', (contract) => contract.setPhaseWhitelist(
      BigInt(phaseId),
      [address],
      false
    ), 'remove-phase-whitelist-entry')
    if (ok) {
      setStatus(`Removed ${shortAddress(address)} from phase ${phaseId}`)
    }
  }

  const exportWhitelist = () => {
    const blob = new Blob([phaseWhitelistAddresses.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `penguins-whitelist-${Date.now()}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadWhitelistTemplate = () => {
    const blob = new Blob(['address\n0x0000000000000000000000000000000000000000\n'], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'penguins-whitelist-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const loadOnChainWhitelistToDraft = () => {
    if (whitelistLoadError) {
      const countLabel = selectedWhitelistAssignedCount > 0
        ? `${selectedWhitelistAssignedCount} wallet${selectedWhitelistAssignedCount !== 1 ? 's are' : ' is'} currently assigned on chain`
        : 'No wallets are currently assigned on chain'
      setStatus(`${whitelistLoadError} ${countLabel}.`)
      return
    }

    if (phaseWhitelistAddresses.length === 0) {
      setStatus('No on-chain whitelist addresses to load')
      return
    }
    setWhitelistDraft(phaseWhitelistAddresses.join('\n'))
    setWhitelistDraftSource('on-chain list')
    setStatus(`Loaded ${phaseWhitelistAddresses.length} on-chain address${phaseWhitelistAddresses.length !== 1 ? 'es' : ''} into draft`)
  }

  const openWhitelistFilePicker = () => {
    whitelistFileInputRef.current?.click()
  }

  const importParsedWhitelistAddresses = ({ addresses, invalidLikeCount = 0, duplicateCount = 0, label = 'file' }) => {
    if (addresses.length === 0) {
      setStatus('No valid wallet addresses found')
      return
    }

    setWhitelistDraft((prev) => mergeWhitelistDraft(prev, addresses))
    setWhitelistDraftSource(label)
    const skipped = invalidLikeCount + duplicateCount
    setStatus(
      skipped > 0
        ? `Imported ${addresses.length} wallet address${addresses.length !== 1 ? 'es' : ''} from ${label}, skipped ${skipped}`
        : `Imported ${addresses.length} wallet address${addresses.length !== 1 ? 'es' : ''} from ${label}`
    )
  }

  const importGoogleSheet = async () => {
    try {
      setActiveBusyAction('import-google-sheet')
      const exportUrl = buildGoogleSheetExportUrl(googleSheetUrlDraft)
      const response = await fetch(exportUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheet')
      }

      const csvText = await response.text()
      const workbook = XLSX.read(csvText, { type: 'string' })
      const parsed = extractAddressesFromWorkbook(workbook)
      importParsedWhitelistAddresses({
        ...parsed,
        label: 'Google Sheet',
      })
    } catch (error) {
      setStatus(`Error: ${error.message || 'Failed to import Google Sheet'}`)
    } finally {
      setActiveBusyAction('')
    }
  }

  const importWhitelistFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      if (file.name.toLowerCase().endsWith('.gsheet')) {
        const shortcut = JSON.parse(await file.text())
        const shortcutUrl = shortcut?.url || shortcut?.doc_url || ''
        const exportUrl = buildGoogleSheetExportUrl(shortcutUrl)
        const response = await fetch(exportUrl)
        if (!response.ok) {
          throw new Error('Failed to fetch Google Sheet from shortcut')
        }
        const csvText = await response.text()
        const workbook = XLSX.read(csvText, { type: 'string' })
        const parsed = extractAddressesFromWorkbook(workbook)
        importParsedWhitelistAddresses({
          ...parsed,
          label: file.name,
        })
      } else {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const parsed = extractAddressesFromWorkbook(workbook)
        importParsedWhitelistAddresses({
          ...parsed,
          label: file.name,
        })
      }
    } catch {
      setStatus('Failed to read file. Use a valid CSV, XLS, XLSX, or Google Sheets shortcut/public sheet')
  } finally {
      event.target.value = ''
    }
  }

  const AdminCardShell = 'div'
  const AdminDisplayShell = 'div'

  if (!adminReady) {
    return (
      <div className="mint-page admin-page admin-page-gated mint-admin-skin">
        <SiteNav label="Admin Control" />
        <div className="admin-gate-screen">
          <div className="admin-locked">
            <div className="admin-locked-badge">ADMIN ONLY</div>
            <h2>{gateTitle}</h2>
            <p className="admin-locked-copy">{gateCopy}</p>
            <div className="admin-locked-summary">
              <div className="admin-locked-item">
                <span>Connected Wallet</span>
                <strong>{account ? shortAddress(account) : 'Not connected'}</strong>
                {account && <small>{account}</small>}
              </div>
              <div className="admin-locked-item">
                <span>Access Status</span>
                <strong>{gateAccessLabel}</strong>
                <small>{gateAccessHint}</small>
              </div>
              <div className="admin-locked-item">
                <span>Network</span>
                <strong>{CHAIN_NAME}</strong>
                <small>{CHAIN_ID_HEX}</small>
              </div>
            </div>
            <div className="admin-inline-actions admin-locked-actions">
              {!account ? (
                <ConnectWalletButton onClick={connect} />
              ) : (
                <>
                  <>
                    <Button className="mint-page-btn" onClick={connect}>Switch Wallet</Button>
                    <Button className="mint-page-btn" onClick={() => syncState(account)}>Recheck Access</Button>
                    <Button className="mint-disconnect-btn" onClick={disconnectWallet}>Disconnect</Button>
                  </>
                </>
              )}
            </div>
            {statusMessage && (
              <StatusNotice
                message={statusMessage}
                tone={getStatusTone(statusMessage) || 'info'}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mint-page admin-page mint-admin-skin">
      <SiteNav label="Admin Control" />

      <div className="mint-layout">
        <>
            <AdminCardShell className="mint-card">
              <div className="mint-card-header">
                <span className="mint-card-title">Admin</span>
                <span className="mint-card-badge">OWNER</span>
              </div>

              <div className="mint-supply">
                <div className="mint-supply-header">
                  <span className="mint-supply-label">Minted</span>
                  <span className="mint-supply-value">{state.totalSupply}<span> / {state.maxSupply}</span></span>
                </div>
                <div className="mint-supply-bar">
                  <div className="mint-supply-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="mint-supply-footer">
                  <span>{state.maxSupply - state.totalSupply} remaining</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>

              <ConnectedWallet
                label="Owner Wallet"
                address={shortAddress(account)}
                badge="Owner"
                badgeClassName="admin-ok"
                onDisconnect={disconnectWallet}
              />

              {statusMessage && (
                <StatusNotice
                  message={statusMessage}
                  tone={getStatusTone(statusMessage) || 'info'}
                />
              )}
              {lastTxHash && (
                <a href={`${BLOCK_EXPLORER_URL}/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" className="mint-tx-link">
                  {'View Transaction ->'}
                </a>
              )}
            </AdminCardShell>

            <AdminDisplayShell className="mint-display admin-display">
            <>
              <div className="mint-tabs admin-tabs">
                <Button className={`mint-tab ${activeTab === 'controls' ? 'active' : ''}`} onClick={() => setActiveTab('controls')}>
                  Operations
                </Button>
                <Button className={`mint-tab ${activeTab === 'game-stats' ? 'active' : ''}`} onClick={() => setActiveTab('game-stats')}>
                  Game Stats
                </Button>
                <Button className={`mint-tab ${activeTab === 'whitelist' ? 'active' : ''}`} onClick={() => setActiveTab('whitelist')}>
                  Whitelist
                </Button>
                <Button className={`mint-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
                  Activity
                </Button>
              </div>
              {activeTab === 'controls' ? (
            <div className="admin-grid">
              <section className="admin-panel admin-panel-state admin-panel-wide">
                <div className="admin-panel-head">
                  <h2>Contract State</h2>
                  <div className="admin-inline-actions">
                    <Button className="mint-page-btn" onClick={() => syncState(account)}>Refresh</Button>
                    <Button className="mint-page-btn" onClick={exportSnapshot}>Export Snapshot</Button>
                  </div>
                </div>
                <div className="admin-stat-grid">
                  <div className="admin-stat"><span>Owner</span><strong>{shortAddress(owner)}</strong></div>
                  <div className="admin-stat"><span>Mint</span><strong>{state.mintActive ? 'Active' : 'Paused'}</strong></div>
                  <div className="admin-stat"><span>Reveal</span><strong>{state.revealed ? 'Revealed' : 'Hidden'}</strong></div>
                  <div className="admin-stat"><span>Rarity</span><strong>{state.rarityFinalized ? 'Finalized' : 'Provisional'}</strong></div>
                  <div className="admin-stat"><span>Max Supply</span><strong>{state.maxSupply}</strong></div>
                  <div className="admin-stat"><span>Global Price</span><strong>{state.mintPriceEth} ETH</strong></div>
                  <div className="admin-stat">
                    <span>Evolve Fee</span>
                    <strong>{state.evolveFeeToken ? `${state.evolveFeeTokenAmountUsdc} USDC` : `${state.evolveFeeEth} ETH`}</strong>
                  </div>
                  <div className="admin-stat"><span>Evolve Fee Currency</span><strong>{state.evolveFeeToken ? 'USDC' : 'Native ETH'}</strong></div>
                  <div className="admin-stat"><span>Evolve Fee Receiver</span><strong>{state.evolveFeeReceiver ? shortAddress(state.evolveFeeReceiver) : 'Not Set'}</strong></div>
                  <div className="admin-stat"><span>Global Wallet Max</span><strong>{state.maxPerWallet}</strong></div>
                  <div className="admin-stat"><span>Royalty Fee</span><strong>{Number(state.royaltyFeeBps || 0)} bps</strong></div>
                  <div className="admin-stat"><span>Royalty Receiver</span><strong>{state.royaltyReceiver ? shortAddress(state.royaltyReceiver) : 'Disabled'}</strong></div>
                  <div className="admin-stat"><span>Contract ETH</span><strong>{state.contractBalance}</strong></div>
                </div>
              </section>

              <section className="admin-panel admin-panel-actions">
                <div className="admin-panel-head">
                  <h2>Owner Actions</h2>
                </div>
                <div className="admin-actions">
                  <Button className="mint-submit-btn admin-action-btn" disabled={isBusy || !isOwner} aria-busy={isBusyAction(state.mintActive ? 'Pausing mint' : 'Activating mint')} onClick={() => runOwnerAction(state.mintActive ? 'Pausing mint' : 'Activating mint', (contract) => contract.toggleMint())}>
                    {state.mintActive ? 'Pause Mint' : 'Activate Mint'}
                  </Button>
                  <Button className="mint-submit-btn admin-action-btn" disabled={isBusy || !isOwner || state.revealed} aria-busy={isBusyAction('Revealing collection')} onClick={() => runOwnerAction('Revealing collection', (contract) => contract.setRevealed(true))}>
                    Reveal Collection
                  </Button>
                  <Button
                    className="mint-submit-btn admin-action-btn"
                    disabled={isBusy || !isOwner || (state.revealed && state.rarityFinalized)}
                    aria-busy={isBusyAction('reveal-finalize-safe')}
                    onClick={revealAndFinalizeSafe}
                  >
                    Reveal + Finalize (Safe)
                  </Button>
                  <Button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !isOwner || !state.revealed} aria-busy={isBusyAction('Hiding reveal')} onClick={() => runOwnerAction('Hiding reveal', (contract) => contract.setRevealed(false))}>
                    Hide Reveal
                  </Button>
                  <Button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !isOwner} aria-busy={isBusyAction('Withdrawing funds')} onClick={() => runOwnerAction('Withdrawing funds', (contract) => contract.withdraw())}>
                    Withdraw Contract ETH
                  </Button>
                </div>
              </section>

              <section className="admin-panel admin-panel-global admin-panel-rarity">
                <div className="admin-panel-head">
                  <h2>Rarity Functions</h2>
                </div>
                <div className="admin-global-settings">
                  <FieldLabel label="Token IDs">
                    <textarea
                      className="admin-input"
                      rows="4"
                      value={rarityTokenIdsDraft}
                      onChange={(e) => setRarityTokenIdsDraft(e.target.value)}
                      placeholder="1, 2, 3"
                    />
                  </FieldLabel>
                  <FieldLabel label="Rarity Scores">
                    <textarea
                      className="admin-input"
                      rows="4"
                      value={rarityScoresDraft}
                      onChange={(e) => setRarityScoresDraft(e.target.value)}
                      placeholder="7421, 6988, 6550"
                    />
                  </FieldLabel>
                  <FieldLabel label="Rarity Ranks">
                    <textarea
                      className="admin-input"
                      rows="4"
                      value={rarityRanksDraft}
                      onChange={(e) => setRarityRanksDraft(e.target.value)}
                      placeholder="1, 2, 3"
                    />
                  </FieldLabel>
                  <div className="admin-inline-actions">
                    <Button
                      className="mint-submit-btn admin-action-btn admin-setting-btn"
                      disabled={isBusy || !isOwner || state.rarityFinalized}
                      aria-busy={isBusyAction('submit-final-rarity-batch')}
                      onClick={submitFinalRarityBatch}
                    >
                      Set Final Rarity Batch
                    </Button>
                    <Button
                      className="mint-submit-btn admin-action-btn admin-setting-btn"
                      disabled={isBusy || !isOwner || state.rarityFinalized || state.totalSupply <= 0 || (state.totalSupply !== state.maxSupply && state.mintActive)}
                      aria-busy={isBusyAction('finalize-rarity')}
                      onClick={submitFinalizeRarity}
                    >
                      Finalize Rarity
                    </Button>
                    <Button
                      className="mint-submit-btn admin-action-btn admin-setting-btn"
                      disabled={isBusy || !isOwner || state.rarityFinalized || state.totalSupply <= 0 || (state.totalSupply !== state.maxSupply && state.mintActive)}
                      aria-busy={isBusyAction('auto-finalize-rarity')}
                      onClick={autoFinalizeRarity}
                    >
                      Auto Calculate + Finalize
                    </Button>
                  </div>
                  <p className="admin-setting-help">
                    Paste matching comma, space, or newline separated arrays for manual upload, or use the automatic flow to read traits on-chain, compute scores, upload batches, and freeze rarity after sellout or after mint is paused.
                  </p>
                  {rarityPreview.length > 0 && (
                    <div className="admin-phase-list">
                      {rarityPreview.map((item, index) => (
                        <div key={item.tokenId} className="admin-phase-item">
                          <div>
                            <strong>Rank #{index + 1}</strong>
                            <span>Token #{item.tokenId}</span>
                            <small>Score: {item.score}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="admin-panel admin-panel-global admin-panel-global-mint">
                <div className="admin-panel-head">
                  <h2>Global Mint Settings</h2>
                </div>
                {!supportsGlobalSetters && (
                  <div className="mint-status">
                    Upgrade required for on-chain price and wallet limit controls.
                  </div>
                )}
                <div className="admin-global-settings">
                  <div className="admin-setting-row">
                    <FieldLabel label="Max Supply">
                      <input className="admin-input" value={globalSupplyDraft} onChange={(e) => setGlobalSupplyDraft(e.target.value)} placeholder="8888" />
                    </FieldLabel>
                    <Button className="mint-submit-btn admin-action-btn admin-setting-btn" disabled={isBusy || !isOwner || !supportsGlobalSetters || Number(globalSupplyDraft || '0') < state.totalSupply} aria-busy={isBusyAction('Updating max supply')} onClick={() => runOwnerAction('Updating max supply', (contract) => contract.setMaxSupply(BigInt(globalSupplyDraft || '0')))}>
                      Save Supply
                    </Button>
                  </div>
                  <div className="admin-setting-row">
                    <FieldLabel label="Mint Price (ETH)">
                      <input className="admin-input" value={globalPriceDraft} onChange={(e) => setGlobalPriceDraft(e.target.value)} placeholder="0.01" />
                    </FieldLabel>
                    <Button className="mint-submit-btn admin-action-btn admin-setting-btn" disabled={isBusy || !isOwner || !supportsGlobalSetters} aria-busy={isBusyAction('Updating global mint price')} onClick={() => runOwnerAction('Updating global mint price', (contract) => contract.setMintPrice(ethers.parseEther(globalPriceDraft || '0')))}>
                      Save Price
                    </Button>
                  </div>
                  <div className="admin-setting-row">
                    <FieldLabel label="Global Max Per Wallet">
                      <input className="admin-input" value={globalWalletDraft} onChange={(e) => setGlobalWalletDraft(e.target.value)} placeholder="50" />
                    </FieldLabel>
                    <Button className="mint-submit-btn admin-action-btn admin-setting-btn" disabled={isBusy || !isOwner || !supportsGlobalSetters || Number(globalWalletDraft || '0') <= 0} aria-busy={isBusyAction('Updating global wallet limit')} onClick={() => runOwnerAction('Updating global wallet limit', (contract) => contract.setMaxPerWallet(BigInt(globalWalletDraft || '0')))}>
                      Save Wallet Max
                    </Button>
                  </div>
                </div>
              </section>

              <section className="admin-panel admin-panel-global admin-panel-global-royalty">
                <div className="admin-panel-head">
                  <h2>Royalty Settings</h2>
                </div>
                {!supportsRoyaltyControls && (
                  <div className="mint-status">
                    Current contract does not expose royalty setters/getters.
                  </div>
                )}
                <div className="admin-global-settings">
                  <div className="admin-setting-row">
                    <FieldLabel label="Receiver">
                      <input
                        className="admin-input"
                        value={royaltyReceiverDraft}
                        onChange={(e) => setRoyaltyReceiverDraft(e.target.value)}
                        placeholder="0x..."
                      />
                    </FieldLabel>
                    <FieldLabel label="Fee (BPS)">
                      <input
                        className="admin-input"
                        value={royaltyFeeDraft}
                        onChange={(e) => setRoyaltyFeeDraft(e.target.value)}
                        placeholder="500"
                      />
                    </FieldLabel>
                  </div>
                  <div className="admin-inline-actions">
                    <Button
                      className="mint-submit-btn admin-action-btn admin-setting-btn"
                      disabled={isBusy || !isOwner || !supportsRoyaltyControls}
                      aria-busy={isBusyAction('update-royalty-settings')}
                      onClick={saveRoyaltySettings}
                    >
                      Save Royalty
                    </Button>
                    <Button
                      className="mint-submit-btn admin-action-btn admin-action-muted admin-setting-btn"
                      disabled={isBusy}
                      onClick={() => {
                        setRoyaltyReceiverDraft(state.royaltyReceiver || '')
                        setRoyaltyFeeDraft(String(Number(state.royaltyFeeBps || 0)))
                      }}
                    >
                      Reset Draft
                    </Button>
                  </div>
                  <p className="admin-setting-help">
                    Use basis points where 100 = 1%. Set fee to 0 to disable royalties (receiver becomes zero address on-chain).
                  </p>
                </div>
              </section>

              <section className="admin-panel admin-panel-global admin-panel-global-evolve-fee">
                <div className="admin-panel-head">
                  <h2>Evolve Fee Settings</h2>
                </div>
                {(!supportsEvolveFeeControls || !supportsEvolveFeeReceiverControls || !supportsEvolveFeeTokenControls) && (
                  <div className="mint-status">
                    Current contract does not expose evolve fee settings controls.
                  </div>
                )}
                <div className="admin-global-settings">
                  <div className="admin-setting-row">
                    <FieldLabel label="Receiver">
                      <input
                        className="admin-input"
                        value={globalEvolveFeeReceiverDraft}
                        onChange={(e) => setGlobalEvolveFeeReceiverDraft(e.target.value)}
                        placeholder="0x..."
                      />
                    </FieldLabel>
                    <FieldLabel label="Fee (USDC)">
                      <input
                        className="admin-input"
                        value={globalEvolveFeeUsdcDraft}
                        onChange={(e) => setGlobalEvolveFeeUsdcDraft(e.target.value)}
                        placeholder="5.0"
                      />
                    </FieldLabel>
                  </div>
                  <p className={`admin-setting-help ${(!evolveFeeUsdcInputValid || evolveFeeUsdcParsed.error) ? 'admin-setting-help-warn' : ''}`}>
                    {evolveFeeUsdcInputValid && !evolveFeeUsdcParsed.error
                      ? `Current fee: ${evolveFeeUsdcParsed.feeLabel} USDC (6 decimals)`
                      : 'Enter a valid USDC amount (up to 6 decimals)'}
                  </p>
                  <div className="admin-inline-actions">
                    <Button
                      className="mint-submit-btn admin-action-btn admin-setting-btn"
                      disabled={isBusy || !isOwner || !supportsEvolveFeeControls || !supportsEvolveFeeReceiverControls || !supportsEvolveFeeTokenControls || !evolveFeeUsdcInputValid || Boolean(evolveFeeUsdcParsed.error)}
                      aria-busy={isBusyAction('update-evolve-fee-settings')}
                      onClick={saveEvolveFeeSettings}
                    >
                      Save USDC Fee
                    </Button>
                    <Button
                      className="mint-submit-btn admin-action-btn admin-action-muted admin-setting-btn"
                      disabled={isBusy}
                      onClick={() => {
                        setGlobalEvolveFeeUsdcDraft(state.evolveFeeTokenAmountUsdc || '0')
                        setGlobalEvolveFeeReceiverDraft(state.evolveFeeReceiver || '')
                      }}
                    >
                      Reset Draft
                    </Button>
                  </div>
                  <p className="admin-setting-help">
                    Charges USDC via <code>transferFrom</code>. Set fee to 0 to disable paid evolve.
                  </p>
                </div>
              </section>

              <section className="admin-panel admin-panel-global admin-panel-task-settings">
                <div className="admin-panel-head">
                  <h2>Task Page Settings</h2>
                </div>
                <div className="admin-global-settings">
                  <div className="admin-setting-row">
                    <FieldLabel label="Pinned Post Link">
                      <input
                        className="admin-input"
                        value={taskPinnedPostDraft}
                        onChange={(e) => setTaskPinnedPostDraft(e.target.value)}
                        placeholder={DEFAULT_TASK_PINNED_POST_LINK}
                      />
                    </FieldLabel>
                    <Button
                      className="mint-submit-btn admin-action-btn admin-setting-btn"
                      disabled={isBusy || !isValidPinnedPostLink(taskPinnedPostDraft)}
                      onClick={saveTaskPageSettings}
                    >
                      Save Link
                    </Button>
                  </div>
                  <div className="admin-inline-actions">
                    <a
                      className="mint-submit-btn admin-action-btn admin-action-muted admin-setting-btn"
                      href={isValidPinnedPostLink(taskPinnedPostDraft) ? taskPinnedPostDraft : DEFAULT_TASK_PINNED_POST_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Link
                    </a>
                    <Button
                      className="mint-submit-btn admin-action-btn admin-action-muted admin-setting-btn"
                      disabled={isBusy || taskPinnedPostDraft === DEFAULT_TASK_PINNED_POST_LINK}
                      onClick={resetTaskPageSettings}
                    >
                      Reset Default
                    </Button>
                  </div>
                  <p className="admin-setting-help">
                    This updates the pinned post used by the task page for both the like/retweet step and the quote-tweet step.
                  </p>
                </div>
              </section>

              <section className="admin-panel admin-panel-placeholder">
                <div className="admin-panel-head">
                  <h2>Placeholder Image</h2>
                </div>
                <textarea className="admin-textarea" value={placeholderDraft} onChange={(e) => setPlaceholderDraft(e.target.value)} placeholder="Paste data:image/... or IPFS URL" rows={6} />
                <div className="admin-form-actions">
                  <Button
                    className="mint-submit-btn admin-action-btn admin-action-muted"
                    disabled={isBusy || !placeholderDraftTrimmed}
                    onClick={() => setPlaceholderDraft(createPlaceholderSvgFromImageUri(placeholderDraftTrimmed))}
                  >
                    Convert To SVG
                  </Button>
                  <Button
                    className="mint-submit-btn admin-action-btn admin-action-muted"
                    disabled={isBusy}
                    onClick={() => setPlaceholderDraft(premiumPlaceholderPreset)}
                  >
                    Use Premium Preset
                  </Button>
                  <Button
                    className="mint-submit-btn admin-action-btn admin-action-muted"
                    disabled={isBusy || !state.placeholderImage}
                    onClick={() => setPlaceholderDraft(state.placeholderImage)}
                  >
                    Reset To On-Chain
                  </Button>
                  <Button
                    className="mint-submit-btn admin-action-btn admin-action-muted"
                    disabled={isBusy || isUploadingPlaceholderToPinata || !placeholderDraftTrimmed}
                    aria-busy={isUploadingPlaceholderToPinata}
                    onClick={uploadPlaceholderDraftToPinata}
                  >
                    {isUploadingPlaceholderToPinata ? 'Uploading To Pinata...' : 'Upload To Pinata'}
                  </Button>
                  <Button className="mint-submit-btn admin-action-btn" disabled={isBusy || !isOwner || !placeholderDraft.trim()} aria-busy={isBusyAction('Updating placeholder image')} onClick={() => runOwnerAction('Updating placeholder image', (contract) => contract.setPlaceholderImage(placeholderDraft.trim()))}>
                    Save Placeholder
                  </Button>
                </div>
                <p className={`admin-setting-help ${placeholderOverSoftLimit ? 'admin-setting-help-warn' : ''}`}>
                  Draft size: {placeholderDraftCharCount.toLocaleString()} chars
                  {placeholderOverSoftLimit ? ' (Large payload may fail on-chain due gas)' : ''}
                </p>
                <p className="admin-setting-help">
                  Pinata flow: Upload draft to Pinata, then click Save Placeholder to write the generated <code>ipfs://...</code> URI on-chain.
                </p>
                <div className="admin-placeholder-preview">
                  <span className="admin-placeholder-preview-label">Preview</span>
                  {placeholderPreviewSource ? (
                    <img className="admin-placeholder-preview-image" src={placeholderPreviewSource} alt="Unrevealed placeholder preview" />
                  ) : (
                    <div className="admin-placeholder-preview-empty">No placeholder image</div>
                  )}
                </div>
              </section>

              <section className="admin-panel admin-panel-ownership">
                <div className="admin-panel-head">
                  <h2>Transfer Ownership</h2>
                </div>
                <input className="admin-input" value={ownershipDraft} onChange={(e) => setOwnershipDraft(e.target.value)} placeholder="0x..." />
                <div className="admin-form-actions">
                  <Button className="mint-submit-btn admin-action-btn admin-action-danger" disabled={isBusy || !isOwner || !ethers.isAddress(ownershipDraft || '')} aria-busy={isBusyAction('Transferring ownership')} onClick={transferOwnershipWithConfirmation}>
                    Transfer Ownership
                  </Button>
                </div>
              </section>

              <section className="admin-panel admin-panel-phases admin-panel-wide">
                <div className="admin-panel-head">
                  <h2>Phases</h2>
                </div>
                {!supportsPhaseControls && (
                  <div className="mint-status">
                    Upgrade required for phase controls on the deployed contract.
                  </div>
                )}
                <div className="admin-phase-form">
                  <FieldLabel label="Phase ID">
                    <input className="admin-input" value={phaseDraft.phaseId} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, phaseId: e.target.value }))} placeholder={`Blank = new ${phases.length}`} />
                  </FieldLabel>
                  <FieldLabel label="Phase Group Title (Optional)">
                    <input className="admin-input" value={phaseDraft.groupTitle} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, groupTitle: e.target.value }))} placeholder="OG Communities" />
                  </FieldLabel>
                  <FieldLabel label="Phase Title">
                    <input className="admin-input" value={phaseDraft.title} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Phase One" />
                  </FieldLabel>
                  <FieldLabel label="Price (ETH)">
                    <input className="admin-input" value={phaseDraft.priceEth} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, priceEth: e.target.value }))} placeholder="0.01" />
                  </FieldLabel>
                  <FieldLabel label="Max Per Phase">
                    <input className="admin-input" value={phaseDraft.maxSupply} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, maxSupply: e.target.value }))} placeholder="0 = unlimited" />
                  </FieldLabel>
                  <FieldLabel label="Max Per Wallet">
                    <input className="admin-input" value={phaseDraft.maxPerWallet} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, maxPerWallet: e.target.value }))} placeholder="0 = use global" />
                  </FieldLabel>
                  <FieldLabel label="Start Time">
                    <input className="admin-input" type="datetime-local" value={phaseDraft.startAt} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, startAt: e.target.value }))} />
                  </FieldLabel>
                  <FieldLabel label="End Time">
                    <input className="admin-input" type="datetime-local" value={phaseDraft.endAt} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, endAt: e.target.value }))} />
                  </FieldLabel>
                  <FieldLabel label="Gap After Previous (min)">
                    <input className="admin-input" value={phaseGapMinutes} onChange={(e) => setPhaseGapMinutes(e.target.value)} placeholder="5" />
                  </FieldLabel>
                  <FieldLabel label="Duration From Start (min)">
                    <input className="admin-input" value={phaseDurationMinutes} onChange={(e) => setPhaseDurationMinutes(e.target.value)} placeholder="60" />
                  </FieldLabel>
                </div>
                <p className="admin-setting-help">
                  Use `Phase Group Title` + `Phase Title` for grouped display (saved as `Group :: Phase`), or leave group empty for a standalone phase title.
                </p>
                <div className="admin-phase-toggle-row">
                  <label className="admin-check">
                    <input type="checkbox" checked={phaseDraft.enabled} onChange={(e) => setPhaseDraft((prev) => ({ ...prev, enabled: e.target.checked }))} />
                    <span>Phase enabled</span>
                  </label>
                </div>
                <div className="admin-inline-actions admin-phase-actions">
                  <Button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !supportsPhaseControls} onClick={applyNextPhaseGap}>
                    Start After Previous
                  </Button>
                  <Button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !supportsPhaseControls} onClick={applyPhaseDuration}>
                    Set End From Duration
                  </Button>
                  <Button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy || !supportsPhaseControls} onClick={checkPhaseOverlap}>
                    Check Overlap
                  </Button>
                  <Button className="mint-submit-btn admin-action-btn" disabled={isBusy || !isOwner || !supportsPhaseControls || !composePhaseName(phaseDraft.groupTitle, phaseDraft.title)} aria-busy={isBusyAction('Saving phase')} onClick={savePhase}>
                    Save Phase
                  </Button>
                  <Button className="mint-submit-btn admin-action-btn admin-action-muted" disabled={isBusy} onClick={resetPhaseForm}>
                    Reset Form
                  </Button>
                </div>
                <div className="admin-section-label">Added Phases</div>
                <p className="admin-setting-help">Drag and drop phase cards to change UI display order (does not change on-chain phase IDs).</p>
                <div className="admin-phase-list">
                  {phases.length === 0 ? (
                    <div className="mint-empty">No phases configured</div>
                  ) : groupedPhases.map((group) => {
                    const isExpanded = !group.label || expandedPhaseGroups[group.key] !== false
                    const groupRenameDraft = String(phaseGroupRenameDrafts[group.key] ?? group.label ?? '')
                    const normalizedGroupRenameDraft = groupRenameDraft.trim().replace(/\s+/g, ' ')
                    const canSaveGroupRename = Boolean(group.label)
                      && normalizedGroupRenameDraft.length > 0
                      && normalizedGroupRenameDraft !== group.label
                    return (
                    <div key={`admin-phase-group-${group.key}`} className="admin-phase-group">
                      {group.label ? (
                        <>
                          <Button
                            type="button"
                            className="admin-phase-group-head admin-phase-group-toggle"
                            onClick={() => setExpandedPhaseGroups((prev) => ({ ...prev, [group.key]: !(prev[group.key] !== false) }))}
                            aria-expanded={isExpanded}
                          >
                            <strong>{group.label}</strong>
                            <small>{group.items.length} sub-phase{group.items.length === 1 ? '' : 's'} {isExpanded ? 'Hide' : 'Show'}</small>
                          </Button>
                          <div className="admin-inline-actions admin-phase-group-rename">
                            <input
                              className="admin-input"
                              value={groupRenameDraft}
                              onChange={(event) => {
                                const value = event.target.value
                                setPhaseGroupRenameDrafts((prev) => ({ ...prev, [group.key]: value }))
                              }}
                              placeholder="Group name"
                            />
                            <Button
                              className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn"
                              disabled={isBusy || !isOwner || !supportsPhaseControls || !canSaveGroupRename}
                              aria-busy={isBusyAction(`rename-phase-group-${group.key}`)}
                              onClick={() => renamePhaseGroup(group)}
                            >
                              Save Group Name
                            </Button>
                          </div>
                        </>
                      ) : null}
                      {isExpanded ? (
                      <div className="admin-phase-sub-list">
                        {group.items.map(({ phase, subLabel, fullLabel }) => (
                          <div
                            key={phase.id}
                            className={`admin-phase-item ${draggingPhaseId === phase.id ? 'is-dragging' : ''}`}
                            draggable
                            onDragStart={(event) => handlePhaseDragStart(phase.id, event)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handlePhaseDrop(phase.id, event)}
                            onDragEnd={handlePhaseDragEnd}
                          >
                            <div>
                              <strong>{(group.label ? subLabel : fullLabel) || `Phase ${phase.id}`}{currentPhaseId === phase.id ? ' (Live)' : ''}</strong>
                              <span>ID: {phase.id}</span>
                              <span>Price: {ethers.formatEther(phase.price || 0n)} ETH</span>
                              <span>Minted: {phase.minted} / {phase.maxSupply || 'unlimited'}</span>
                              <small>Window: {phaseWindowLabel(phase)}</small>
                              <small>Wallet Max: {phase.maxPerWallet || state.maxPerWallet}</small>
                              <small>Status: {phase.enabled ? 'enabled' : 'disabled'}</small>
                            </div>
                            <div className="admin-inline-actions">
                              <Button className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn" onClick={() => loadPhaseIntoForm(phase)}>Edit</Button>
                              <Button className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn" disabled={!supportsPhaseControls || phase.id !== phases.length - 1} aria-busy={isBusyAction(`Deleting phase ${phase.id}`)} onClick={() => runOwnerAction(`Deleting phase ${phase.id}`, (contract) => contract.deletePhase(phase.id))}>Delete</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      ) : null}
                    </div>
                    )
                  })}
                </div>
              </section>

              <section className="admin-panel admin-panel-token admin-panel-wide">
                <div className="admin-panel-head">
                  <h2>Token Inspector</h2>
                </div>
                <div className="admin-inspector-row">
                  <FieldLabel label="Token ID">
                    <input
                      className="admin-input"
                      value={tokenIdInput}
                      onChange={(e) => setTokenIdInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          inspectToken()
                        }
                      }}
                      placeholder="Enter token number"
                    />
                  </FieldLabel>
                  <div className="admin-token-actions">
                    <Button
                      className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn"
                      onClick={inspectToken}
                      aria-busy={isBusyAction('inspect-token')}
                      disabled={!String(tokenIdInput || '').trim()}
                    >
                      Inspect
                    </Button>
                    <Button className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn" onClick={() => { setTokenIdInput(''); setTokenInspect(null) }} disabled={!tokenIdInput && !tokenInspect}>Clear</Button>
                  </div>
                </div>
                {tokenInspect && (
                  <div className="admin-token-card">
                    {tokenInspect.parsedMetadata?.image && (
                      <div className="admin-token-preview">
                        <img src={tokenInspect.parsedMetadata.image} alt={`Token ${tokenInspect.tokenId}`} />
                      </div>
                    )}
                    <div className="admin-token-body">
                      <div className="admin-token-summary">
                        <div className="admin-token-heading">
                          <span className="admin-token-kicker">Token #{tokenInspect.tokenId}</span>
                          <strong>{tokenInspect.tokenName || 'Unnamed Token'}</strong>
                        </div>
                        <div className="admin-token-meta">
                          <div className="admin-stat"><span>Owner</span><strong>{shortAddress(tokenInspect.owner)}</strong></div>
                          <div className="admin-stat"><span>3D</span><strong>{tokenInspect.evolved ? 'Yes' : 'No'}</strong></div>
                          <div className="admin-stat"><span>Metadata</span><strong>{tokenInspect.parsedMetadata ? 'Loaded' : 'Unavailable'}</strong></div>
                          <div className="admin-stat"><span>Traits</span><strong>{tokenInspect.parsedMetadata?.attributes?.length || 0}</strong></div>
                        </div>
                      </div>
                      {tokenInspect.parsedMetadata?.attributes?.length > 0 && (
                        <div className="admin-token-traits-wrap">
                          <div className="admin-token-section-title">Traits</div>
                          <div className="mint-gallery-traits admin-token-traits">
                            {tokenInspect.parsedMetadata.attributes.map((attr, index) => (
                              <span key={`${attr.trait_type}-${index}`} className="mint-gallery-trait">
                                <strong>{attr.trait_type}</strong>
                                <span>{String(attr.value)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!tokenInspect && (
                  <div className="admin-token-empty">
                    Enter a token ID to load owner, metadata preview, and traits.
                  </div>
                )}
              </section>

              <section className="admin-panel admin-panel-wallet">
                <div className="admin-panel-head">
                  <h2>Wallet Inspector</h2>
                </div>
                <div className="admin-inspector-row">
                  <input className="admin-input" value={walletInspectInput} onChange={(e) => setWalletInspectInput(e.target.value)} placeholder="Wallet address" />
                  <Button className="mint-page-btn" onClick={inspectWallet} aria-busy={isBusyAction('inspect-wallet')}>Inspect</Button>
                </div>
                {walletInspect && (
                  <div className="admin-token-meta">
                    <div className="admin-stat"><span>Wallet</span><strong>{shortAddress(walletInspect.address)}</strong></div>
                    <div className="admin-stat"><span>Total Minted</span><strong>{walletInspect.minted}</strong></div>
                    <div className="admin-stat"><span>Current NFT Balance</span><strong>{walletInspect.balance}</strong></div>
                  </div>
                )}
              </section>
            </div>
              ) : activeTab === 'game-stats' ? (
                <div className="admin-grid">
                  <section
                    className="admin-panel admin-panel-game-stats admin-panel-wide"
                    style={{
                      '--game-accent': gameStatsAccent,
                      '--game-accent-soft': gameStatsAccentSoft,
                      '--game-accent-deep': gameStatsAccentDeep,
                      '--game-panel': gameStatsPanel,
                      '--game-panel-soft': mixHex(gameStatsPanel, '#ffffff', 0.08),
                      '--game-ink': gameStatsPalette.ink,
                      '--game-muted': withAlpha(gameStatsPalette.ink, 0.68),
                      '--game-accent-glow': withAlpha(gameStatsAccent, 0.18),
                    }}
                  >
                    <div className="admin-game-hero">
                      <div className="admin-game-hero-copy">
                        <span className="admin-game-kicker">Play To WL Puzzle Stats</span>
                        <h2>Game Performance Dashboard</h2>
                        <p className="admin-panel-copy">
                          Track submissions, proof completion, qualification efficiency, and current leaderboard momentum from one place.
                        </p>
                        <div className="admin-game-periods">
                          {GAME_STATS_PERIODS.map((item) => (
                            <Button
                              key={item.id}
                              className={`admin-game-period-btn ${gameStatsPeriod === item.id ? 'active' : ''}`}
                              type="button"
                              onClick={() => setGameStatsPeriod(item.id)}
                            >
                              {item.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="admin-game-hero-actions">
                        <div className="admin-game-sync-card">
                          <span>{selectedGameStatsPeriodLabel} window</span>
                          <strong>{formatAdminLogTime(gameStats.lastUpdated)}</strong>
                          <small>
                              {gameStats.windowStart
                                ? `From ${formatAdminLogTime(gameStats.windowStart)} to ${formatAdminLogTime(gameStats.windowEnd || gameStats.lastUpdated)}`
                                : `Tracking since ${gameStats.trackedSince ? formatAdminLogTime(gameStats.trackedSince) : 'the first puzzle submission'}`}
                          </small>
                          <small>
                            Source: Puzzle Submissions (leaderboard derived from submitted proof).
                          </small>
                        </div>
                        <div className="admin-game-action-stack">
                          <div className="admin-inline-actions admin-game-main-actions">
                            <Button className="mint-page-btn" onClick={() => fetchGameStatsSummary(false)} aria-busy={isGameStatsLoading}>
                              {isGameStatsLoading ? 'Refreshing...' : 'Refresh Game Stats'}
                            </Button>
                            <Button className="mint-page-btn" onClick={authorizeAdminSession}>
                              {hasUsableAdminSession ? 'Refresh Session' : 'Authorize Session'}
                            </Button>
                            <Button className="mint-page-btn" onClick={exportGameStatsCard} disabled={isGameStatsLoading || !gameStatsReady}>
                              Export {selectedGameStatsPeriodLabel}
                            </Button>
                          </div>
                          <div className="admin-game-maintenance">
                            <span>Maintenance</span>
                            <div className="admin-inline-actions admin-game-maintenance-actions">
                              <Button
                                className="mint-page-btn"
                                type="button"
                                onClick={reconcileLeaderboardWithPuzzle}
                                disabled={Boolean(activeBusyAction)}
                                aria-busy={isBusyAction('reconcile-leaderboard')}
                              >
                                {isBusyAction('reconcile-leaderboard') ? 'Cleaning...' : 'Clean Leaderboard'}
                              </Button>
                              <Button
                                className="mint-page-btn"
                                type="button"
                                onClick={repairLeaderboardFromPuzzle}
                                disabled={Boolean(activeBusyAction)}
                                aria-busy={isBusyAction('repair-leaderboard')}
                              >
                                {isBusyAction('repair-leaderboard') ? 'Repairing...' : 'Repair Leaderboard'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {gameStatsError ? (
                      <div className="mint-status warning">
                        {gameStatsError}{showGameStatsRedeployHint ? '. Redeploy the latest Apps Script version if this is the new stats panel.' : ''}
                      </div>
                    ) : null}
                    <div className="admin-game-primary-grid">
                      {gameStatsPrimary.map((item) => (
                        <article key={item.label} className="admin-game-primary-card">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <small>{item.note}</small>
                        </article>
                      ))}
                    </div>
                    <div className="admin-game-dashboard-grid">
                      <section className="admin-game-panel admin-game-panel-performance">
                          <div className="admin-game-panel-head">
                            <div>
                              <span className="admin-game-panel-label">Leaderboard</span>
                              <h3>Current top 5</h3>
                            </div>
                          </div>
                          <div className="admin-game-feature-grid">
                            <article className="admin-game-feature">
                              <span>Top 5 Leaderboard</span>
                              {Array.isArray(gameStats.leaderboardTop) && gameStats.leaderboardTop.length > 0 ? (
                                <div className="admin-game-top-list">
                                  {gameStats.leaderboardTop.slice(0, 5).map((entry, index) => (
                                    <div key={`${entry.walletAddress || entry.xUsername || entry.browserId || 'player'}-${index}`} className="admin-game-top-row">
                                      <strong>#{index + 1}</strong>
                                      <span>{formatGameIdentityLabel(entry)}</span>
                                    <small>{`Score ${formatCompactNumber(entry.score || 0)} | Moves ${formatCompactNumber(entry.moves || 0)} | Time ${formatGameDuration(entry.timeSec || 0)}`}</small>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p>No ranked qualified players yet.</p>
                            )}
                          </article>
                        </div>
                      </section>
                      <section className="admin-game-panel admin-game-panel-insights">
                        <div className="admin-game-panel-head">
                          <div>
                            <span className="admin-game-panel-label">Key Signals</span>
                            <h3>Essential metrics</h3>
                          </div>
                          <strong>{formatRate(proofSubmissionRate)}</strong>
                        </div>
                        <div className="admin-game-performance-grid">
                          {gameStatsQuickFacts.map((item) => (
                            <article key={item.label} className="admin-game-mini-card">
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </article>
                          ))}
                        </div>
                        <div className="admin-game-source-metrics">
                          <article className="admin-game-source-stat">
                            <span>Top Performer</span>
                            <strong>{topPerformerEntry ? formatGameIdentityLabel(topPerformerEntry) : 'No ranked player yet'}</strong>
                            <small>
                              {topPerformerEntry
                                ? `Score ${formatCompactNumber(topPerformerEntry.score || gameStats.bestScore || 0)} | Time ${formatGameDuration(topPerformerEntry.timeSec || 0)}`
                                : 'No leaderboard rows available yet.'}
                            </small>
                          </article>
                          <article className="admin-game-source-stat">
                            <span>Latest Qualified</span>
                            <strong>{latestQualifiedEntry ? formatGameIdentityLabel(latestQualifiedEntry) : 'No recent qualifier'}</strong>
                            <small>
                              {latestQualifiedEntry
                                ? `${formatAdminLogTime(latestQualifiedAt)} | Score ${formatCompactNumber(latestQualifiedEntry.score || 0)}`
                                : 'A new qualified submission will appear here.'}
                            </small>
                          </article>
                        </div>
                        <div className="admin-game-alert-list">
                          {gameStatsWatchlist.slice(0, 3).map((item, index) => (
                            <article key={`${item.label}-${index}`} className={`admin-game-alert-item ${item.severity}`}>
                              <strong>{item.label}</strong>
                              <p>{item.detail}</p>
                            </article>
                          ))}
                        </div>
                      </section>
                    </div>
                    <div className="mint-status">
                      {selectedGameStatsPeriodLabel} view is simplified to core submission, proof, and leaderboard health metrics.
                    </div>
                  </section>
                </div>
              ) : activeTab === 'whitelist' ? (
                <div className="admin-grid">
                  <section className="admin-panel admin-panel-wide admin-panel-phase-overview">
                    <div className="admin-panel-head">
                      <h2>Whitelist Manager</h2>
                    </div>
                    <div className="mint-status">
                      On-chain phase whitelist manager. Wallet assignments are written to the contract and enforced during mint.
                    </div>
                    <div className="admin-whitelist-shell">
                      <div className="admin-whitelist-phase-card admin-whitelist-phase-card-wide">
                        <div className="admin-whitelist-toolbar">
                          <FieldLabel label="Assign To Phase">
                            <select
                              className="admin-input"
                              value={selectedWhitelistPhaseId}
                              onChange={(e) => setSelectedWhitelistPhaseId(e.target.value)}
                            >
                              <option value="">Select phase</option>
                              {groupedPhases.map((group) => (
                                group.label ? (
                                  <optgroup key={`whitelist-group-${group.key}`} label={group.label}>
                                    {group.items.map(({ phase, subLabel, fullLabel }) => (
                                      <option key={phase.id} value={String(phase.id)}>
                                        {(subLabel || fullLabel || `Phase ${phase.id}`)}
                                      </option>
                                    ))}
                                  </optgroup>
                                ) : (
                                  group.items.map(({ phase, fullLabel }) => (
                                    <option key={phase.id} value={String(phase.id)}>
                                      {fullLabel || `Phase ${phase.id}`}
                                    </option>
                                  ))
                                )
                              ))}
                            </select>
                          </FieldLabel>
                          {selectedWhitelistPhase ? (
                            <div className="admin-whitelist-phase-meta">
                              <strong>{formatPhaseDisplayLabel(selectedWhitelistPhaseParts) || selectedWhitelistPhase.name || `Phase ${selectedWhitelistPhase.id}`}</strong>
                              <span>{selectedWhitelistPhase.enabled ? 'Enabled' : 'Disabled'}</span>
                              <span>{phaseWindowLabel(selectedWhitelistPhase)}</span>
                              <span>{selectedWhitelistAssignedCount} wallets on chain</span>
                            </div>
                          ) : (
                            <div className="admin-token-empty">Select a phase to manage its whitelist.</div>
                          )}
                        </div>
                        <div className="admin-whitelist-stats">
                          <div className="admin-stat">
                            <span>Valid</span>
                            <strong>{whitelistAnalysis.valid.length}</strong>
                          </div>
                          <div className="admin-stat">
                            <span>Duplicates</span>
                            <strong>{whitelistAnalysis.duplicate.length}</strong>
                          </div>
                          <div className="admin-stat">
                            <span>Invalid</span>
                            <strong>{whitelistAnalysis.invalid.length}</strong>
                          </div>
                          <div className="admin-stat">
                            <span>Ready To Add</span>
                            <strong>{whitelistToAdd.length}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="admin-whitelist-editor admin-whitelist-editor-wide">
                        <div className="admin-setting-row">
                          <FieldLabel label="Google Sheet URL">
                            <input
                              className="admin-input"
                              value={googleSheetUrlDraft}
                              onChange={(e) => setGoogleSheetUrlDraft(e.target.value)}
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                            />
                          </FieldLabel>
                          <Button
                            className="mint-submit-btn admin-action-btn"
                            onClick={importGoogleSheet}
                            disabled={!googleSheetUrlDraft.trim() || isBusyAction('import-google-sheet')}
                            aria-busy={isBusyAction('import-google-sheet')}
                          >
                            Import Sheet
                          </Button>
                        </div>
                        <FieldLabel label="Wallet Addresses">
                          <textarea
                            className="admin-textarea"
                            rows={8}
                            value={whitelistDraft}
                            onChange={(e) => setWhitelistDraft(e.target.value)}
                            placeholder={'One address per line or comma separated'}
                          />
                        </FieldLabel>
                        <div className="admin-whitelist-help">
                          Paste addresses, upload CSV/Excel, or import a public Google Sheet. Invalid and duplicate wallet addresses are filtered automatically.
                        </div>
                        {whitelistAnalysis.valid.length > 0 && (
                          <div className="admin-whitelist-preview">
                            <div className="admin-whitelist-preview-head">
                              <strong>Batch Preview</strong>
                              <span>{whitelistAnalysis.valid.length} valid wallet{whitelistAnalysis.valid.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="admin-whitelist-chips">
                              {whitelistAnalysis.valid.slice(0, 8).map((address) => (
                                <span key={address} className="admin-whitelist-chip">{shortAddress(address)}</span>
                              ))}
                              {whitelistAnalysis.valid.length > 8 && (
                                <span className="admin-whitelist-chip">+{whitelistAnalysis.valid.length - 8} more</span>
                              )}
                            </div>
                          </div>
                        )}
                        <input
                          ref={whitelistFileInputRef}
                          type="file"
                          accept=".csv,.xls,.xlsx,.gsheet"
                          onChange={importWhitelistFile}
                          style={{ display: 'none' }}
                        />
                        <div className="admin-whitelist-actions">
                          <div className="admin-whitelist-action-group">
                            <Button className="mint-submit-btn admin-action-btn admin-action-success" onClick={addWhitelistEntries} disabled={!supportsPhaseControls || selectedWhitelistPhaseId === '' || whitelistToAdd.length === 0} aria-busy={isBusyAction('add-phase-whitelist')}>
                              Add To Phase
                            </Button>
                            <Button className="mint-submit-btn admin-action-btn admin-action-danger" onClick={removeWhitelistEntries} disabled={!supportsPhaseControls || selectedWhitelistPhaseId === '' || whitelistToRemove.length === 0} aria-busy={isBusyAction('remove-phase-whitelist')}>
                              Remove From Phase
                            </Button>
                            <Button
                              className="mint-submit-btn admin-action-btn admin-action-danger"
                              onClick={removeAllPhaseWhitelistEntries}
                              disabled={!supportsPhaseControls || selectedWhitelistPhaseId === '' || phaseWhitelistAddresses.length === 0 || !hasReliableWhitelistList || !isWhitelistListComplete}
                              aria-busy={isBusyAction('remove-phase-whitelist-all')}
                            >
                              Remove All In Phase
                            </Button>
                          </div>
                          <div className="admin-whitelist-action-group">
                            <Button className="mint-submit-btn admin-action-btn" onClick={openWhitelistFilePicker}>
                              Upload CSV/Excel
                            </Button>
                            <Button className="mint-submit-btn admin-action-btn" onClick={downloadWhitelistTemplate}>
                              Download Template
                            </Button>
                            <Button className="mint-submit-btn admin-action-btn" onClick={loadOnChainWhitelistToDraft} disabled={phaseWhitelistAddresses.length === 0}>
                              Load On-Chain List
                            </Button>
                            <Button className="mint-submit-btn admin-action-btn" onClick={exportWhitelist} disabled={phaseWhitelistAddresses.length === 0}>
                              Export
                            </Button>
                            <Button className="mint-submit-btn admin-action-btn" onClick={() => setWhitelistDraft('')} disabled={!whitelistDraft.trim()}>
                              Clear Draft
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="admin-panel admin-panel-wide admin-panel-phase-overview">
                    <div className="admin-panel-head">
                      <h2>Phase Assignment Overview</h2>
                    </div>
                    {phases.length === 0 ? (
                      <div className="admin-token-empty">No phases available yet.</div>
                    ) : (
                      <div className="admin-phase-list">
                        {groupedPhases.map((group) => {
                          const isExpanded = !group.label || expandedPhaseGroups[group.key] !== false
                          return (
                          <div key={`overview-group-${group.key}`} className="admin-phase-group">
                            {group.label ? (
                              <Button
                                type="button"
                                className="admin-phase-group-head admin-phase-group-toggle"
                                onClick={() => setExpandedPhaseGroups((prev) => ({ ...prev, [group.key]: !(prev[group.key] !== false) }))}
                                aria-expanded={isExpanded}
                              >
                                <strong>{group.label}</strong>
                                <small>{group.items.length} sub-phase{group.items.length === 1 ? '' : 's'} {isExpanded ? 'Hide' : 'Show'}</small>
                              </Button>
                            ) : null}
                            {isExpanded ? (
                            <div className="admin-phase-sub-list">
                              {group.items.map(({ phase, subLabel, fullLabel }) => {
                                const assigned = phaseWhitelistCounts[String(phase.id)] || 0
                                return (
                                  <div key={`overview-${phase.id}`} className="admin-phase-item">
                                    <div>
                                      <strong>{group.label ? subLabel : fullLabel}</strong>
                                      <small>Assigned wallets: {assigned}</small>
                                    </div>
                                    <div className="admin-inline-actions">
                                      <Button
                                        className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn"
                                        onClick={() => setSelectedWhitelistPhaseId(String(phase.id))}
                                      >
                                        Manage
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            ) : null}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                  <section className="admin-panel admin-panel-wide admin-whitelist-saved-panel">
                    <div className="admin-panel-head">
                      <h2>Saved Addresses</h2>
                      {selectedWhitelistPhaseId !== '' && (
                        <div className="admin-inline-actions">
                          <input
                            className="admin-input admin-whitelist-search"
                            value={whitelistSearch}
                            onChange={(e) => setWhitelistSearch(e.target.value)}
                            placeholder="Search address"
                          />
                        </div>
                      )}
                    </div>
                    {selectedWhitelistPhaseId !== '' ? (
                      isWhitelistLoading ? (
                        <div className="admin-token-empty">Loading on-chain whitelist...</div>
                      ) : whitelistLoadError ? (
                        <div className="admin-token-empty">
                          {whitelistLoadError}
                          {selectedWhitelistAssignedCount > 0 ? ` ${selectedWhitelistAssignedCount} wallet${selectedWhitelistAssignedCount !== 1 ? 's are' : ' is'} assigned on chain.` : ''}
                        </div>
                      ) : phaseWhitelistAddresses.length === 0 ? (
                        <div className="admin-token-empty">No wallets assigned to this phase yet.</div>
                      ) : (
                        <div className="admin-phase-list admin-whitelist-table">
                          <div className="admin-whitelist-header">
                            <span>Wallet</span>
                            <span>Phase</span>
                            <span>Remaining</span>
                            <span>Action</span>
                          </div>
                          {paginatedWhitelistAddresses.map((address) => (
                            <div key={`${selectedWhitelistPhaseId}-${address}`} className="admin-phase-item admin-whitelist-row">
                              <div className="admin-whitelist-row-main">
                                <strong>{shortAddress(address)}</strong>
                                <small>{address}</small>
                              </div>
                              <div className="admin-whitelist-cell">
                                <strong>{formatPhaseDisplayLabel(selectedWhitelistPhaseParts) || selectedWhitelistPhase?.name || `Phase ${selectedWhitelistPhaseId}`}</strong>
                                <small>{selectedWhitelistPhase?.enabled ? 'Enabled' : 'Disabled'}</small>
                              </div>
                              <div className="admin-whitelist-cell">
                                <strong>
                                  {Math.max(
                                    0,
                                    Number((selectedWhitelistPhase?.maxPerWallet || state.maxPerWallet || 0)) - Number(phaseWhitelistMinted[address] || 0)
                                  )}
                                </strong>
                                <small>
                                  {Number(phaseWhitelistMinted[address] || 0)} minted / {Number(selectedWhitelistPhase?.maxPerWallet || state.maxPerWallet || 0)} max
                                </small>
                              </div>
                              <div className="admin-inline-actions">
                                <Button className="mint-submit-btn admin-action-btn admin-action-danger admin-phase-btn" onClick={() => removePhaseWhitelistEntry(String(selectedWhitelistPhaseId), address)}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                          {filteredWhitelistAddresses.length === 0 && (
                            <div className="admin-token-empty">No saved address matches that search.</div>
                          )}
                          {filteredWhitelistAddresses.length > 0 && (
                            <div className="admin-whitelist-pagination">
                              <span>
                                Page {whitelistPage} of {whitelistTotalPages} • {filteredWhitelistAddresses.length} result{filteredWhitelistAddresses.length !== 1 ? 's' : ''}
                              </span>
                              <div className="admin-inline-actions">
                                <Button
                                  className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn"
                                  onClick={() => setWhitelistPage((prev) => Math.max(1, prev - 1))}
                                  disabled={whitelistPage <= 1}
                                >
                                  Prev
                                </Button>
                                <Button
                                  className="mint-submit-btn admin-action-btn admin-action-muted admin-phase-btn"
                                  onClick={() => setWhitelistPage((prev) => Math.min(whitelistTotalPages, prev + 1))}
                                  disabled={whitelistPage >= whitelistTotalPages}
                                >
                                  Next
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="admin-token-empty">Select a phase to view its on-chain whitelist.</div>
                    )}
                  </section>
                </div>
              ) : (
                <div className="admin-grid">
                  <section className="admin-panel admin-panel-log admin-panel-wide">
                    <div className="admin-panel-head">
                      <h2>Activity Log</h2>
                      <div className="admin-inline-actions">
                        <Button className="mint-page-btn" onClick={authorizeAdminSession}>
                          {hasUsableAdminSession ? 'Refresh Session' : 'Authorize Session'}
                        </Button>
                        <Button className="mint-page-btn" onClick={exportActivityLog} disabled={activityLog.length === 0}>Export Log</Button>
                        <Button className="mint-page-btn" onClick={clearActivityLog} disabled={activityLog.length === 0}>Clear Log</Button>
                      </div>
                    </div>
                    {activityLog.length === 0 ? (
                      <div className="mint-status">
                        {hasUsableAdminSession ? 'No admin activity logged yet.' : 'Authorize admin session to load activity log.'}
                      </div>
                    ) : (
                      <div className="admin-log-list">
                        {activityLog.map((entry) => (
                          <div key={entry.id} className={`admin-log-item ${entry.level || 'info'}`}>
                            <div className="admin-log-meta">
                              <span className={`admin-log-level ${entry.level || 'info'}`}>{entry.level || 'info'}</span>
                              <span className="admin-log-source">{entry.source || 'system'}</span>
                              <span className="admin-log-time">{formatAdminLogTime(entry.ts)}</span>
                            </div>
                            <div className="admin-log-message">{entry.message}</div>
                            {entry.txHash && (
                              <a
                                className="admin-log-link"
                                href={`${BLOCK_EXPLORER_URL}/tx/${entry.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {`${entry.txHash.slice(0, 10)}...${entry.txHash.slice(-8)}`}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
            </AdminDisplayShell>
        </>
      </div>
    </div>
  )
}

export default Admin

