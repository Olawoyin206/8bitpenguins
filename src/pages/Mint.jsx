import { useState, useEffect, useRef, useMemo } from 'react'
import { ethers } from 'ethers'
import Button from '../components/Button.jsx'
import ConnectedWallet from '../components/ConnectedWallet.jsx'
import ConnectWalletButton from '../components/ConnectWalletButton.jsx'
import StatusNotice from '../components/StatusNotice.jsx'
import SiteNav from '../components/SiteNav.jsx'
import '../Mint.css'
import { BLOCK_EXPLORER_URL, CHAIN_ID_HEX, CHAIN_NAME, CONTRACT_ADDRESS, ETH_SEPOLIA_RPC, ETH_SEPOLIA_RPC_URLS, MINT_GATE_ADDRESS } from '../contractConfig.js'
import contractABI from '../abi/EightBitPenguinsUpgradeable.abi.js'
import { getSharedReadProvider } from '../readProvider.js'

const NETWORK_RPC_URLS = Array.from(new Set([
  ...(Array.isArray(ETH_SEPOLIA_RPC_URLS) ? ETH_SEPOLIA_RPC_URLS : []),
  ETH_SEPOLIA_RPC,
].filter(Boolean)))
const NORMALIZED_MINT_GATE_ADDRESS = String(MINT_GATE_ADDRESS || '').trim()
const USING_MINT_GATE = Boolean(NORMALIZED_MINT_GATE_ADDRESS)
const MINT_CONTRACT_ADDRESS = NORMALIZED_MINT_GATE_ADDRESS || CONTRACT_ADDRESS
const SHARED_RPC_PROVIDER = getSharedReadProvider()
const DIRECT_MINT_ABI = ['function mint(uint256 quantity) payable']
const GATE_MINT_ABI = ['function mint(uint256 quantity, uint256 maxAllowance, uint256 deadline, bytes signature) payable']
const RENDERER_READ_ABI = ['function getOnchainRenderer() view returns (address)']
const PHASE_READ_ABI = [
  'function phaseCount() view returns (uint256)',
  'function currentPhaseId() view returns (bool exists, uint256 phaseId)',
  'function getPhase(uint256 phaseId) view returns (string name, uint256 price, uint256 startTime, uint256 endTime, uint256 maxSupply, uint256 maxPerWallet, uint256 minted, bool enabled)',
  'function phaseRequiresWhitelistSignature(uint256 phaseId) view returns (bool)',
  'function phaseMintedPerWallet(uint256 phaseId, address account) view returns (uint256)',
]
const CONTRACT_INTERFACE = new ethers.Interface(contractABI)
const PHASE_NAME_GROUP_SEPARATOR = '::'
const PHASE_ORDER_STORAGE_KEY = `penguin:phase-order:${String(MINT_CONTRACT_ADDRESS || '').toLowerCase()}`
const MINT_PHASE_GROUP_ORDER = ['team', 'guaranteed', 'selected communities', 'fcfs', 'public']
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const WHITELIST_PROOF_API_PATH = '/api/whitelist-proof'
const CONTRACT_ERROR_MESSAGES = {
  MintingNotActive: 'Minting is currently paused.',
  MustMintAtLeastOne: 'Quantity must be at least 1.',
  ExceedsMaxSupply: 'Collection is sold out.',
  ExceedsGlobalMaxPerWallet: 'Wallet mint limit reached.',
  PhaseDisabled: 'Active mint phase is disabled.',
  NotWhitelistedForPhase: 'Wallet is not whitelisted for this phase.',
  ExceedsPhaseMaxSupply: 'Phase sold out.',
  ExceedsPhaseMaxPerWallet: 'Phase wallet limit reached.',
  InsufficientPayment: 'Insufficient payment for mint.',
  NoActiveMintPhase: 'No active mint phase.',
  PhaseRequiresWhitelistSignature: 'This phase requires off-chain whitelist proof.',
  PhaseDoesNotRequireWhitelistSignature: 'This phase does not use off-chain whitelist proof.',
  InvalidWhitelistSignature: 'Invalid whitelist proof signature.',
  WhitelistSignatureExpired: 'Whitelist proof expired. Retry mint.',
  InvalidWhitelistAllowance: 'Invalid whitelist allowance.',
  WhitelistAllowanceExceeded: 'Whitelist mint allowance reached.',
  InvalidWhitelistPhase: 'Whitelist proof phase mismatch.',
  DirectMintDisabled: 'Direct mint is disabled on this contract.',
  RendererAddressRequired: 'Contract renderer is not configured.',
  RandomnessHelperAddressRequired: 'Contract randomness helper is not configured.',
  MetadataBuilderAddressRequired: 'Contract metadata builder is not configured.',
  RefundTransferFailed: 'Mint refund transfer failed.',
  WithdrawTransferFailed: 'Contract withdrawal failed.',
}

function decodeContractCustomError(error) {
  const dataCandidates = [
    error?.data,
    error?.error?.data,
    error?.info?.error?.data,
    error?.info?.payload?.data,
    error?.info?.payload?.params?.[0]?.data,
  ]

  for (const candidate of dataCandidates) {
    if (typeof candidate !== 'string' || !candidate.startsWith('0x')) continue
    try {
      const parsed = CONTRACT_INTERFACE.parseError(candidate)
      if (parsed?.name) return parsed
    } catch {
      // Ignore parse failures for non-contract errors.
    }
  }

  return null
}

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (!normalized) return ''
  if (
    normalized.startsWith('error') ||
    normalized.includes('failed') ||
    normalized.includes('rejected') ||
    normalized.includes('not configured')
  ) return 'error'
  if (
    normalized.includes('preparing mint') ||
    normalized.includes('minting...') ||
    normalized.includes('confirming...')
  ) return 'pending'
  if (normalized.startsWith('minted ')) return 'success'
  if (
    normalized.includes('connect your wallet') ||
    normalized.includes('install metamask') ||
    normalized.includes('paused') ||
    normalized.includes('not active') ||
    normalized.includes('sold out') ||
    normalized.includes('limit') ||
    normalized.includes('not whitelisted') ||
    normalized.includes('no active phase') ||
    normalized.includes('adjust quantity')
  ) return 'warning'
  return ''
}

function ensureMessagePunctuation(message) {
  const value = String(message || '').trim()
  if (!value) return ''
  if (value.endsWith('...')) return value
  if (/[.!?]$/.test(value)) return value
  return `${value}.`
}

function formatMintStatusMessage(status) {
  const raw = String(status || '').trim()
  if (!raw) return ''
  const noErrorPrefix = raw.replace(/^Error:\s*/i, '').trim()
  const normalized = noErrorPrefix.toLowerCase()

  const exactMap = {
    'install metamask': 'Install MetaMask to continue',
    'connection failed': 'Wallet connection failed. Try again',
    'wallet disconnected': 'Wallet disconnected',
    'connect wallet first': 'Connect your wallet to continue',
    'minting not active': 'Minting is not active',
    'sold out': 'Collection is sold out',
    'mint unavailable': 'Mint is temporarily unavailable',
  }

  if (Object.prototype.hasOwnProperty.call(exactMap, normalized)) {
    return ensureMessagePunctuation(exactMap[normalized])
  }

  if (/^rpc preflight degraded/i.test(noErrorPrefix)) {
    return ensureMessagePunctuation('Pre-check is degraded. Submitting mint transaction')
  }
  if (/^status sync delayed/i.test(noErrorPrefix)) {
    return ensureMessagePunctuation('Mint status sync is delayed. Retrying')
  }
  if (/^minted\s+\d+/i.test(noErrorPrefix)) {
    return noErrorPrefix
  }
  if (/^error:/i.test(raw)) {
    return ensureMessagePunctuation(`Mint failed: ${noErrorPrefix}`)
  }

  return ensureMessagePunctuation(noErrorPrefix)
}

async function requestWhitelistProof({ wallet, phaseId, mode = 'mint', contractAddress = '' }) {
  const params = new URLSearchParams({
    wallet: String(wallet || ''),
    phaseId: String(Number(phaseId || 0)),
  })
  const normalizedContract = String(contractAddress || '').trim()
  if (normalizedContract) {
    params.set('contract', normalizedContract)
  }
  if (String(mode || '').toLowerCase() === 'check') {
    params.set('checkOnly', '1')
  }

  const response = await fetch(`${WHITELIST_PROOF_API_PATH}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    const message = String(payload?.error || 'Whitelist proof request failed')
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

async function requestWhitelistEligibilityBatch({ wallet, contractAddress = '' }) {
  const params = new URLSearchParams({
    wallet: String(wallet || ''),
    checkOnly: '1',
    allPhases: '1',
    scope: 'all',
    phaseId: '0',
  })
  const normalizedContract = String(contractAddress || '').trim()
  if (normalizedContract) {
    params.set('contract', normalizedContract)
  }

  const response = await fetch(`${WHITELIST_PROOF_API_PATH}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    const message = String(payload?.error || 'Whitelist proof request failed')
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload
}

function computeWalletRemaining(maxPerWallet, mintedCount, phaseMaxPerWallet, phaseMintedCount) {
  const globalRemaining = Number(maxPerWallet) > 0
    ? Math.max(0, Number(maxPerWallet) - Number(mintedCount || 0))
    : Number.POSITIVE_INFINITY
  const phaseRemaining = Number(phaseMaxPerWallet) > 0
    ? Math.max(0, Number(phaseMaxPerWallet) - Number(phaseMintedCount || 0))
    : Number.POSITIVE_INFINITY

  return Math.max(0, Math.min(globalRemaining, phaseRemaining))
}

function formatCountdown(targetMs, nowMs) {
  const diff = Math.max(0, Number(targetMs) - Number(nowMs))
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const remainingAfterDays = totalSeconds % 86400
  const hours = Math.floor(remainingAfterDays / 3600)
  const minutes = Math.floor((remainingAfterDays % 3600) / 60)
  const seconds = totalSeconds % 60
  const timeLabel = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
  return days > 0 ? `${days}d ${timeLabel}` : timeLabel
}

function getPhaseStatus(activePhase, hasPhases, nowMs) {
  if (activePhase) {
    if (activePhase.endTime > 0 && activePhase.endTime * 1000 > nowMs) {
      return {
        state: 'live',
        label: 'Live',
        countdownTarget: activePhase.endTime * 1000,
      }
    }

    return {
      state: 'live',
      label: 'Live',
      countdownTarget: null,
    }
  }

  if (hasPhases) {
    return {
      state: 'closed',
      label: 'No active phase',
      countdownTarget: null,
    }
  }

  return {
    state: 'open',
    label: 'Open mint',
    countdownTarget: null,
  }
}

function getPhaseCardStatus(phase, activePhaseId, nowMs) {
  const nowSeconds = Math.floor(nowMs / 1000)
  if (!phase?.enabled) {
    return { label: 'Disabled', countdown: '', timerLabel: 'Inactive' }
  }
  if (phase.id === activePhaseId) {
    if (phase.endTime > 0 && phase.endTime > nowSeconds) {
      return { label: 'Live', countdown: formatCountdown(phase.endTime * 1000, nowMs), timerLabel: 'Ends in' }
    }
    return { label: 'Live', countdown: 'Open', timerLabel: 'Ends in' }
  }
  if (phase.startTime > 0 && phase.startTime > nowSeconds) {
    return { label: 'Upcoming', countdown: formatCountdown(phase.startTime * 1000, nowMs), timerLabel: 'Starts in' }
  }
  if (phase.endTime > 0 && phase.endTime <= nowSeconds) {
    return { label: 'Ended', countdown: '00:00:00', timerLabel: 'Ended' }
  }
  return { label: 'Scheduled', countdown: 'Open', timerLabel: 'Window' }
}

function getPriorityPhaseForGroup(items, activePhaseId, nowMs) {
  const phases = Array.isArray(items)
    ? items.map((entry) => entry?.phase).filter(Boolean)
    : []
  if (phases.length === 0) return null

  const enabledPhases = phases.filter((phase) => Boolean(phase?.enabled))
  const nowSeconds = Math.floor(Number(nowMs || Date.now()) / 1000)

  const livePhase = enabledPhases.find((phase) => Number(phase.id) === Number(activePhaseId))
  if (livePhase) return livePhase

  const nextUpcomingPhase = [...enabledPhases]
    .filter((phase) => Number(phase.startTime || 0) > nowSeconds)
    .sort((a, b) => Number(a.startTime || 0) - Number(b.startTime || 0))[0]
  if (nextUpcomingPhase) return nextUpcomingPhase

  const firstEnabledPhase = [...enabledPhases]
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))[0]
  if (firstEnabledPhase) return firstEnabledPhase

  return [...phases].sort((a, b) => Number(a.id || 0) - Number(b.id || 0))[0] || null
}

function isPublicPhase(phase) {
  const name = String(phase?.name || '').trim().toLowerCase()
  if (!name) return false
  return /(^|\s|::|[-_/])public(\s|$|::|[-_/])/.test(name)
}

function getPhaseGroupHeaderInfo(items, activePhaseId, nowMs, account, phaseEligibilityMap) {
  const targetPhase = getPriorityPhaseForGroup(items, activePhaseId, nowMs)
  if (!targetPhase) {
    return {
      timerText: '--',
      timerTone: 'muted',
      eligibilityText: '--',
      eligibilityTone: 'muted',
    }
  }

  const info = getPhaseCardStatus(targetPhase, activePhaseId, nowMs)
  let timerTone = 'muted'
  let timerText = info.label || '--'
  if (info.label === 'Live') {
    timerTone = 'live'
    timerText = info.countdown ? `Ends ${info.countdown}` : 'Live'
  } else if (info.label === 'Upcoming') {
    timerTone = 'upcoming'
    timerText = info.countdown ? `Starts ${info.countdown}` : 'Upcoming'
  } else if (info.label === 'Ended') {
    timerTone = 'ended'
    timerText = 'Ended'
  } else if (info.countdown && info.countdown !== 'Open') {
    timerText = info.countdown
  } else if (info.countdown === 'Open') {
    timerTone = 'open'
    timerText = 'Open'
  }

  const phaseEligibility = phaseEligibilityMap?.[targetPhase.id] || null
  const requiresWhitelist = Boolean(
    phaseEligibility?.requiresWhitelist ?? targetPhase?.requiresWhitelist
  )
  const isEligible = Boolean(phaseEligibility?.eligible)

  let eligibilityText = 'Open'
  let eligibilityTone = 'open'

  if (!targetPhase.enabled) {
    eligibilityText = 'Disabled'
    eligibilityTone = 'muted'
  } else if (requiresWhitelist) {
    if (!account) {
      eligibilityText = 'Connect Wallet'
      eligibilityTone = 'muted'
    } else if (isEligible) {
      eligibilityText = 'Eligible'
      eligibilityTone = 'eligible'
    } else {
      eligibilityText = 'Not Eligible'
      eligibilityTone = 'ineligible'
    }
  } else if (!account && isPublicPhase(targetPhase)) {
    eligibilityText = 'Eligible'
    eligibilityTone = 'eligible'
  }

  return {
    timerText,
    timerTone,
    eligibilityText,
    eligibilityTone,
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

function getPhaseDisplayParts(phase) {
  const fallbackLabel = `Phase ${Number(phase?.id ?? 0) + 1}`
  return parsePhaseNameParts(phase?.name, fallbackLabel)
}

function formatPhaseDisplayNameForMint(phase) {
  const parts = getPhaseDisplayParts(phase)
  if (!parts?.fullLabel) return ''
  return parts.grouped ? `${parts.groupLabel} - ${parts.subLabel}` : parts.fullLabel
}

function readStoredPhaseOrder() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PHASE_ORDER_STORAGE_KEY)
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

  return grouped.sort((a, b) => {
    const aKey = normalizePhaseGroupLabel(a.label)
    const bKey = normalizePhaseGroupLabel(b.label)
    const aPriority = getPhaseGroupOrderIndex(a.label)
    const bPriority = getPhaseGroupOrderIndex(b.label)
    const aRank = aPriority >= 0 ? aPriority : Number.MAX_SAFE_INTEGER
    const bRank = bPriority >= 0 ? bPriority : Number.MAX_SAFE_INTEGER
    if (aRank !== bRank) return aRank - bRank
    return aKey.localeCompare(bKey)
  })
}

function normalizePhaseGroupLabel(label) {
  return String(label || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function getKnownPhaseGroupMatch(label) {
  const normalized = normalizePhaseGroupLabel(label)
  const wordList = normalized
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const words = new Set(wordList)

  if (words.has('team') || words.has('treasury')) return 'team'
  if (words.has('gtd') || words.has('guaranteed')) return 'guaranteed'
  if (
    (words.has('og') && (words.has('communities') || words.has('community'))) ||
    (words.has('selected') && (words.has('communities') || words.has('community')))
  ) return 'selected communities'
  if (words.has('fcfs')) return 'fcfs'
  if (words.has('public')) return 'public'

  const matchedLabel = MINT_PHASE_GROUP_ORDER.find((baseLabel) => (
    normalized === baseLabel || normalized.startsWith(`${baseLabel} `)
  ))
  return matchedLabel || ''
}

function formatKnownPhaseGroupLabel(groupKey) {
  switch (String(groupKey || '').toLowerCase()) {
    case 'team':
      return 'Team/Treasury'
    case 'guaranteed':
      return 'Guaranteed'
    case 'selected communities':
      return 'Selected Communities'
    case 'fcfs':
      return 'FCFS'
    case 'public':
      return 'Public'
    default:
      return String(groupKey || '').trim()
  }
}

function getPhaseGroupOrderIndex(label) {
  const matchedLabel = getKnownPhaseGroupMatch(label)
  return matchedLabel ? MINT_PHASE_GROUP_ORDER.indexOf(matchedLabel) : -1
}

function _formatPhaseDate(timestamp) {
  if (!timestamp) return 'Open'
  return new Date(timestamp * 1000).toLocaleString()
}

async function safeRead(call, fallback) {
  try {
    return await call()
  } catch {
    return fallback
  }
}

function formatMintError(error, fallback = 'Unknown error') {
  const parsedCustomError = decodeContractCustomError(error)
  if (parsedCustomError?.name) {
    return CONTRACT_ERROR_MESSAGES[parsedCustomError.name] || `Contract reverted: ${parsedCustomError.name}`
  }

  const candidates = [
    error?.reason,
    error?.shortMessage,
    error?.data?.message,
    error?.error?.message,
    error?.message,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const normalized = String(candidate)
      .replace(/^execution reverted:?\s*/i, '')
      .replace(/^Error:\s*/i, '')
      .trim()
    if (/user rejected|user denied|action_rejected/i.test(normalized)) {
      return 'You rejected the transaction in your wallet.'
    }
    if (/network changed|chain changed/i.test(normalized)) {
      return 'Network changed during mint. Reconnect and try again.'
    }
    if (/insufficient funds/i.test(normalized)) {
      return 'Insufficient wallet balance for value + gas.'
    }
    if (/require\(false\)/i.test(normalized)) {
      return 'Transaction reverted by contract. Check wallet mint limit and phase eligibility.'
    }
    if (/unknown custom error/i.test(normalized)) {
      return 'Transaction reverted by contract. Verify mint phase, whitelist, and payment.'
    }
    if (normalized) return normalized.slice(0, 220)
  }
  return fallback
}

function Mint() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(0)
  const [status, setStatus] = useState('')
  const [isMinting, setIsMinting] = useState(false)
  const [totalSupply, setTotalSupply] = useState(0)
  const [maxSupply, setMaxSupply] = useState(8888)
  const [maxPerWallet, setMaxPerWallet] = useState(50)
  const [quantity, setQuantity] = useState(1)
  const [quantityInput, setQuantityInput] = useState('1')
  const [mintedCount, setMintedCount] = useState(0)
  const [lastTxHash, setLastTxHash] = useState('')
  const [phaseNow, setPhaseNow] = useState(Date.now())
  const [mintPriceEth, setMintPriceEth] = useState('0')
  const [isMintActive, setIsMintActive] = useState(false)
  const [phaseCount, setPhaseCount] = useState(0)
  const [currentPhase, setCurrentPhase] = useState(null)
  const [phases, setPhases] = useState([])
  const [phaseDisplayOrder, setPhaseDisplayOrder] = useState(() => readStoredPhaseOrder())
  const [phaseMintedCount, setPhaseMintedCount] = useState(0)
  const [phaseWhitelistRequired, setPhaseWhitelistRequired] = useState(false)
  const [phaseWhitelistEligible, setPhaseWhitelistEligible] = useState(true)
  const [isRendererConfigured, setIsRendererConfigured] = useState(true)
  const [phaseEligibilityMap, setPhaseEligibilityMap] = useState({})
  const [phaseWalletMintedMap, setPhaseWalletMintedMap] = useState({})
  const [walletChainId, setWalletChainId] = useState('')
  const lastKnownSupplyRef = useRef(0)
  const lastSilentReadErrorRef = useRef(0)
  const lastEligibilitySyncRef = useRef(0)
  const lastEligibilityAccountRef = useRef('')
  const lastEligibilityPhaseIdsRef = useRef('')
  const contractFetchRequestRef = useRef(0)
  const fetchContractDataRef = useRef(() => {})

  useEffect(() => {
    fetchContractDataRef.current(null)
  }, [])

  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      setPhaseNow(Date.now())
    }

    const timer = setInterval(tick, 1000)
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        setPhaseNow(Date.now())
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      clearInterval(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [])

  useEffect(() => {
    if (!window.ethereum) return undefined
    const injectedChainId = typeof window.ethereum.chainId === 'string'
      ? window.ethereum.chainId
      : ''
    if (injectedChainId) setWalletChainId(String(injectedChainId))

    const handleAccountsChanged = (accounts = []) => {
      const address = accounts?.[0] || null
      setIsMinting(false)
      if (!address) {
        contractFetchRequestRef.current += 1
        setAccount(null)
        setBalance(0)
        setMintedCount(0)
        setPhaseMintedCount(0)
        setPhaseWhitelistRequired(false)
        setPhaseWhitelistEligible(true)
        setLastTxHash('')
        setWalletChainId('')
        setStatus('Wallet disconnected')
        return
      }
      setAccount(address)
      setStatus('')
      fetchContractDataRef.current(address, { silent: true })
    }

    const handleChainChanged = (nextChainId) => {
      setWalletChainId(String(nextChainId || ''))
      setIsMinting(false)
      if (account) {
        fetchContractDataRef.current(account, { silent: true })
      }
    }

    window.ethereum.on?.('accountsChanged', handleAccountsChanged)
    window.ethereum.on?.('chainChanged', handleChainChanged)

    return () => {
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [account])

  useEffect(() => {
    const refreshFromContractUpdate = () => {
      fetchContractDataRef.current(account || null, { silent: true })
    }
    const handleStorage = (event) => {
      if (event.key === 'penguin:contract-updated') {
        refreshFromContractUpdate()
      }
    }

    window.addEventListener('penguin:contract-updated', refreshFromContractUpdate)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('penguin:contract-updated', refreshFromContractUpdate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [account])

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      fetchContractDataRef.current(account || null, { silent: true })
    }, 45000)
    return () => clearInterval(intervalId)
  }, [account])

  useEffect(() => {
    lastKnownSupplyRef.current = totalSupply
  }, [totalSupply])

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
    try {
      localStorage.setItem(PHASE_ORDER_STORAGE_KEY, JSON.stringify(phaseDisplayOrder))
    } catch {
      // Ignore storage failures.
    }
  }, [phaseDisplayOrder])

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== PHASE_ORDER_STORAGE_KEY) return
      setPhaseDisplayOrder(readStoredPhaseOrder())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const fetchContractData = async (address, options = {}) => {
    const silent = Boolean(options?.silent)
    const requestId = contractFetchRequestRef.current + 1
    contractFetchRequestRef.current = requestId
    const isStale = () => contractFetchRequestRef.current !== requestId
    try {
      const contract = new ethers.Contract(MINT_CONTRACT_ADDRESS, contractABI, SHARED_RPC_PROVIDER)
      const phaseReadContract = new ethers.Contract(MINT_CONTRACT_ADDRESS, PHASE_READ_ABI, SHARED_RPC_PROVIDER)

      let fallbackMintPriceRaw = 0n
      try {
        fallbackMintPriceRaw = ethers.parseEther(String(mintPriceEth || '0'))
      } catch {
        fallbackMintPriceRaw = 0n
      }

      const [supply, maxS, maxW, mintActive, mintPriceRaw] = await Promise.all([
        safeRead(() => contract.totalSupply(), BigInt(Math.max(0, Number(lastKnownSupplyRef.current || 0)))),
        safeRead(() => contract.MAX_SUPPLY(), BigInt(Math.max(1, Number(maxSupply || 8888)))),
        safeRead(() => contract.MAX_PER_WALLET(), BigInt(Math.max(0, Number(maxPerWallet || 50)))),
        safeRead(() => contract.mintActive(), Boolean(isMintActive)),
        safeRead(() => contract.mintPrice(), fallbackMintPriceRaw),
      ])
      if (isStale()) return
      const totalNum = Number(supply)
      lastKnownSupplyRef.current = totalNum
      setTotalSupply(totalNum)
      setMaxSupply(Number(maxS))
      setMaxPerWallet(Number(maxW))
      setMintPriceEth(ethers.formatEther(mintPriceRaw))
      setIsMintActive(Boolean(mintActive))

      let nextCurrentPhase = null
      let nextEligibilityMap = null
      const unsupported = Symbol('unsupported')
      const rendererAddress = await safeRead(
        () => new ethers.Contract(CONTRACT_ADDRESS, RENDERER_READ_ABI, SHARED_RPC_PROVIDER).getOnchainRenderer(),
        unsupported
      )
      if (rendererAddress === unsupported) {
        setIsRendererConfigured(true)
      } else {
        setIsRendererConfigured(String(rendererAddress || '').toLowerCase() !== ZERO_ADDRESS)
      }
      const [phaseCountRaw, currentPhaseResult] = await Promise.all([
        safeRead(() => phaseReadContract.phaseCount(), unsupported),
        safeRead(() => phaseReadContract.currentPhaseId(), unsupported),
      ])
      if (isStale()) return
      const phaseApiSupported = phaseCountRaw !== unsupported && currentPhaseResult !== unsupported
      const totalPhaseCount = phaseApiSupported ? Number(phaseCountRaw || 0) : 0
      setPhaseCount(totalPhaseCount)

      if (phaseApiSupported) {
        const phaseResults = totalPhaseCount > 0
          ? await Promise.all(
              Array.from({ length: totalPhaseCount }, async (_, index) => {
                const [phase, requiresSignatureRaw] = await Promise.all([
                  phaseReadContract.getPhase(index),
                  safeRead(() => phaseReadContract.phaseRequiresWhitelistSignature(index), unsupported),
                ])
                const requiresWhitelist = requiresSignatureRaw === unsupported ? true : Boolean(requiresSignatureRaw)
                return {
                  id: index,
                  name: phase[0],
                  priceEth: ethers.formatEther(phase[1]),
                  startTime: Number(phase[2]),
                  endTime: Number(phase[3]),
                  maxSupply: Number(phase[4]),
                  maxPerWallet: Number(phase[5]),
                  minted: Number(phase[6]),
                  enabled: Boolean(phase[7]),
                  requiresWhitelist,
                }
              })
            )
          : []
        if (isStale()) return
        setPhases(phaseResults)
        if (address && phaseResults.length > 0) {
          const normalizedAddress = String(address || '').toLowerCase()
          const phaseIdsKey = phaseResults.map((phase) => Number(phase.id || 0)).join(',')
          const cacheExpired = Date.now() - Number(lastEligibilitySyncRef.current || 0) > 180000
          const shouldRefreshEligibility = Boolean(options?.forceEligibility) ||
            !silent ||
            Object.keys(phaseEligibilityMap || {}).length === 0 ||
            Object.keys(phaseWalletMintedMap || {}).length === 0 ||
            cacheExpired ||
            lastEligibilityAccountRef.current !== normalizedAddress ||
            lastEligibilityPhaseIdsRef.current !== phaseIdsKey

          if (shouldRefreshEligibility) {
            const eligibilityBatchByPhase = new Map()
            try {
              const batchPayload = await requestWhitelistEligibilityBatch({
                wallet: address,
                contractAddress: MINT_CONTRACT_ADDRESS,
              })
              const batchPhases = Array.isArray(batchPayload?.phases) ? batchPayload.phases : []
              for (const batchPhase of batchPhases) {
                const batchPhaseId = Number(batchPhase?.phaseId)
                if (!Number.isInteger(batchPhaseId) || batchPhaseId < 0) continue
                eligibilityBatchByPhase.set(batchPhaseId, batchPhase)
              }
            } catch {
              // Fallback to per-phase checks when batch is unavailable.
            }

            const eligibilityEntries = await Promise.all(
              phaseResults.map(async (phase) => {
                const requiresSignature = Boolean(phase.requiresWhitelist)
                let eligible = !requiresSignature
                if (requiresSignature) {
                  const batchPhase = eligibilityBatchByPhase.get(Number(phase.id))
                  if (batchPhase && !batchPhase.error) {
                    eligible = Boolean(batchPhase?.eligible) && Number(batchPhase?.maxAllowance || 0) > 0
                  } else {
                    try {
                      const proofCheck = await requestWhitelistProof({
                        wallet: address,
                        phaseId: phase.id,
                        mode: 'check',
                        contractAddress: MINT_CONTRACT_ADDRESS,
                      })
                      eligible = Boolean(proofCheck?.eligible)
                    } catch {
                      eligible = false
                    }
                  }
                }
                const mintedByWallet = Number(await safeRead(() => phaseReadContract.phaseMintedPerWallet(phase.id, address), 0))
                return [phase.id, { requiresWhitelist: requiresSignature, eligible, mintedByWallet }]
              })
            )
            if (isStale()) return
            const eligibility = {}
            const mintedByPhase = {}
            eligibilityEntries.forEach(([phaseId, value]) => {
              eligibility[phaseId] = { requiresWhitelist: value.requiresWhitelist, eligible: value.eligible }
              mintedByPhase[phaseId] = Number(value.mintedByWallet || 0)
            })
            nextEligibilityMap = eligibility
            setPhaseEligibilityMap(eligibility)
            setPhaseWalletMintedMap(mintedByPhase)
            lastEligibilitySyncRef.current = Date.now()
            lastEligibilityAccountRef.current = normalizedAddress
            lastEligibilityPhaseIdsRef.current = phaseIdsKey
          }
        } else {
          setPhaseEligibilityMap({})
          setPhaseWalletMintedMap({})
          lastEligibilitySyncRef.current = 0
          lastEligibilityAccountRef.current = ''
          lastEligibilityPhaseIdsRef.current = ''
        }

        const phaseExists = Array.isArray(currentPhaseResult) ? currentPhaseResult[0] : currentPhaseResult?.exists
        const phaseIdValue = Array.isArray(currentPhaseResult) ? currentPhaseResult[1] : currentPhaseResult?.phaseId
        if (phaseExists) {
          nextCurrentPhase = phaseResults.find((phase) => phase.id === Number(phaseIdValue)) || null
        }
      } else {
        setPhases([])
        setPhaseEligibilityMap({})
        setPhaseWalletMintedMap({})
      }
      if (isStale()) return
      setCurrentPhase(nextCurrentPhase)

      if (!silent) {
        setStatus(mintActive ? '' : 'Minting not active')
      } else if (!isMinting) {
        setStatus((prev) => {
          if (!prev) return prev
          if (
            /^Minted\s/i.test(prev) ||
            /Preparing mint|Minting\.\.\.|Confirming/i.test(prev)
          ) {
            return prev
          }
          return ''
        })
      }
      
      if (address) {
        const addressReads = [
          safeRead(() => contract.balanceOf(address), 0n),
          safeRead(() => contract.mintedPerWallet(address), 0n),
        ]
        if (nextCurrentPhase) {
          addressReads.push(safeRead(() => phaseReadContract.phaseMintedPerWallet(nextCurrentPhase.id, address), 0))
        }
        const [bal, minted, phaseMinted] = await Promise.all(addressReads)
        if (isStale()) return
        setBalance(Number(bal))
        setMintedCount(Number(minted))
        setPhaseMintedCount(Number(phaseMinted || 0))
        const activeEligibilityMap = nextEligibilityMap || phaseEligibilityMap || {}
        const activePhaseId = Number(nextCurrentPhase?.id)
        const activeEntry = Number.isInteger(activePhaseId) && activePhaseId >= 0
          ? activeEligibilityMap?.[activePhaseId]
          : null
        const requiresSignature = activeEntry
          ? Boolean(activeEntry.requiresWhitelist)
          : Boolean(nextCurrentPhase?.requiresWhitelist ?? true)
        const phaseEligible = requiresSignature ? Boolean(activeEntry?.eligible) : true
        setPhaseWhitelistRequired(requiresSignature)
        setPhaseWhitelistEligible(requiresSignature ? phaseEligible : true)
        if (nextCurrentPhase) {
          const activeMinted = Number(phaseMinted || 0)
          const activeRequiresWhitelist = requiresSignature
          const activeEligible = activeRequiresWhitelist ? Boolean(phaseEligible) : true
          setPhaseWalletMintedMap((prev) => {
            if (Number(prev?.[activePhaseId]) === activeMinted) return prev
            return { ...(prev || {}), [activePhaseId]: activeMinted }
          })
          setPhaseEligibilityMap((prev) => {
            const previousEntry = prev?.[activePhaseId]
            if (
              previousEntry &&
              Boolean(previousEntry.requiresWhitelist) === activeRequiresWhitelist &&
              Boolean(previousEntry.eligible) === activeEligible
            ) {
              return prev
            }
            return {
              ...(prev || {}),
              [activePhaseId]: { requiresWhitelist: activeRequiresWhitelist, eligible: activeEligible },
            }
          })
        }
      } else {
        setPhaseMintedCount(0)
        if (nextCurrentPhase) {
          const requiresSignature = Boolean(nextCurrentPhase?.requiresWhitelist ?? true)
          if (isStale()) return
          setPhaseWhitelistRequired(requiresSignature)
          setPhaseWhitelistEligible(!requiresSignature)
        } else {
          setPhaseWhitelistRequired(false)
          setPhaseWhitelistEligible(true)
        }
      }
    } catch (err) {
      if (isStale()) return
      console.error('Contract error:', err)
      if (!silent) {
        setStatus(`Error: ${formatMintError(err, 'Check network')}`)
      } else if (!isMinting) {
        const now = Date.now()
        if (now - Number(lastSilentReadErrorRef.current || 0) > 15000) {
          lastSilentReadErrorRef.current = now
          setStatus((prev) => prev || 'Status sync delayed. Retrying...')
        }
      }
    }
  }
  fetchContractDataRef.current = fetchContractData

  const connect = async () => {
    if (!window.ethereum) {
      setStatus('Install MetaMask')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const address = accounts?.[0]
      if (!address) throw new Error('No account selected')
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return
      setWalletChainId(String(CHAIN_ID_HEX))
      setAccount(address)
      fetchContractData(address)
      setStatus('')
    } catch {
      setStatus('Connection failed')
    }
  }

  const disconnectWallet = async () => {
    contractFetchRequestRef.current += 1
    setAccount(null)
    setBalance(0)
    setMintedCount(0)
    setStatus('Wallet disconnected')
    setLastTxHash(null)
  }

  const ensureConfiguredEthereumNetwork = async () => {
    try {
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
      if (String(currentChainId).toLowerCase() === String(CHAIN_ID_HEX).toLowerCase()) return true

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      })
      setWalletChainId(String(CHAIN_ID_HEX))
      setStatus('')
      return true
    } catch {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: CHAIN_ID_HEX,
            chainName: CHAIN_NAME,
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: NETWORK_RPC_URLS,
            blockExplorerUrls: [BLOCK_EXPLORER_URL],
          }],
        })
        setWalletChainId(String(CHAIN_ID_HEX))
        setStatus('')
        return true
      } catch {
        setStatus(`Switch to ${CHAIN_NAME} in your wallet`)
        return false
      }
    }
  }

  const mint = async () => {
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    if (isWrongNetwork) {
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return
    }
    if (!isRendererConfigured) {
      setStatus('Contract renderer is not configured')
      return
    }
    if (!isMintActive) {
      setStatus('Minting is currently paused')
      return
    }
    if (phaseWhitelistBlocked) {
      setStatus('Wallet is not eligible for this phase')
      return
    }
    const liveActivePhase = currentPhase
    const liveGlobalWalletRemaining = Math.max(0, maxPerWallet - mintedCount)
    const livePhaseWalletRemaining = liveActivePhase?.maxPerWallet > 0
      ? Math.max(0, liveActivePhase.maxPerWallet - phaseMintedCount)
      : Number.POSITIVE_INFINITY
    const liveWalletRemaining = computeWalletRemaining(
      maxPerWallet,
      mintedCount,
      liveActivePhase?.maxPerWallet || 0,
      phaseMintedCount
    )
    const livePhaseRemaining = liveActivePhase?.maxSupply > 0
      ? Math.max(0, liveActivePhase.maxSupply - liveActivePhase.minted)
      : Math.max(0, maxSupply - totalSupply)
    const livePhaseClosed = phaseCount > 0 && !liveActivePhase
    const liveMintCap = Math.max(
      0,
      Math.min(liveWalletRemaining, Math.max(0, maxSupply - totalSupply), livePhaseClosed ? 0 : livePhaseRemaining)
    )
    if (liveGlobalWalletRemaining <= 0) {
      setStatus('Wallet mint limit reached')
      return
    }
    if (livePhaseWalletRemaining <= 0) {
      setStatus('Phase wallet limit reached')
      return
    }
    if (livePhaseRemaining <= 0) {
      setStatus('Phase sold out')
      return
    }
    if (livePhaseClosed) {
      setStatus('No active mint phase')
      return
    }
    if (liveMintCap <= 0) {
      setStatus('Mint unavailable')
      return
    }
    const safeQuantity = Math.max(1, Math.min(Number(quantity) || 1, liveMintCap))
    if (safeQuantity !== quantity) {
      setQuantity(safeQuantity)
      setQuantityInput(String(safeQuantity))
    }
    try {
      setIsMinting(true)
      const switched = await ensureConfiguredEthereumNetwork()
      if (!switched) return
      setStatus('Preparing mint...')
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const signerAddress = String(await signer.getAddress()).toLowerCase()
      if (signerAddress !== String(account).toLowerCase()) {
        setStatus('Wallet mismatch. Reconnect the intended wallet.')
        return
      }
      const contract = new ethers.Contract(MINT_CONTRACT_ADDRESS, contractABI, signer)
      const phaseReadContract = new ethers.Contract(MINT_CONTRACT_ADDRESS, PHASE_READ_ABI, signer)

      let mintPrice = 0n
      let whitelistMintProof = null
      try {
        mintPrice = ethers.parseEther(String(displayPrice || '0'))
      } catch {
        mintPrice = 0n
      }

      try {
        const [onchainMintActive, onchainSupply, onchainMaxSupply, onchainMaxPerWallet, onchainMintedPerWallet] = await Promise.all([
          contract.mintActive(),
          contract.totalSupply(),
          contract.MAX_SUPPLY(),
          contract.MAX_PER_WALLET(),
          contract.mintedPerWallet(signerAddress),
        ])

        if (!onchainMintActive) {
          setStatus('Minting is currently paused')
          return
        }
        if (onchainSupply + BigInt(safeQuantity) > onchainMaxSupply) {
          setStatus('Sold out')
          return
        }
        if (onchainMintedPerWallet + BigInt(safeQuantity) > onchainMaxPerWallet) {
          setStatus(`Wallet mint limit reached (${onchainMintedPerWallet.toString()}/${onchainMaxPerWallet.toString()})`)
          return
        }

        mintPrice = await contract.mintPrice()
        const currentPhaseResult = await phaseReadContract.currentPhaseId()
        const phaseExists = Array.isArray(currentPhaseResult) ? currentPhaseResult[0] : currentPhaseResult?.exists
        const phaseIdValue = Array.isArray(currentPhaseResult) ? currentPhaseResult[1] : currentPhaseResult?.phaseId
        if (phaseExists) {
          const phase = await phaseReadContract.getPhase(phaseIdValue)
          const phaseEnabled = Boolean(Array.isArray(phase) ? phase[7] : phase?.enabled)
          if (!phaseEnabled) {
            setStatus('Active phase is disabled')
            return
          }
          const phaseMaxSupply = Number(Array.isArray(phase) ? phase[4] : phase?.maxSupply || 0)
          const phaseMinted = Number(Array.isArray(phase) ? phase[6] : phase?.minted || 0)
          if (phaseMaxSupply > 0 && phaseMinted + safeQuantity > phaseMaxSupply) {
            setStatus('Phase sold out')
            return
          }
          const phaseMaxPerWallet = Number(Array.isArray(phase) ? phase[5] : phase?.maxPerWallet || 0)
          const phaseMintedByWallet = Number(await safeRead(() => phaseReadContract.phaseMintedPerWallet(phaseIdValue, signerAddress), 0))
          if (phaseMaxPerWallet > 0) {
            if (phaseMintedByWallet + safeQuantity > phaseMaxPerWallet) {
              setStatus('Phase wallet limit reached')
              return
            }
          }
          const requiresSignature = Boolean(await safeRead(
            () => phaseReadContract.phaseRequiresWhitelistSignature(phaseIdValue),
            false
          ))
          if (requiresSignature) {
            setStatus('Fetching whitelist proof...')
            let proofPayload = null
            try {
              proofPayload = await requestWhitelistProof({
                wallet: signerAddress,
                phaseId: Number(phaseIdValue),
                mode: 'mint',
                contractAddress: MINT_CONTRACT_ADDRESS,
              })
            } catch (proofError) {
              setStatus(`Error: ${formatMintError(proofError, 'Wallet is not eligible for this phase')}`)
              return
            }

            const maxAllowance = Number(proofPayload?.maxAllowance || 0)
            const deadline = Number(proofPayload?.deadline || 0)
            if (!proofPayload?.signature || maxAllowance <= 0 || deadline <= Math.floor(Date.now() / 1000)) {
              setStatus('Whitelist proof is invalid or expired. Retry mint.')
              return
            }
            if (phaseMintedByWallet + safeQuantity > maxAllowance) {
              setStatus(`Whitelist allowance reached (${phaseMintedByWallet}/${maxAllowance})`)
              return
            }

            whitelistMintProof = {
              phaseId: Number(phaseIdValue),
              maxAllowance,
              deadline,
              signature: String(proofPayload.signature),
            }
          }
          mintPrice = phase[1]
        }
      } catch (preflightError) {
        console.warn('Mint preflight degraded:', preflightError)
        setStatus('RPC preflight degraded. Submitting mint transaction...')
      }

      const mintValue = mintPrice * BigInt(safeQuantity)
      const directMintContract = new ethers.Contract(MINT_CONTRACT_ADDRESS, DIRECT_MINT_ABI, signer)
      const gateMintContract = new ethers.Contract(MINT_CONTRACT_ADDRESS, GATE_MINT_ABI, signer)
      let tx = null
      try {
        setStatus('Minting...')
        if (USING_MINT_GATE) {
          tx = await gateMintContract.mint(
            safeQuantity,
            BigInt(whitelistMintProof?.maxAllowance || 0),
            BigInt(whitelistMintProof?.deadline || 0),
            String(whitelistMintProof?.signature || '0x'),
            { value: mintValue }
          )
        } else {
          tx = await directMintContract.mint(safeQuantity, { value: mintValue })
        }
      } catch (directMintError) {
        setStatus(`Error: ${formatMintError(directMintError, 'Mint transaction failed')}`)
        return
      }
      setLastTxHash(tx.hash)
      setStatus('Confirming...')
      await tx.wait()
      
      setStatus(`Minted ${safeQuantity} NFT${safeQuantity > 1 ? 's' : ''}!`)
      
      fetchContractData(account, { silent: true })
      try {
        const payload = { ts: Date.now(), account: String(account || '').toLowerCase(), source: 'mint' }
        localStorage.setItem('penguin:nft-updated', JSON.stringify(payload))
        window.dispatchEvent(new CustomEvent('penguin:nft-updated', { detail: payload }))
      } catch {
        // Ignore local notification storage failures.
      }
    } catch (err) {
      setStatus(`Error: ${formatMintError(err)}`)
    } finally {
      setIsMinting(false)
    }
  }

  const handleSwitchNetwork = async () => {
    const switched = await ensureConfiguredEthereumNetwork()
    if (switched && account) {
      fetchContractDataRef.current(account, { silent: true })
    }
  }

  const progress = maxSupply > 0
    ? Math.min(100, Math.max(0, (totalSupply / maxSupply) * 100))
    : 0
  const activePhase = currentPhase
  const nextUpcomingPhase = phases
    .filter((phase) => phase?.enabled && phase.startTime > Math.floor(phaseNow / 1000))
    .sort((a, b) => a.startTime - b.startTime)[0] || null
  const phaseStatus = getPhaseStatus(activePhase, phaseCount > 0, phaseNow)
  const summaryPhase = activePhase || nextUpcomingPhase || null
  const summaryPhaseDisplayName = summaryPhase ? formatPhaseDisplayNameForMint(summaryPhase) : ''
  const summaryHeading = activePhase ? 'Current Phase' : nextUpcomingPhase ? 'Upcoming Phase' : 'Phase Status'
  const summaryStatusLabel = activePhase ? phaseStatus.label : nextUpcomingPhase ? 'Upcoming' : phaseStatus.label
  const summaryStatusTone = activePhase
    ? 'live'
    : nextUpcomingPhase
      ? 'upcoming'
      : (phaseStatus.state === 'open' ? 'live' : 'closed')
  const summaryTimerLabel = activePhase ? (phaseStatus.countdownTarget ? 'Ends In' : 'Status') : nextUpcomingPhase ? 'Starts In' : 'Availability'
  const summaryTimerValue = activePhase
    ? (phaseStatus.countdownTarget ? formatCountdown(phaseStatus.countdownTarget, phaseNow) : 'LIVE')
    : nextUpcomingPhase
      ? formatCountdown(nextUpcomingPhase.startTime * 1000, phaseNow)
      : (phaseStatus.state === 'open' ? 'Open' : 'Closed')
  const summaryWalletCap = summaryPhase
    ? (summaryPhase.maxPerWallet > 0 ? summaryPhase.maxPerWallet : maxPerWallet)
    : (phaseCount > 0 ? 0 : maxPerWallet)
  const summaryPhaseMinted = summaryPhase && account
    ? Number(phaseWalletMintedMap[summaryPhase.id] || 0)
    : (!summaryPhase && phaseCount === 0 && account ? Number(mintedCount || 0) : null)
  const summaryLimitDisplay = summaryPhase
    ? `${summaryPhaseMinted !== null ? summaryPhaseMinted : '--'}/${summaryWalletCap > 0 ? summaryWalletCap : 'Unlimited'}`
    : (phaseCount === 0
      ? `${summaryPhaseMinted !== null ? summaryPhaseMinted : '--'}/${summaryWalletCap > 0 ? summaryWalletCap : 'Unlimited'}`
      : 'Closed')
  const summaryEligibility = summaryPhase ? phaseEligibilityMap?.[summaryPhase.id] : null
  const summaryRequiresWhitelist = Boolean(
    summaryEligibility?.requiresWhitelist ?? summaryPhase?.requiresWhitelist
  )
  const summaryEligible = Boolean(summaryEligibility?.eligible)
  const summaryIsActivePhase = Boolean(activePhase && summaryPhase && Number(activePhase.id) === Number(summaryPhase.id))
  const summaryAccessLabel = !summaryPhase
    ? (phaseCount === 0 ? (account ? 'Open Mint' : 'Connect Wallet') : 'Closed')
    : !account
      ? (summaryRequiresWhitelist ? 'Connect Wallet' : (isPublicPhase(summaryPhase) ? 'Eligible' : 'Open'))
      : summaryRequiresWhitelist
        ? (summaryEligible ? (summaryIsActivePhase ? 'Whitelisted' : 'Eligible') : (summaryIsActivePhase ? 'No Access' : 'Not Eligible'))
        : (summaryIsActivePhase ? 'Open Phase' : 'Open')
  const summaryAccessTone = !summaryPhase
    ? (phaseCount === 0 ? (account ? 'allowed' : 'connect') : 'muted')
    : !account
      ? (summaryRequiresWhitelist ? 'connect' : (isPublicPhase(summaryPhase) ? 'allowed' : 'open'))
      : summaryRequiresWhitelist
        ? (summaryEligible ? (summaryIsActivePhase ? 'live' : 'allowed') : 'blocked')
        : (summaryIsActivePhase ? 'live' : 'allowed')
  const phaseWalletLimit = activePhase?.maxPerWallet > 0 ? activePhase.maxPerWallet : 0
  const globalWalletRemaining = Math.max(0, maxPerWallet - mintedCount)
  const phaseWalletRemaining = phaseWalletLimit > 0
    ? Math.max(0, phaseWalletLimit - phaseMintedCount)
    : Number.POSITIVE_INFINITY
  const walletRemaining = computeWalletRemaining(
    maxPerWallet,
    mintedCount,
    activePhase?.maxPerWallet || 0,
    phaseMintedCount
  )
  const phaseRemaining = activePhase?.maxSupply > 0
    ? Math.max(0, activePhase.maxSupply - activePhase.minted)
    : Math.max(0, maxSupply - totalSupply)
  const phaseClosedByUi = phaseCount > 0 && !activePhase
  const phaseWhitelistBlocked = Boolean(activePhase) && phaseWhitelistRequired && !phaseWhitelistEligible
  const displayPrice = activePhase?.priceEth?.trim() || mintPriceEth || '0'
  const configuredChainId = String(CHAIN_ID_HEX || '').toLowerCase()
  const isWrongNetwork = Boolean(account) && Boolean(walletChainId) && String(walletChainId).toLowerCase() !== configuredChainId
  const activePhaseId = activePhase?.id ?? null
  const orderedPhases = useMemo(() => {
    if (!phases.length) return []
    const rankByPhaseId = new Map((phaseDisplayOrder || []).map((phaseId, idx) => [Number(phaseId), idx]))
    return [...phases].sort((a, b) => {
      const aId = Number(a.id)
      const bId = Number(b.id)
      const aRank = rankByPhaseId.has(aId) ? rankByPhaseId.get(aId) : Number.MAX_SAFE_INTEGER
      const bRank = rankByPhaseId.has(bId) ? rankByPhaseId.get(bId) : Number.MAX_SAFE_INTEGER
      if (aRank !== bRank) return aRank - bRank
      return aId - bId
    })
  }, [phases, phaseDisplayOrder])
  const groupedPhaseSchedule = useMemo(() => groupPhasesForDisplay(orderedPhases), [orderedPhases])
  const [expandedPhaseGroups, setExpandedPhaseGroups] = useState({})
  useEffect(() => {
    setExpandedPhaseGroups((prev) => {
      const next = {}
      let changed = false
      groupedPhaseSchedule.forEach((group) => {
        if (!group.label) return
        const existing = Object.prototype.hasOwnProperty.call(prev, group.key) ? prev[group.key] : false
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
  }, [groupedPhaseSchedule])
  const mintCap = Math.max(0, Math.min(walletRemaining, Math.max(0, maxSupply - totalSupply), phaseClosedByUi ? 0 : phaseRemaining))
  const mintBlockedReason = !account
      ? 'Connect Wallet'
    : isWrongNetwork
      ? 'Wrong Network'
    : !isRendererConfigured
      ? 'Renderer Missing'
    : !isMintActive
      ? 'Mint Closed'
      : totalSupply >= maxSupply
        ? 'Sold Out'
        : phaseWhitelistBlocked
          ? 'Not Whitelisted'
          : globalWalletRemaining <= 0
            ? 'Wallet Limit Reached'
            : phaseWalletRemaining <= 0
              ? 'Phase Limit Reached'
            : phaseRemaining <= 0
              ? 'Phase Sold Out'
              : phaseClosedByUi
                ? 'Phase Closed'
                : quantity < 1
                  ? 'Enter Quantity'
                : quantity > mintCap
                  ? 'Adjust Quantity'
                  : ''
  const isMintBlocked = Boolean(mintBlockedReason)
  const parsedQuantity = Number(quantity)
  const quantityForPrice = Math.max(
    0,
    Math.min(
      Number.isFinite(parsedQuantity) ? Math.floor(parsedQuantity) : 0,
      mintCap > 0 ? mintCap : 0
    )
  )
  const totalPriceLabel = (() => {
    try {
      const unitPriceWei = ethers.parseEther(String(displayPrice || '0'))
      const totalPriceWei = unitPriceWei * BigInt(quantityForPrice)
      const [whole, fractional = ''] = ethers.formatEther(totalPriceWei).split('.')
      const trimmedFractional = fractional.replace(/0+$/g, '')
      return trimmedFractional ? `${whole}.${trimmedFractional}` : whole
    } catch {
      return String(displayPrice || '0')
    }
  })()
  const summaryMintPriceLabel = summaryPhase
    ? `${summaryPhase.priceEth || '0'} ETH`
    : phaseCount === 0
      ? `${displayPrice || '0'} ETH`
      : 'Closed'
  const summaryTimerTone = summaryStatusTone === 'live'
    ? 'live'
    : summaryStatusTone === 'upcoming'
      ? 'upcoming'
      : 'muted'
  const statusMessage = useMemo(() => formatMintStatusMessage(status), [status])

  const handleQuantityInputChange = (event) => {
    const raw = String(event?.target?.value || '').replace(/[^\d]/g, '')
    setQuantityInput(raw)
    if (!raw) {
      setQuantity(0)
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    setQuantity(Math.max(1, Math.floor(parsed)))
  }

  const applyQuantityBounds = (value) => {
    const cap = mintCap > 0 ? mintCap : 1
    const parsed = Number(value)
    const next = Number.isFinite(parsed) ? Math.floor(parsed) : 1
    const safe = Math.max(1, Math.min(next, cap))
    setQuantity(safe)
    setQuantityInput(String(safe))
  }

  const decrementQuantity = () => {
    const next = Math.max(1, Number(quantity || 1) - 1)
    setQuantity(next)
    setQuantityInput(String(next))
  }

  const incrementQuantity = () => {
    const cap = mintCap > 0 ? mintCap : 1
    const next = Math.min(cap, Number(quantity || 1) + 1)
    setQuantity(next)
    setQuantityInput(String(next))
  }

  const MintCardShell = 'div'
  const MintDisplayShell = 'div'

  return (
    <>
    <div className="mint-page mint-admin-skin">
      <SiteNav label="Collect / Mint" />

        {/* Two Column Layout */}
        <div className="mint-layout">
          {/* Left Column - Mint Card */}
          <MintCardShell className="mint-card">
            <div className="mint-card-header">
              <span className="mint-card-title">Mint</span>
              <span className="mint-card-badge">{Number(displayPrice) > 0 ? `${displayPrice} ETH` : 'Free'}</span>
            </div>

            {/* Supply Display */}
            <div className="mint-supply">
              <div className="mint-supply-header">
                <span className="mint-supply-label">Minted</span>
                <span className="mint-supply-value">
                  <span className="mint-supply-current">{totalSupply}</span>
                  <span className="mint-supply-separator">{' / '}</span>
                  <span className="mint-supply-max">{maxSupply}</span>
                </span>
              </div>
              <div className="mint-supply-bar">
                <div className="mint-supply-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="mint-supply-footer">
                <span className="mint-supply-remaining">{Math.max(0, maxSupply - totalSupply)} remaining</span>
                <span className="mint-supply-percent">{Math.round(progress)}%</span>
              </div>
            </div>

            <div className="mint-action-stack">
              <div className="mint-action-head">
                <span className="mint-action-label">Mint Actions</span>
              </div>

              {!account ? (
                <ConnectWalletButton
                  className="mint-connect-hero"
                  label="Connect Wallet To Mint"
                  onClick={connect}
                  size="lg"
                  block
                />
              ) : (
                <div className="mint-connected">
                  <ConnectedWallet
                    label="Connected Wallet"
                    address={`${account.slice(0, 4)}...${account.slice(-3)}`}
                    badge={`${balance} Penguins`}
                    onDisconnect={disconnectWallet}
                  />

                  {isWrongNetwork ? (
                    <Button
                      className="mint-network-btn"
                      variant="secondary"
                      size="md"
                      onClick={handleSwitchNetwork}
                      disabled={isMinting}
                    >
                      {`Switch To ${CHAIN_NAME}`}
                    </Button>
                  ) : null}

                  <div className="mint-action-row">
                    <div className="mint-quantity-panel">
                      <span className="mint-quantity-label">Quantity</span>
                      <div className="mint-quantity">
                        <Button 
                          className="mint-quantity-btn"
                          variant="secondary"
                          size="icon"
                          onClick={decrementQuantity}
                          disabled={quantity <= 1 || isMinting}
                        >-</Button>
                        <input
                          className="mint-quantity-input"
                          type="number"
                          min={1}
                          max={Math.max(1, mintCap)}
                          value={quantityInput}
                          onChange={handleQuantityInputChange}
                          onBlur={() => applyQuantityBounds(quantityInput || quantity)}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          disabled={mintCap <= 0 || phaseWhitelistBlocked || isMinting}
                          aria-label="Mint quantity"
                        />
                        <Button 
                          className="mint-quantity-btn"
                          variant="secondary"
                          size="icon"
                          onClick={incrementQuantity}
                          disabled={quantity >= mintCap || mintCap <= 0 || phaseWhitelistBlocked || isMinting}
                        >+</Button>
                      </div>
                    </div>

                    <Button 
                      className="mint-submit-btn"
                      variant="primary"
                      size="md"
                      onClick={mint}
                      disabled={isMinting || isMintBlocked}
                    >
                      {isMinting ? 'Minting...' : mintBlockedReason || (Number(totalPriceLabel) > 0 ? `Mint ${totalPriceLabel} ETH` : 'Mint Free')}
                    </Button>
                  </div>
                </div>
              )}
              {statusMessage && (
                <StatusNotice
                  message={statusMessage}
                  tone={getStatusTone(statusMessage) || 'info'}
                />
              )}
              {lastTxHash && (
                <a
                  href={`${BLOCK_EXPLORER_URL}/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mint-tx-link"
                >
                  {'View Transaction ->'}
                </a>
              )}
            </div>

          </MintCardShell>

          {/* Right Column - Phase Display */}
          <MintDisplayShell className="mint-display">
            <div className="mint-phase-summary">
              <div className="mint-phase-summary-head">
                <div className="mint-phase-summary-title">
                  <div className="mint-phase-summary-top">
                    <span className="mint-phase-summary-label">{summaryHeading}</span>
                    <span className={`mint-phase-summary-status ${summaryStatusTone}`}>{summaryStatusLabel}</span>
                  </div>
                  <strong className="mint-phase-summary-name">{summaryPhaseDisplayName || (phaseCount === 0 ? 'Public Mint' : 'No active phase')}</strong>
                  <span className="mint-phase-summary-sub">Live mint conditions and wallet limits</span>
                </div>
                  <div className="mint-phase-summary-stats">
                    <div className="mint-phase-summary-stat">
                      <span className="mint-phase-summary-stat-label">Mint Price</span>
                      <strong className="mint-phase-summary-stat-value is-price">{summaryMintPriceLabel}</strong>
                    </div>
                    <div className="mint-phase-summary-stat">
                      <span className="mint-phase-summary-stat-label">Limit</span>
                      <strong className="mint-phase-summary-stat-value is-limit">{summaryLimitDisplay}</strong>
                    </div>
                    <div className="mint-phase-summary-stat">
                      <span className="mint-phase-summary-stat-label">Access</span>
                      <strong className={`mint-phase-summary-stat-value is-access ${summaryAccessTone}`}>{summaryAccessLabel}</strong>
                    </div>
                    <div className="mint-phase-summary-stat mint-phase-summary-stat-highlight">
                      <span className="mint-phase-summary-stat-label">{summaryTimerLabel}</span>
                      <strong className={`mint-phase-summary-stat-value is-timer ${summaryTimerTone}`}>{summaryTimerValue}</strong>
                    </div>
                  </div>
                </div>
              {phases.length > 0 && (
                <>
                  <div className="mint-phase-list-head">
                    <span>Phase Schedule</span>
                    <small>Tap a phase group to expand sub-phases</small>
                  </div>
                  <div className="mint-phase-list">
                    {groupedPhaseSchedule.map((group) => {
                      const isExpanded = !group.label || expandedPhaseGroups[group.key] === true
                      const isActiveGroup = group.items.some(({ phase }) => Number(phase?.id) === Number(activePhaseId))
                      const groupHeaderInfo = getPhaseGroupHeaderInfo(
                        group.items,
                        activePhaseId,
                        phaseNow,
                        account,
                        phaseEligibilityMap
                      )
                      return (
                      <div key={`mint-phase-group-${group.key}`} className={`mint-phase-group ${isActiveGroup ? 'active' : ''}`}>
                        {group.label ? (
                          <button
                            type="button"
                            className="mint-phase-group-head mint-phase-group-toggle"
                            onClick={() => setExpandedPhaseGroups((prev) => ({ ...prev, [group.key]: !(prev[group.key] !== false) }))}
                            aria-expanded={isExpanded}
                          >
                            <div className="mint-phase-group-main">
                              <span className="mint-phase-group-title">{group.label}</span>
                              <small>
                                {group.items.length} sub-phase{group.items.length === 1 ? '' : 's'} {isExpanded ? 'Hide' : 'Show'}
                              </small>
                            </div>
                            <div className="mint-phase-group-meta">
                              <>
                                <span className={`mint-phase-group-chip ${groupHeaderInfo.timerTone}`}>Timer: {groupHeaderInfo.timerText}</span>
                                <span className={`mint-phase-group-chip ${groupHeaderInfo.eligibilityTone}`}>
                                  Access: {groupHeaderInfo.eligibilityText}
                                </span>
                              </>
                            </div>
                          </button>
                        ) : null}
                        {isExpanded ? (
                        <div className="mint-phase-sub-list">
                          {group.items.map(({ phase, subLabel, fullLabel }) => {
                            const info = getPhaseCardStatus(phase, activePhaseId, phaseNow)
                            const phaseWalletCap = phase.maxPerWallet > 0 ? phase.maxPerWallet : maxPerWallet
                            const phaseWalletMinted = account ? Number(phaseWalletMintedMap[phase.id] || 0) : null
                            const phaseLimitDisplay = `${phaseWalletMinted !== null ? phaseWalletMinted : '--'}/${phaseWalletCap > 0 ? phaseWalletCap : 'Unlimited'}`
                            const phaseEligible = Boolean(phaseEligibilityMap[phase.id]?.eligible)
                            const phaseRequiresWhitelist = Boolean(phaseEligibilityMap[phase.id]?.requiresWhitelist)
                            const isWalletEligiblePhase = Boolean(account) && phaseRequiresWhitelist && phaseEligible
                            const isWalletIneligiblePhase = Boolean(account) && phaseRequiresWhitelist && !phaseEligible
                            return (
                              <div key={phase.id} className={`mint-phase-item ${phase.id === activePhaseId ? 'active' : ''} ${isWalletEligiblePhase ? 'eligible' : ''} ${isWalletIneligiblePhase ? 'ineligible' : ''} ${info.timerLabel === 'Ended' ? 'ended' : ''}`}>
                                <div className="mint-phase-top">
                                  <div className="mint-phase-title-wrap">
                                    <strong>{group.label ? subLabel : fullLabel}</strong>
                                    {isWalletEligiblePhase ? (
                                      <span className="mint-phase-wallet-indicator">Wallet Eligible</span>
                                    ) : isWalletIneligiblePhase ? (
                                      <span className="mint-phase-wallet-indicator ineligible">Wallet Ineligible</span>
                                    ) : null}
                                  </div>
                                  <span className={`mint-phase-status ${phase.id === activePhaseId ? 'active' : ''} ${isWalletEligiblePhase ? 'eligible' : ''} ${isWalletIneligiblePhase ? 'ineligible' : ''}`}>{info.label}</span>
                                </div>
                                <div className="mint-phase-meta-grid">
                                  <div className="mint-phase-meta-item">
                                    <span className="mint-phase-meta-label">Price</span>
                                    <span className="mint-phase-meta-value">{phase.priceEth} ETH</span>
                                  </div>
                                  <div className="mint-phase-meta-item">
                                    <span className="mint-phase-meta-label">Limit</span>
                                    <span className="mint-phase-meta-value">{phaseLimitDisplay}</span>
                                  </div>
                                </div>
                                {info.timerLabel === 'Ended' ? (
                                  <div className="mint-phase-timer-row">
                                    <span className="mint-phase-meta-label">Timeline</span>
                                    <span className="mint-phase-meta-value phase-ended">Ended</span>
                                  </div>
                                ) : info.countdown ? (
                                  <div className="mint-phase-timer-row">
                                    <span className="mint-phase-meta-label">{info.timerLabel}</span>
                                    <span className="mint-phase-meta-value phase-highlight-val">{info.countdown}</span>
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                        ) : null}
                      </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </MintDisplayShell>

        </div>
    </div>
    </>
  )
}

export default Mint

