import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateRandomPenguinTraits, renderPenguin4k } from './penguin2d.js'
import SiteNav from './SiteNav.jsx'
import { extractTweetMetaFromLink } from './taskConfig.js'
import './PlayToWL.css'

const GRID = 3
const TOTAL_TILES = GRID * GRID
const GRID_LABEL = `${GRID}x${GRID}`
const PUZZLE_TARGET_SCORE = 500
const IMAGE_SRC = '/favicon.png'
const EMPTY_TILE = TOTAL_TILES - 1
const SLIDE_MS = 190
const PUZZLE_SUBMISSION_KEY = 'puzzleGameSubmission'
const PUZZLE_QUALIFIED_MOVES_KEY = 'arcadeQualifiedMoves'
const PUZZLE_QUALIFIED_TIME_KEY = 'arcadeQualifiedTime'
const PUZZLE_LEADERBOARD_KEY = 'puzzleLeaderboard'
const PUZZLE_BROWSER_ID_KEY = 'puzzleBrowserId'
const PUZZLE_PLAYER_PROFILE_KEY = 'puzzlePlayerProfile'
const PUZZLE_SUBMISSIONS_SHEET = 'Puzzle Submissions'
const PUZZLE_PROFILES_SHEET = 'Puzzle Profiles'
const REQUIRED_TWEET_CAPTION = 'Just Solved The @8bitpenguin_xyz puzzle'
const REQUIRED_TWEET_CTA = 'Solve The Puzzle And Secure Whitelist: https://8bitpenguins.xyz/play-to-wl'
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwOWJFjbVVeQtN81LaLZsvc8gEqwD2CFIzsUBBLHZ4GU2S_OD-6JXE7-0ZEdHLoEFOu/exec'
const LEADERBOARD_SHEET = 'Leaderboard'
const GAME_ANALYTICS_SHEET = 'Game Analytics'
const PUZZLE_PROOF_WINDOW_MS = 24 * 60 * 60 * 1000
const LEADERBOARD_PAGE_SIZE = 100
const LEADERBOARD_FETCH_LIMIT = 1000
const TWITTER_USERNAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/
const GENERATE_RENDER_OPTIONS = {
  logicalSize: 40,
  offsetX: 0,
  offsetY: 0,
  spriteScale: 0.75,
  outline: true,
  innerOutline: true,
  outerOutline: false,
}

function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  )
}

async function buildPuzzleReferenceImage() {
  try {
    await document.fonts?.load?.('700 32px "Press Start 2P"')
  } catch {
    // Continue with fallback font if font API is unavailable.
  }

  const traits = generateRandomPenguinTraits()
  return renderPenguin4k(traits, GENERATE_RENDER_OPTIONS).toDataURL('image/png')
}

function isSolvable(arr) {
  let inversions = 0
  const values = arr.filter((value) => value !== EMPTY_TILE)
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (values[i] > values[j]) inversions += 1
    }
  }

  if (GRID % 2 === 1) return inversions % 2 === 0

  const emptyIndex = arr.indexOf(EMPTY_TILE)
  const emptyRowFromTop = Math.floor(emptyIndex / GRID) + 1
  const emptyRowFromBottom = GRID - emptyRowFromTop + 1
  if (emptyRowFromBottom % 2 === 0) return inversions % 2 === 1
  return inversions % 2 === 0
}

function shuffleTiles() {
  const arr = Array.from({ length: TOTAL_TILES }, (_, i) => i)
  let shuffled = [...arr]
  do {
    shuffled = [...arr]
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
  } while (!isSolvable(shuffled) || shuffled.every((v, idx) => v === idx))
  return shuffled
}

function computeScore(moves, timeSec, options = {}) {
  const includeBonuses = options.includeBonuses !== false
  const movePenalty =
    Math.min(moves, 30) * 3 +
    Math.min(Math.max(0, moves - 30), 30) * 5 +
    Math.max(0, moves - 60) * 7

  const timePenalty =
    Math.min(timeSec, 120) * 0.5 +
    Math.min(Math.max(0, timeSec - 120), 180) * 1 +
    Math.max(0, timeSec - 300) * 1.5

  const efficiencyBonus = includeBonuses && moves <= 30 ? 120 : 0
  const speedBonus = includeBonuses && timeSec <= 90 ? 100 : 0
  const stabilityBonus = includeBonuses && moves <= 60 ? 60 : 0

  return Math.max(200, Math.round(1000 - movePenalty - timePenalty + efficiencyBonus + speedBonus + stabilityBonus))
}

function formatElapsed(seconds) {
  const s = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(s / 60)
  const remainder = s % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function validateEvmAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function shortWallet(wallet) {
  if (!wallet || wallet.length < 10) return wallet || '-'
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
}

function normalizeWallet(v) {
  return String(v || '').trim().toLowerCase()
}

function normalizeX(v) {
  return String(v || '').trim().replace(/^@+/, '').toLowerCase()
}

function normalizeTweetLink(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    const url = new URL(raw)
    url.hostname = url.hostname.toLowerCase()

    const parts = url.pathname.split('/').filter(Boolean)
    const statusIndex = parts.findIndex((part) => part.toLowerCase() === 'status')
    if (statusIndex >= 1) {
      parts[statusIndex - 1] = String(parts[statusIndex - 1] || '').toLowerCase()
    }

    url.pathname = `/${parts.join('/')}`
    return url.toString()
  } catch {
    return raw
  }
}

function extractUsernameFromHtml(html) {
  const match = String(html || '').match(/https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/\d+/i)
  return match?.[1] || ''
}

function usernamesMatch(linkUsername, submittedUsername) {
  const normalizedLinkUsername = String(linkUsername || '').trim().replace(/^@+/, '').toLowerCase()
  const normalizedSubmittedUsername = String(submittedUsername || '').trim().replace(/^@+/, '').toLowerCase()
  if (!normalizedLinkUsername) return true
  return normalizedLinkUsername === normalizedSubmittedUsername
}

async function verifyLiveTweetLink(tweetLink) {
  const normalizedTweetLink = normalizeTweetLink(tweetLink)
  const endpoint = `https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(normalizedTweetLink)}`
  const response = await fetch(endpoint)
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload) {
    return {
      ok: false,
      error: String(payload?.error || `HTTP ${response.status}`),
      authorUsername: '',
    }
  }

  let authorUsername = ''
  try {
    if (typeof payload.author_url === 'string') {
      const authorUrl = new URL(payload.author_url)
      const candidate = authorUrl.pathname.split('/').filter(Boolean)[0] || ''
      if (TWITTER_USERNAME_PATTERN.test(candidate)) {
        authorUsername = candidate
      }
    }
  } catch {
    // Ignore malformed author URLs from the oEmbed payload.
  }

  if (!authorUsername && typeof payload.html === 'string') {
    authorUsername = extractUsernameFromHtml(payload.html)
  }

  return { ok: true, authorUsername }
}

function getBrowserId() {
  const existing = localStorage.getItem(PUZZLE_BROWSER_ID_KEY)
  if (existing) return existing
  const next = `b${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(PUZZLE_BROWSER_ID_KEY, next)
  return next
}

function createAnalyticsEventId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function loadLeaderboard() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PUZZLE_LEADERBOARD_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(compactLeaderboardRow) : []
  } catch {
    return []
  }
}

function compactLeaderboardRow(row) {
  return {
    browserId: String(row?.browserId || row?.browser_id || ''),
    xUsername: String(row?.xUsername || row?.x_username || row?.xHandle || ''),
    walletAddress: String(row?.walletAddress || row?.wallet_address || ''),
    score: Number(row?.score || 0),
    moves:
      Number.isFinite(Number(row?.moves)) && Number(row?.moves) > 0
        ? Number(row.moves)
        : null,
    timeSec:
      Number.isFinite(Number(row?.timeSec || row?.time_sec || row?.time)) &&
      Number(row?.timeSec || row?.time_sec || row?.time) > 0
        ? Number(row?.timeSec || row?.time_sec || row?.time)
        : null,
    updatedAt: Number(row?.updatedAt || row?.updated_at || row?.timestamp || Date.now()),
  }
}

function saveLeaderboard(entries) {
  const compact = Array.isArray(entries) ? entries.map(compactLeaderboardRow) : []
  try {
    localStorage.setItem(PUZZLE_LEADERBOARD_KEY, JSON.stringify(compact))
  } catch {
    try {
      localStorage.setItem(PUZZLE_LEADERBOARD_KEY, JSON.stringify(compact.slice(0, 25)))
    } catch {
      try {
        localStorage.setItem(PUZZLE_LEADERBOARD_KEY, JSON.stringify(compact.slice(0, 10)))
      } catch {
        // Keep the in-memory leaderboard if storage is full.
      }
    }
  }
}

function loadPlayerProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PUZZLE_PLAYER_PROFILE_KEY) || '{}')
    const xUsername = String(parsed?.xUsername || '').trim()
    const walletAddress = String(parsed?.walletAddress || '').trim()
    const tweetLink = normalizeTweetLink(parsed?.tweetLink || '')
    return {
      xUsername,
      walletAddress,
      tweetLink,
      ready: xUsername.length >= 2 && validateEvmAddress(walletAddress),
    }
  } catch {
    return { xUsername: '', walletAddress: '', tweetLink: '', ready: false }
  }
}

function loadPuzzleSubmission() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PUZZLE_SUBMISSION_KEY) || '{}')
    const walletAddress = String(parsed?.walletAddress || '').trim()
    const xUsername = String(parsed?.xUsername || '').trim()
    const tweetLink = normalizeTweetLink(parsed?.tweetLink || '')
    const duplicate = Boolean(parsed?.duplicate)
    const score = Number(parsed?.score || parsed?.currentScore || 0)
    const moves = Number(parsed?.moves || 0)
    const time = Number(parsed?.time || parsed?.timeSec || 0)
    const timestamp = Number(parsed?.timestamp || 0)

    return {
      exists: Boolean(walletAddress || xUsername || tweetLink || duplicate || score || timestamp),
      walletAddress,
      xUsername,
      tweetLink,
      duplicate,
      score,
      moves,
      time,
      timestamp,
    }
  } catch {
    return {
      exists: false,
      walletAddress: '',
      xUsername: '',
      tweetLink: '',
      duplicate: false,
      score: 0,
      moves: 0,
      time: 0,
      timestamp: 0,
    }
  }
}

function puzzleSubmissionMatchesProfile(submission, xUsername, walletAddress) {
  const storedWallet = normalizeWallet(submission?.walletAddress)
  const storedX = normalizeX(submission?.xUsername)
  const incomingWallet = normalizeWallet(walletAddress)
  const incomingX = normalizeX(xUsername)

  if (storedWallet && incomingWallet && storedWallet === incomingWallet) return true
  if (storedX && incomingX && storedX === incomingX) return true
  return false
}

function buildLocalPuzzleProofStatus(profile, submission) {
  const matches = puzzleSubmissionMatchesProfile(submission, profile?.xUsername, profile?.walletAddress)
  const tweetLink = matches ? normalizeTweetLink(submission?.tweetLink || '') : ''
  const timestamp = matches ? Number(submission?.timestamp || 0) : 0
  const submitted = Boolean(tweetLink)

  return {
    ok: false,
    source: 'local',
    submissionExists: matches && Boolean(submission?.exists),
    submitted,
    proofState: submitted ? 'submitted' : 'unknown',
    tweetLink,
    tweetId: extractTweetMetaFromLink(tweetLink).tweetId,
    xUsername: matches ? String(submission?.xUsername || profile?.xUsername || '') : String(profile?.xUsername || ''),
    walletAddress: matches ? String(submission?.walletAddress || profile?.walletAddress || '') : String(profile?.walletAddress || ''),
    currentScore: matches ? Number(submission?.score || 0) : 0,
    moves: matches ? Number(submission?.moves || 0) : 0,
    time: matches ? Number(submission?.time || 0) : 0,
    qualifiedAt: timestamp,
    submittedAt: timestamp,
    proofDeadlineTs: timestamp > 0 ? timestamp + PUZZLE_PROOF_WINDOW_MS : 0,
    msRemaining: 0,
    expired: false,
  }
}

function pruneLegacyPuzzleStorage() {
  try {
    const raw = localStorage.getItem(PUZZLE_SUBMISSION_KEY)
    if (!raw) return
    if (raw.length < 8000) return
    const parsed = JSON.parse(raw)
    localStorage.setItem(
      PUZZLE_SUBMISSION_KEY,
      JSON.stringify({
        walletAddress: String(parsed?.walletAddress || ''),
        xUsername: String(parsed?.xUsername || ''),
        tweetLink: normalizeTweetLink(parsed?.tweetLink || ''),
        score: Number(parsed?.score || parsed?.currentScore || 0),
        moves: Number(parsed?.moves || 0),
        time: Number(parsed?.time || parsed?.timeSec || 0),
        timestamp: Number(parsed?.timestamp || Date.now()),
      })
    )
  } catch {
    // Ignore corrupt or missing legacy submission payloads.
  }
}

function compareLeaderboardRows(a, b) {
  const scoreDiff = Number(b.score || 0) - Number(a.score || 0)
  if (scoreDiff !== 0) return scoreDiff
  const aMoves = Number.isFinite(Number(a.moves)) && Number(a.moves) > 0 ? Number(a.moves) : Number.MAX_SAFE_INTEGER
  const bMoves = Number.isFinite(Number(b.moves)) && Number(b.moves) > 0 ? Number(b.moves) : Number.MAX_SAFE_INTEGER
  const moveDiff = aMoves - bMoves
  if (moveDiff !== 0) return moveDiff
  return Number(a.updatedAt || 0) - Number(b.updatedAt || 0)
}

function upsertLeaderboardEntry(entry) {
  const rows = loadLeaderboard()
  const idx = rows.findIndex(
    (row) =>
      row.browserId === entry.browserId ||
      (row.walletAddress && entry.walletAddress && row.walletAddress.toLowerCase() === entry.walletAddress.toLowerCase()) ||
      (row.xUsername && entry.xUsername && row.xUsername.toLowerCase() === entry.xUsername.toLowerCase())
  )

  if (idx >= 0) {
    const existingScore = Number(rows[idx].score || 0)
    const existingMoves = Number.isFinite(Number(rows[idx].moves)) ? Number(rows[idx].moves) : Number.MAX_SAFE_INTEGER
    const incomingMoves = Number.isFinite(Number(entry.moves)) ? Number(entry.moves) : Number.MAX_SAFE_INTEGER
    const shouldUpdate =
      entry.score > existingScore ||
      (entry.score === existingScore && incomingMoves < existingMoves)

    if (shouldUpdate) {
      rows[idx] = { ...rows[idx], ...entry, updatedAt: Date.now() }
    } else {
      rows[idx] = { ...rows[idx], xUsername: entry.xUsername || rows[idx].xUsername, walletAddress: entry.walletAddress || rows[idx].walletAddress, updatedAt: Date.now() }
    }
  } else {
    rows.push({ ...entry, updatedAt: Date.now() })
  }

  rows.sort(compareLeaderboardRows)
  const trimmed = rows.slice(0, 100)
  saveLeaderboard(trimmed)
  return trimmed
}

async function fetchGoogleLeaderboard() {
  const query = new URLSearchParams({
    action: 'leaderboard',
    sheetName: LEADERBOARD_SHEET,
    limit: String(LEADERBOARD_FETCH_LIMIT),
  })

  const res = await fetch(`${GOOGLE_SCRIPT_URL}?${query.toString()}`)
  const data = await res.json()
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : []

  return rows
    .map((row) => ({
      browserId: row.browserId || row.browser_id || '',
      xUsername: row.xUsername || row.x_username || row.xHandle || '',
      walletAddress: row.walletAddress || row.wallet_address || '',
      score: Number(row.score || 0),
      moves: Number.isFinite(Number(row.moves)) && Number(row.moves) > 0 ? Number(row.moves) : null,
      timeSec:
        Number.isFinite(Number(row.timeSec || row.time_sec || row.time)) && Number(row.timeSec || row.time_sec || row.time) > 0
          ? Number(row.timeSec || row.time_sec || row.time)
          : null,
      updatedAt: Number(row.updatedAt || row.updated_at || row.timestamp || Date.now()),
    }))
    .filter((row) => row.score > 0)
    .sort(compareLeaderboardRows)
    .slice(0, LEADERBOARD_FETCH_LIMIT)
}

async function syncLeaderboardEntry(entry) {
  const payload = {
    action: 'upsert_leaderboard',
    sheetName: LEADERBOARD_SHEET,
    eventType: 'leaderboard_entry',
    browserId: entry.browserId,
    xUsername: entry.xUsername,
    walletAddress: entry.walletAddress,
    score: Number(entry.score || 0),
    moves: Number(entry.moves || 0),
    timeSec: Number(entry.timeSec || 0),
    time: Number(entry.timeSec || 0),
    timestamp: Date.now(),
  }

  await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })
}

async function sendGameAnalyticsEvent(event) {
  const payload = {
    action: 'game_analytics_event',
    sheetName: GAME_ANALYTICS_SHEET,
    eventType: String(event?.eventType || ''),
    browserId: String(event?.browserId || ''),
    clientSessionId: String(event?.clientSessionId || ''),
    runId: String(event?.runId || ''),
    xUsername: String(event?.xUsername || ''),
    walletAddress: String(event?.walletAddress || ''),
    attemptNumber: Number(event?.attemptNumber || 0),
    score: Number(event?.score || 0),
    bestScore: Number(event?.bestScore || 0),
    moves: Number(event?.moves || 0),
    timeSec: Number(event?.timeSec || event?.time || 0),
    qualified: Boolean(event?.qualified),
    outcome: String(event?.outcome || ''),
    isReturningProfile: Boolean(event?.isReturningProfile),
    timestamp: Number(event?.timestamp || Date.now()),
  }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Analytics must never block gameplay.
  }
}

async function fetchPuzzleProofStatus({ xUsername = '', walletAddress = '' }) {
  const query = new URLSearchParams({
    action: 'puzzle_proof_status',
    puzzleSheetName: PUZZLE_SUBMISSIONS_SHEET,
    analyticsSheetName: GAME_ANALYTICS_SHEET,
    xUsername: String(xUsername || '').trim(),
    walletAddress: String(walletAddress || '').trim(),
  })

  const response = await fetch(`${GOOGLE_SCRIPT_URL}?${query.toString()}`)
  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.ok === false || !payload || typeof payload.proofState !== 'string') {
    return {
      ok: false,
      error: String(payload?.error || payload?.errorCode || 'proof_status_lookup_failed'),
    }
  }

  return {
    ok: true,
    source: 'remote',
    submissionExists: Boolean(payload.submissionExists),
    submitted: Boolean(payload.submitted),
    proofState: String(payload.proofState || 'unknown'),
    tweetLink: normalizeTweetLink(payload.tweetLink || ''),
    tweetId: String(payload.tweetId || ''),
    xUsername: String(payload.xUsername || ''),
    walletAddress: String(payload.walletAddress || ''),
    currentScore: Number(payload.currentScore || 0),
    moves: Number(payload.moves || 0),
    time: Number(payload.time || 0),
    qualifiedAt: Number(payload.qualifiedAt || 0),
    submittedAt: Number(payload.submittedAt || payload.timestamp || 0),
    proofDeadlineTs: Number(payload.proofDeadlineTs || 0),
    msRemaining: Number(payload.msRemaining || 0),
    expired: Boolean(payload.expired),
  }
}

async function submitPuzzleProfileRecord({ xUsername, walletAddress, tweetLink, tweetId, verifiedTweetUsername }) {
  const payload = {
    sheetName: PUZZLE_PROFILES_SHEET,
    eventType: 'puzzle_profile',
    xUsername,
    walletAddress,
    tweetLink,
    tweetId,
    verifiedTweetUsername,
    timestamp: Date.now(),
  }

  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })
  const responseData = await response.json().catch(() => null)

  if (!response.ok || responseData?.ok === false) {
    throw new Error(String(responseData?.error || 'Failed to save profile tweet'))
  }

  return responseData
}

function verifyIdentityAgainstRows(rows, xUsername, walletAddress) {
  const nx = normalizeX(xUsername)
  const nw = normalizeWallet(walletAddress)
  const walletMatch = rows.find((row) => normalizeWallet(row.walletAddress) === nw)
  const xMatch = rows.find((row) => normalizeX(row.xUsername) === nx)
  const exactPair = rows.find(
    (row) => normalizeWallet(row.walletAddress) === nw && normalizeX(row.xUsername) === nx
  )

  const hasConflict =
    (walletMatch && normalizeX(walletMatch.xUsername) !== nx) ||
    (xMatch && normalizeWallet(xMatch.walletAddress) !== nw)

  return {
    hasConflict: Boolean(hasConflict),
    exactPair: Boolean(exactPair),
    bestScore: Number(exactPair?.score || 0),
  }
}

function PlayToWL() {
  const initialProfile = loadPlayerProfile()
  const initialSubmission = loadPuzzleSubmission()
  const initialProofStatus = buildLocalPuzzleProofStatus(initialProfile, initialSubmission)
  const [browserId] = useState(() => getBrowserId())
  const [tiles, setTiles] = useState(() => shuffleTiles())
  const [slideMove, setSlideMove] = useState(null)
  const slideLockRef = useRef(false)
  const slideTimeoutRef = useRef(null)
  const instantMoveRef = useRef(isTouchDevice())
  const solvedRunHandledRef = useRef(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [moves, setMoves] = useState(0)
  const [timeSec, setTimeSec] = useState(0)
  const [gameState, setGameState] = useState('playing')
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('arcadeBestScore') || 0))
  const [qualified, setQualified] = useState(() => localStorage.getItem('arcadeQualified') === 'true')
  const [referenceImage, setReferenceImage] = useState(IMAGE_SRC)
  const [qualifiedImage, setQualifiedImage] = useState('')
  const [xUsername, setXUsername] = useState(() => initialProfile.xUsername)
  const [walletAddress, setWalletAddress] = useState(() => initialProfile.walletAddress)
  const [profileTweetLink, setProfileTweetLink] = useState(() => initialProfile.tweetLink || '')
  const [hasProfile, setHasProfile] = useState(() => initialProfile.ready)
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [submissionRecord, setSubmissionRecord] = useState(() => initialSubmission)
  const [proofStatus, setProofStatus] = useState(() => initialProofStatus)
  const [isLoadingProofStatus, setIsLoadingProofStatus] = useState(false)
  const [victoryTweetLinkInput, setVictoryTweetLinkInput] = useState(() => initialSubmission.tweetLink)
  const [victoryTweetError, setVictoryTweetError] = useState('')
  const [modal, setModal] = useState({ open: false, title: '', message: '', tone: 'info', actionLabel: '' })
  const [modalAction, setModalAction] = useState(null)
  const [qualifiedScore, setQualifiedScore] = useState(() => Number(localStorage.getItem('arcadeQualifiedScore') || 0))
  const [qualifiedMoves, setQualifiedMoves] = useState(() => Number(localStorage.getItem(PUZZLE_QUALIFIED_MOVES_KEY) || 0))
  const [qualifiedTime, setQualifiedTime] = useState(() => Number(localStorage.getItem(PUZZLE_QUALIFIED_TIME_KEY) || 0))
  const [leaderboard, setLeaderboard] = useState(() => loadLeaderboard())
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false)
  const [lastLeaderboardSync, setLastLeaderboardSync] = useState(null)
  const [activeTab, setActiveTab] = useState('game')
  const [leaderboardSearch, setLeaderboardSearch] = useState('')
  const [leaderboardPage, setLeaderboardPage] = useState(1)
  const [verifiedBestScore, setVerifiedBestScore] = useState(0)
  const [winConfetti, setWinConfetti] = useState([])
  const clientSessionIdRef = useRef(createAnalyticsEventId('session'))
  const attemptCounterRef = useRef(0)
  const activeRunRef = useRef({ runId: '', attemptNumber: 0, finished: false })

  const solved = useMemo(() => tiles.every((v, idx) => v === idx), [tiles])
  const score = useMemo(() => computeScore(moves, timeSec, { includeBonuses: false }), [moves, timeSec])
  const projectedFinalScore = useMemo(() => computeScore(moves, timeSec, { includeBonuses: true }), [moves, timeSec])
  const scoreBreakdown = useMemo(() => {
    const normalizedMoves = Math.max(0, Number(moves) || 0)
    const normalizedTime = Math.max(0, Number(timeSec) || 0)
    const movePenalty =
      Math.min(normalizedMoves, 30) * 3 +
      Math.min(Math.max(0, normalizedMoves - 30), 30) * 5 +
      Math.max(0, normalizedMoves - 60) * 7
    const timePenalty =
      Math.min(normalizedTime, 120) * 0.5 +
      Math.min(Math.max(0, normalizedTime - 120), 180) * 1 +
      Math.max(0, normalizedTime - 300) * 1.5
    const efficiencyBonus = normalizedMoves <= 30 ? 120 : 0
    const speedBonus = normalizedTime <= 90 ? 100 : 0
    const stabilityBonus = normalizedMoves <= 60 ? 60 : 0
    return {
      movePenalty: Math.round(movePenalty),
      timePenalty: Math.round(timePenalty),
      potentialBonus: efficiencyBonus + speedBonus + stabilityBonus,
      efficiencyBonus,
      speedBonus,
      stabilityBonus,
    }
  }, [moves, timeSec])

  const triggerWinConfetti = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C00', '#39FF14', '#FF1493']
    const pieces = Array.from({ length: 88 }, (_, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      left: 2 + Math.random() * 96,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.45,
      size: 6 + Math.random() * 9,
      driftX: -140 + Math.random() * 280,
      rotateStart: -140 + Math.random() * 280,
      rotateEnd: 420 + Math.random() * 520,
      duration: 1.8 + Math.random() * 1.2,
    }))
    setWinConfetti(pieces)
    window.setTimeout(() => setWinConfetti([]), 2600)
  }

  const trackGameEvent = useCallback((eventType, details = {}) => {
    sendGameAnalyticsEvent({
      eventType,
      browserId,
      clientSessionId: clientSessionIdRef.current,
      xUsername,
      walletAddress,
      ...details,
    })
  }, [browserId, walletAddress, xUsername])

  const beginTrackedRun = useCallback(() => {
    if (activeRunRef.current.runId && !activeRunRef.current.finished) {
      return activeRunRef.current
    }

    attemptCounterRef.current += 1
    const nextRun = {
      runId: createAnalyticsEventId('run'),
      attemptNumber: attemptCounterRef.current,
      finished: false,
    }
    activeRunRef.current = nextRun
    trackGameEvent('run_started', nextRun)
    return nextRun
  }, [trackGameEvent])

  const finishTrackedRun = useCallback((details = {}) => {
    const currentRun = activeRunRef.current
    if (!currentRun.runId || currentRun.finished) return
    activeRunRef.current = { ...currentRun, finished: true }
    trackGameEvent('run_completed', {
      runId: currentRun.runId,
      attemptNumber: currentRun.attemptNumber,
      ...details,
    })
  }, [trackGameEvent])

  const scoreAlertLevel = useMemo(() => {
    const activeAttempt = hasStarted && gameState === 'playing'
    if (!activeAttempt) return 'none'
    if (score < 350) return 'red'
    if (score <= 550) return 'amber'
    return 'none'
  }, [hasStarted, gameState, score])
  const userRank = useMemo(() => {
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) return null
    const nx = normalizeX(xUsername)
    const nw = normalizeWallet(walletAddress)
    const idx = leaderboard.findIndex((row) => {
      const sameWallet = nw && normalizeWallet(row.walletAddress) === nw
      const sameX = nx && normalizeX(row.xUsername) === nx
      const sameBrowser = browserId && row.browserId === browserId
      return sameWallet || sameX || sameBrowser
    })
    return idx >= 0 ? idx + 1 : null
  }, [leaderboard, xUsername, walletAddress, browserId])
  const filteredLeaderboard = useMemo(() => {
    const query = normalizeX(leaderboardSearch)
    if (!query) return leaderboard
    return leaderboard.filter((row) => normalizeX(row.xUsername).includes(query))
  }, [leaderboard, leaderboardSearch])
  const bestReferenceScore = useMemo(
    () => Math.max(Number(bestScore || 0), Number(verifiedBestScore || 0)),
    [bestScore, verifiedBestScore]
  )
  const proofState = String(proofStatus?.proofState || 'unknown')
  const proofExpired = Boolean(proofStatus?.expired) || proofState === 'expired'
  const alreadySubmittedProof = proofState === 'submitted'
  const savedVictoryTweetLink = useMemo(() => {
    if (!alreadySubmittedProof) return ''
    return normalizeTweetLink(proofStatus?.tweetLink || submissionRecord?.tweetLink || '')
  }, [alreadySubmittedProof, proofStatus?.tweetLink, submissionRecord?.tweetLink])
  const needsVictoryTweet = hasProfile && bestReferenceScore >= PUZZLE_TARGET_SCORE && !savedVictoryTweetLink
  const projectedDeltaToBest = projectedFinalScore - bestReferenceScore
  const boardStatus = useMemo(() => {
    if (proofExpired) {
      return { label: 'Proof Expired', tone: 'warn' }
    }
    if (needsVictoryTweet) {
      return { label: 'Proof Required', tone: 'warn' }
    }
    if (gameState === 'won') {
      return qualified ? { label: 'Qualified', tone: 'ok' } : { label: 'Solved', tone: 'warn' }
    }
    if (gameState === 'lost') {
      return { label: 'Failed', tone: 'warn' }
    }
    if (bestReferenceScore >= PUZZLE_TARGET_SCORE) {
      return { label: 'Qualified', tone: 'ok' }
    }
    if (!hasStarted) {
      return { label: 'Ready', tone: '' }
    }
    if (projectedFinalScore < PUZZLE_TARGET_SCORE) {
      return { label: 'Below Target', tone: 'warn' }
    }
    if (projectedFinalScore <= PUZZLE_TARGET_SCORE + 60) {
      return { label: 'Risk Zone', tone: 'warn' }
    }
    return { label: 'On Pace', tone: '' }
  }, [bestReferenceScore, gameState, hasStarted, needsVictoryTweet, projectedFinalScore, proofExpired, qualified])
  const rivalSnapshot = useMemo(() => {
    if (!Array.isArray(leaderboard) || leaderboard.length === 0 || !userRank) return { above: null, below: null }
    return {
      above: userRank > 1 ? leaderboard[userRank - 2] : null,
      below: leaderboard[userRank] || null,
    }
  }, [leaderboard, userRank])
  const rivalDelta = useMemo(() => {
    if (!rivalSnapshot.above) return null
    return Number(rivalSnapshot.above.score || 0) - projectedFinalScore
  }, [rivalSnapshot, projectedFinalScore])
  const totalLeaderboardPages = Math.max(1, Math.ceil(filteredLeaderboard.length / LEADERBOARD_PAGE_SIZE))
  const paginatedLeaderboard = useMemo(() => {
    const start = (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE
    return filteredLeaderboard.slice(start, start + LEADERBOARD_PAGE_SIZE)
  }, [filteredLeaderboard, leaderboardPage])

  useEffect(() => {
    pruneLegacyPuzzleStorage()
  }, [])

  useEffect(() => {
    setLeaderboardPage(1)
  }, [leaderboardSearch])

  useEffect(() => {
    if (leaderboardPage > totalLeaderboardPages) {
      setLeaderboardPage(totalLeaderboardPages)
    }
  }, [leaderboardPage, totalLeaderboardPages])

  useEffect(() => {
    if (needsVictoryTweet && activeTab !== 'game') {
      setActiveTab('game')
    }
  }, [activeTab, needsVictoryTweet])

  const openModal = (title, message, tone = 'info', action = null) => {
    setModal({
      open: true,
      title,
      message,
      tone,
      actionLabel: action?.label || '',
    })
    setModalAction(() => (action?.onClick || null))
  }

  const closeModal = () => {
    setModal({ open: false, title: '', message: '', tone: 'info', actionLabel: '' })
    setModalAction(null)
  }

  const persistPuzzleSubmission = useCallback((updates = {}) => {
    setSubmissionRecord((prev) => {
      const next = {
        ...prev,
        ...updates,
        walletAddress: String(updates.walletAddress ?? prev.walletAddress ?? '').trim(),
        xUsername: String(updates.xUsername ?? prev.xUsername ?? '').trim(),
        tweetLink: normalizeTweetLink(updates.tweetLink ?? prev.tweetLink ?? ''),
        duplicate: Boolean(updates.duplicate ?? prev.duplicate),
        score: Number(updates.score ?? prev.score ?? 0),
        moves: Number(updates.moves ?? prev.moves ?? 0),
        time: Number(updates.time ?? prev.time ?? 0),
        timestamp: Number(updates.timestamp ?? prev.timestamp ?? Date.now()),
      }
      next.exists = Boolean(next.walletAddress || next.xUsername || next.tweetLink || next.duplicate || next.score || next.timestamp)
      try {
        localStorage.setItem(PUZZLE_SUBMISSION_KEY, JSON.stringify(next))
      } catch {
        // Ignore local storage write failures and keep runtime state.
      }
      return next
    })
  }, [])

  const syncProofStatus = useCallback(async () => {
    if (!hasProfile || !xUsername || !validateEvmAddress(walletAddress)) {
      const fallback = buildLocalPuzzleProofStatus({ xUsername, walletAddress }, loadPuzzleSubmission())
      setProofStatus(fallback)
      return fallback
    }

    setIsLoadingProofStatus(true)
    try {
      const remoteStatus = await fetchPuzzleProofStatus({ xUsername, walletAddress })
      if (remoteStatus.ok) {
        setProofStatus(remoteStatus)
        if (remoteStatus.submissionExists || remoteStatus.submitted) {
          const nextSubmission = {
            exists: true,
            walletAddress: remoteStatus.walletAddress || walletAddress,
            xUsername: remoteStatus.xUsername || xUsername,
            tweetLink: remoteStatus.tweetLink || '',
            duplicate: false,
            score: Number(remoteStatus.currentScore || 0),
            moves: Number(remoteStatus.moves || 0),
            time: Number(remoteStatus.time || 0),
            timestamp: Number(remoteStatus.submittedAt || remoteStatus.qualifiedAt || Date.now()),
          }
          setSubmissionRecord(nextSubmission)
          try {
            localStorage.setItem(PUZZLE_SUBMISSION_KEY, JSON.stringify(nextSubmission))
          } catch {
            // Ignore local storage write failures and keep runtime state.
          }
        }
        return remoteStatus
      }

      const fallback = buildLocalPuzzleProofStatus({ xUsername, walletAddress }, loadPuzzleSubmission())
      setProofStatus(fallback)
      return fallback
    } finally {
      setIsLoadingProofStatus(false)
    }
  }, [hasProfile, walletAddress, xUsername])

  const refreshLeaderboard = useCallback(async (silent = false) => {
    setIsLeaderboardLoading(true)
    try {
      const rows = await fetchGoogleLeaderboard()
      setLeaderboard(rows)
      saveLeaderboard(rows)
      setLastLeaderboardSync(Date.now())
    } catch {
      if (!silent) {
        openModal('Leaderboard Unavailable', 'Could not refresh global ranks right now.', 'error')
      }
    } finally {
      setIsLeaderboardLoading(false)
    }
  }, [])

  const syncRunToLeaderboard = async (finalScore, finalMoves, finalTimeSec) => {
    const entry = {
      browserId,
      xUsername: xUsername || `Anon-${browserId.slice(-4)}`,
      walletAddress: walletAddress || '',
      score: Number(finalScore || 0),
      moves: Number(finalMoves || 0),
      timeSec: Number(finalTimeSec || 0),
    }

    setLeaderboard(() => upsertLeaderboardEntry(entry))
    try {
      await syncLeaderboardEntry(entry)
      const remoteRows = await fetchGoogleLeaderboard()
      if (remoteRows.length > 0) {
        setLeaderboard(remoteRows)
        saveLeaderboard(remoteRows)
        setLastLeaderboardSync(Date.now())
      }
    } catch {
      // Keep local leaderboard if remote sync fails.
    }
  }

  useEffect(() => {
    if (gameState !== 'playing') return undefined
    if (!hasStarted) return undefined
    const id = setInterval(() => setTimeSec((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [gameState, hasStarted])

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!hasStarted) return
    if (gameState !== 'playing') return
    if (score >= PUZZLE_TARGET_SCORE) return
    finishTrackedRun({
      outcome: 'score_drop',
      score,
      bestScore,
      moves,
      timeSec,
      qualified: false,
    })
    setSlideMove(null)
    setGameState('lost')
    openModal('Score Dropped', `Score is below ${PUZZLE_TARGET_SCORE}. Click Try Again to restart.`, 'error', {
      label: 'Try Again',
      onClick: resetGame,
    })
  }, [bestScore, finishTrackedRun, gameState, hasStarted, moves, score, timeSec])

  useEffect(() => {
    if (!solved || gameState === 'won' || gameState === 'lost') return
    if (solvedRunHandledRef.current) return
    solvedRunHandledRef.current = true
    const finalScore = computeScore(moves, timeSec, { includeBonuses: true })
    const nextBest = Math.max(bestScore, finalScore)
    const solvedImage = referenceImage || IMAGE_SRC
    const runQualified = finalScore >= PUZZLE_TARGET_SCORE

    setGameState('won')
    setBestScore(nextBest)
    localStorage.setItem('arcadeBestScore', String(nextBest))
    finishTrackedRun({
      outcome: runQualified ? 'qualified' : 'completed_unqualified',
      score: finalScore,
      bestScore: nextBest,
      moves,
      timeSec,
      qualified: runQualified,
    })
    if (runQualified) {
      const previousHigh = Math.max(Number(bestScore || 0), Number(verifiedBestScore || 0))
      const hasPreviousHigh = previousHigh > 0
      const beatBest = finalScore > previousHigh
      localStorage.setItem('arcadeQualified', 'true')
      localStorage.setItem('arcadeQualifiedScore', String(finalScore))
      localStorage.setItem(PUZZLE_QUALIFIED_MOVES_KEY, String(moves))
      localStorage.setItem(PUZZLE_QUALIFIED_TIME_KEY, String(timeSec))
      setQualified(true)
      setQualifiedScore(finalScore)
      setQualifiedMoves(moves)
      setQualifiedTime(timeSec)
      setQualifiedImage(solvedImage)
      window.setTimeout(() => {
        if (savedVictoryTweetLink && !alreadySubmittedProof) {
          submitQualifiedProof(finalScore, moves, timeSec, savedVictoryTweetLink)
        }
        openModal(
          'Qualified',
          !hasPreviousHigh
            ? `Final score ${finalScore}. Qualified for whitelist. Post your victory now${savedVictoryTweetLink ? '.' : ' and paste the tweet link below.'}`
            : beatBest
              ? `Final score ${finalScore}. New personal best (previous ${previousHigh}). Post your victory now${savedVictoryTweetLink ? '.' : ' and paste the tweet link below.'}`
              : `Final score ${finalScore}. Qualified for whitelist, but your best score remains ${previousHigh}. Post your victory now${savedVictoryTweetLink ? '.' : ' and paste the tweet link below.'}`,
          'success',
          {
            label: 'Tweet Victory',
            onClick: () => handleComposeTweet({ score: finalScore, moves, timeSec }),
          }
        )
      }, 0)
    } else {
      window.setTimeout(() => {
        if (finalScore >= 350) {
          openModal('Near Miss', `Final score ${finalScore}. You are close, try again.`, 'info', {
            label: 'Try Again',
            onClick: resetGame,
          })
        } else {
          openModal('Try Again', `Final score ${finalScore}. Keep going, you can improve this run.`, 'error', {
            label: 'Try Again',
            onClick: resetGame,
          })
        }
      }, 0)
    }
  }, [alreadySubmittedProof, bestScore, browserId, finishTrackedRun, gameState, moves, referenceImage, savedVictoryTweetLink, solved, timeSec, verifiedBestScore])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (gameState === 'won') {
      triggerWinConfetti()
    } else {
      setWinConfetti([])
    }
  }, [gameState])

  useEffect(() => {
    if (bestReferenceScore < PUZZLE_TARGET_SCORE) return
    if (!qualified) {
      setQualified(true)
      localStorage.setItem('arcadeQualified', 'true')
    }
    if (qualifiedScore < PUZZLE_TARGET_SCORE) {
      setQualifiedScore(bestReferenceScore)
      localStorage.setItem('arcadeQualifiedScore', String(bestReferenceScore))
    }
  }, [bestReferenceScore, qualified, qualifiedScore])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const nextStatus = await syncProofStatus()
      if (cancelled || !nextStatus) return
    }

    run()
    return () => {
      cancelled = true
    }
  }, [syncProofStatus])

  useEffect(() => {
    if (savedVictoryTweetLink) {
      setVictoryTweetLinkInput(savedVictoryTweetLink)
      setVictoryTweetError('')
      return
    }
    if (hasProfile && !alreadySubmittedProof) {
      setVictoryTweetLinkInput('')
      setVictoryTweetError('')
    }
  }, [alreadySubmittedProof, hasProfile, savedVictoryTweetLink])

  useEffect(() => {
    let cancelled = false
    const buildReference = async () => {
      const dataUrl = await buildPuzzleReferenceImage()
      if (cancelled) return
      setReferenceImage(dataUrl)
    }
    buildReference()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setTiles((prev) => {
      if (prev.length !== TOTAL_TILES) return shuffleTiles()
      const seen = new Set(prev)
      if (seen.size !== TOTAL_TILES) return shuffleTiles()
      if (prev.some((value) => value < 0 || value >= TOTAL_TILES)) return shuffleTiles()
      return prev
    })
  }, [])

  useEffect(() => {
    refreshLeaderboard(true)
    const id = setInterval(() => {
      refreshLeaderboard(true)
    }, 20000)
    return () => clearInterval(id)
  }, [refreshLeaderboard])

  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current) {
        window.clearTimeout(slideTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!hasProfile) return
    if (!xUsername || !validateEvmAddress(walletAddress)) return
    let cancelled = false

    const syncReturningUserBest = async () => {
      let rows = leaderboard
      try {
        const remoteRows = await fetchGoogleLeaderboard()
        if (remoteRows.length > 0) {
          rows = remoteRows
        }
      } catch {
        // Fall back to cached leaderboard rows.
      }

      if (cancelled) return
      const identity = verifyIdentityAgainstRows(rows, xUsername, walletAddress)
      if (!identity.hasConflict && identity.exactPair) {
        setVerifiedBestScore(identity.bestScore)
        setBestScore(identity.bestScore)
        localStorage.setItem('arcadeBestScore', String(identity.bestScore))
      }
    }

    syncReturningUserBest()
    return () => {
      cancelled = true
    }
  }, [hasProfile, xUsername, walletAddress, leaderboard])

  const resetGame = () => {
    if (slideTimeoutRef.current) {
      window.clearTimeout(slideTimeoutRef.current)
      slideTimeoutRef.current = null
    }
    slideLockRef.current = false
    if (slideMove) return
    setTiles(shuffleTiles())
    setHasStarted(false)
    setMoves(0)
    setTimeSec(0)
    setGameState('playing')
    setWinConfetti([])
    solvedRunHandledRef.current = false
  }

  const handlePlayAgain = async () => {
    if (needsVictoryTweet) {
      openModal('Proof Required', 'Submit your victory tweet link before starting another run.', 'error')
      return
    }
    if (slideMove) return
    const nextReferenceImage = await buildPuzzleReferenceImage()
    setReferenceImage(nextReferenceImage)
    resetGame()
  }

  const failRun = (reason) => {
    if (slideTimeoutRef.current) {
      window.clearTimeout(slideTimeoutRef.current)
      slideTimeoutRef.current = null
    }
    slideLockRef.current = false
    setSlideMove(null)
    setGameState('playing')
    setTiles(shuffleTiles())
    setHasStarted(false)
    setMoves(0)
    setTimeSec(0)
    finishTrackedRun({
      outcome: 'run_reset',
      score,
      bestScore,
      moves,
      timeSec,
      qualified: false,
    })
    openModal('Run Reset', `${reason}. Start a new run now.`, 'info')
    solvedRunHandledRef.current = false
  }

  const handleShuffle = () => {
    if (needsVictoryTweet) {
      openModal('Proof Required', 'Submit your victory tweet link before starting another run.', 'error')
      return
    }
    if (gameState === 'playing' && (moves > 0 || timeSec > 0)) {
      failRun('Run not completed')
      return
    }
    resetGame()
  }

  const handleComposeTweet = async (details = {}) => {
    const scoreToShare = Number(details.score ?? qualifiedScore ?? bestScore ?? score ?? 0)
    const movesToShare = Number(details.moves ?? qualifiedMoves ?? moves ?? 0)
    const timeToShare = Number(details.timeSec ?? qualifiedTime ?? timeSec ?? 0)
    const tweetBody =
      `${REQUIRED_TWEET_CAPTION}\n` +
      `Score: ${scoreToShare}\n` +
      `Time: ${formatElapsed(timeToShare)}\n` +
      `Moves: ${movesToShare}\n\n` +
      `${REQUIRED_TWEET_CTA}`
    const imageSrc = qualifiedImage || referenceImage
    if (imageSrc) {
      handleSaveQualifiedImage()
    }
    const composed = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetBody)}`
    if (imageSrc && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      try {
        const res = await fetch(imageSrc)
        const blob = await res.blob()
        const pngBlob = blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' })
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
        window.open(composed, '_blank')
        return
      } catch {
        // Continue with text-only compose fallback.
      }
    }

    window.open(composed, '_blank')
    openModal('Tweet Ready', 'Tweet text opened and image downloaded. Attach image if it did not auto-paste.', 'info')
  }

  const handleVictoryTweetSubmit = async (event) => {
    event.preventDefault()
    if (isSubmittingProof) return

    const normalizedTweetLink = normalizeTweetLink(victoryTweetLinkInput)
    const { tweetId, username: linkUsername } = extractTweetMetaFromLink(normalizedTweetLink)
    if (!tweetId) {
      setVictoryTweetError('Enter a valid X status link for your victory tweet.')
      return
    }

    const normalizedX = normalizeX(xUsername)
    if (linkUsername && normalizedX && linkUsername.toLowerCase() !== normalizedX) {
      setVictoryTweetError('This tweet link does not match your saved X username.')
      return
    }

    const liveTweet = await verifyLiveTweetLink(normalizedTweetLink)
    if (!liveTweet.ok) {
      setVictoryTweetError('That X link could not be verified as a live post.')
      return
    }

    const resolvedTweetUsername = liveTweet.authorUsername || linkUsername
    if (!resolvedTweetUsername) {
      setVictoryTweetError('Could not confirm the username on that X link.')
      return
    }

    if (!usernamesMatch(resolvedTweetUsername, normalizedX)) {
      setVictoryTweetError('That live tweet belongs to a different X account.')
      return
    }

    setVictoryTweetError('')
    setVictoryTweetLinkInput(normalizedTweetLink)

    if (!normalizeTweetLink(profileTweetLink)) {
      try {
        await submitPuzzleProfileRecord({
          xUsername: normalizedX.startsWith('@') ? normalizedX : `@${normalizedX}`,
          walletAddress: walletAddress.trim(),
          tweetLink: normalizedTweetLink,
          tweetId,
          verifiedTweetUsername: resolvedTweetUsername.startsWith('@') ? resolvedTweetUsername : `@${resolvedTweetUsername}`,
        })
        const nextProfile = {
          xUsername: normalizedX.startsWith('@') ? normalizedX : `@${normalizedX}`,
          walletAddress: walletAddress.trim(),
          tweetLink: normalizedTweetLink,
        }
        localStorage.setItem(PUZZLE_PLAYER_PROFILE_KEY, JSON.stringify(nextProfile))
        setProfileTweetLink(normalizedTweetLink)
      } catch (error) {
        setVictoryTweetError(String(error?.message || 'Could not save your tweet record.'))
        return
      }
    }

    const submissionDetails = {
      walletAddress: walletAddress.trim(),
      xUsername: xUsername.trim(),
      tweetLink: normalizedTweetLink,
      score: Number(qualifiedScore || bestReferenceScore || score || 0),
      moves: Number(qualifiedMoves || moves || 0),
      time: Number(qualifiedTime || timeSec || 0),
      timestamp: Date.now(),
    }

    if (alreadySubmittedProof) {
      persistPuzzleSubmission(submissionDetails)
      openModal('Victory Tweet Saved', 'Victory tweet saved on this device. We will not ask for it again here.', 'success')
      return
    }

    const didSubmit = await submitQualifiedProof(
      submissionDetails.score,
      submissionDetails.moves,
      submissionDetails.time,
      normalizedTweetLink
    )

    if (didSubmit) {
      openModal('Submission Complete', 'Victory tweet captured and puzzle proof submitted.', 'success')
    }
  }

  const handleProfileStart = async (event) => {
    event.preventDefault()
    const normalizedX = xUsername.trim().replace(/^@+/, '')
    if (!normalizedX || normalizedX.length < 2) {
      openModal('Missing Username', 'Enter your X username.', 'error')
      return
    }
    if (!validateEvmAddress(walletAddress)) {
      openModal('Invalid Wallet', 'Enter a valid EVM wallet address.', 'error')
      return
    }

    setIsStartingGame(true)
    try {
      let rows = leaderboard
      try {
        const remoteRows = await fetchGoogleLeaderboard()
        if (remoteRows.length > 0) {
          rows = remoteRows
          setLeaderboard(remoteRows)
          saveLeaderboard(remoteRows)
          setLastLeaderboardSync(Date.now())
        }
      } catch {
        // Use cached rows when remote check is unavailable.
      }

      const identity = verifyIdentityAgainstRows(rows, normalizedX, walletAddress)
      if (identity.hasConflict) {
        openModal(
          'Already Existed',
          'This wallet address or X username already exists with different details. Use the original matching wallet + X pair.',
          'error'
        )
        return
      }

      const profile = {
        xUsername: normalizedX.startsWith('@') ? normalizedX : `@${normalizedX}`,
        walletAddress: walletAddress.trim(),
        tweetLink: identity.exactPair ? normalizeTweetLink(initialProfile.tweetLink || profileTweetLink) : '',
      }
      localStorage.setItem(PUZZLE_PLAYER_PROFILE_KEY, JSON.stringify(profile))
      setXUsername(profile.xUsername)
      setWalletAddress(profile.walletAddress)
      setProfileTweetLink(profile.tweetLink)
      setHasProfile(true)
      setVerifiedBestScore(identity.bestScore)
      setBestScore(identity.bestScore)
      localStorage.setItem('arcadeBestScore', String(identity.bestScore))
      trackGameEvent('profile_saved', {
        outcome: identity.exactPair ? 'returning_profile' : 'new_profile',
        bestScore: identity.bestScore,
        isReturningProfile: identity.exactPair || identity.bestScore > 0,
      })
      if (identity.exactPair) {
        openModal(
          'Welcome Back',
          `Welcome back. Your best verified score is ${identity.bestScore}. We will update it only when you beat this score.`,
          'success'
        )
      } else {
        openModal('Profile Saved', 'Details saved. You can now play the puzzle.', 'success')
      }
    } finally {
      setIsStartingGame(false)
    }
  }

  const handleSaveQualifiedImage = () => {
    const src = qualifiedImage || referenceImage
    if (!src) return
    const link = document.createElement('a')
    link.href = src
    link.download = `8bit-penguin-solved-${qualifiedScore || bestScore || Date.now()}.png`
    link.click()
  }

  const submitQualifiedProof = async (finalScore, submittedMoves, submittedTime, tweetLink) => {
    if (alreadySubmittedProof) return false
    const normalizedX = xUsername.trim().replace(/^@+/, '')
    if (!normalizedX || normalizedX.length < 2 || !validateEvmAddress(walletAddress)) return false
    const submittedScore = Number(finalScore || 0)
    const normalizedTweetLink = normalizeTweetLink(tweetLink)
    const { tweetId } = extractTweetMetaFromLink(normalizedTweetLink)
    if (!tweetId) return false
    let rows = leaderboard
    try {
      const remoteRows = await fetchGoogleLeaderboard()
      if (remoteRows.length > 0) {
        rows = remoteRows
        setLeaderboard(remoteRows)
        saveLeaderboard(remoteRows)
        setLastLeaderboardSync(Date.now())
      }
    } catch {
      // Continue with cached rows if live check fails.
    }

    const identity = verifyIdentityAgainstRows(rows, normalizedX, walletAddress)
    if (identity.hasConflict) {
      openModal(
        'Already Existed',
        'This wallet address or X username already exists with different details. Submission is blocked.',
        'error'
      )
      return false
    }

    const payload = {
      sheetName: PUZZLE_SUBMISSIONS_SHEET,
      eventType: 'puzzle_submission',
      xUsername: normalizedX.startsWith('@') ? normalizedX : `@${normalizedX}`,
      walletAddress: walletAddress.trim(),
      tweetLink: normalizedTweetLink,
      tweetId,
      requiredCaption: REQUIRED_TWEET_CAPTION,
      bestScore,
      currentScore: submittedScore,
      moves: Number(submittedMoves || 0),
      time: Number(submittedTime || 0),
      attemptNumber: 0,
      sessionID: browserId,
      qualified: true,
      timestamp: Date.now()
    }

    setIsSubmittingProof(true)
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      })
      let responseData = null
      try {
        responseData = await response.json()
      } catch {
        responseData = null
      }

      const apiError = String(responseData?.errorCode || responseData?.error || '').toLowerCase()
      const duplicateWallet = apiError.includes('duplicate_wallet') || apiError.includes('wallet already submitted')
      if (!response.ok || responseData?.ok === false) {
        if (duplicateWallet) {
          persistPuzzleSubmission({
            walletAddress: payload.walletAddress,
            xUsername: payload.xUsername,
            tweetLink: normalizedTweetLink,
            duplicate: true,
            score: submittedScore,
            moves: Number(submittedMoves || 0),
            time: Number(submittedTime || 0),
            timestamp: Date.now(),
          })
          const latestStatus = await syncProofStatus()
          if (latestStatus?.submitted) {
            openModal('Proof Recorded', 'A proof already existed for this wallet or your missing proof was attached to the existing record.', 'success')
          } else {
            openModal('Already Submitted', 'This wallet already has a submission on record, but the proof state is still unresolved. Refresh after redeploying the Apps Script update if needed.', 'error')
          }
          return false
        }
        throw new Error(String(responseData?.error || `HTTP ${response.status}`))
      }

      persistPuzzleSubmission({
        walletAddress: payload.walletAddress,
        xUsername: payload.xUsername,
        tweetLink: normalizedTweetLink,
        duplicate: false,
        score: submittedScore,
        moves: Number(submittedMoves || 0),
        time: Number(submittedTime || 0),
        timestamp: payload.timestamp,
      })
      setVerifiedBestScore(Math.max(Number(identity.bestScore || 0), submittedScore))
      const entry = {
        browserId,
        xUsername: payload.xUsername,
        walletAddress: payload.walletAddress,
        score: Number(submittedScore || 0),
        moves: Number(submittedMoves || 0),
      }
      setLeaderboard(upsertLeaderboardEntry(entry))
      try {
        await syncLeaderboardEntry(entry)
        const remoteRows = await fetchGoogleLeaderboard()
        if (remoteRows.length > 0) {
          setLeaderboard(remoteRows)
          saveLeaderboard(remoteRows)
        }
      } catch {
        // Keep local ranking if remote sync/read fails.
      }
      await syncProofStatus()
      return true
    } catch {
      openModal('Save Failed', 'Could not save qualification right now. Try solving again or refresh and retry.', 'error')
      return false
    } finally {
      setIsSubmittingProof(false)
    }
  }

  const handleTileSlide = (index) => {
    if (needsVictoryTweet) return
    if (gameState !== 'playing') return
    if (slideMove || slideLockRef.current) return
    if (tiles[index] === EMPTY_TILE) return

    const emptyIndex = tiles.indexOf(EMPTY_TILE)
    const fromRow = Math.floor(index / GRID)
    const fromCol = index % GRID
    const emptyRow = Math.floor(emptyIndex / GRID)
    const emptyCol = emptyIndex % GRID
    const isAdjacent = Math.abs(fromRow - emptyRow) + Math.abs(fromCol - emptyCol) === 1

    if (!isAdjacent) {
      return
    }

    slideLockRef.current = true

    if (instantMoveRef.current) {
      if (!hasStarted) beginTrackedRun()
      setTiles((prev) => {
        const next = [...prev]
        const nowEmptyIndex = next.indexOf(EMPTY_TILE)
        ;[next[index], next[nowEmptyIndex]] = [next[nowEmptyIndex], next[index]]
        return next
      })
      setHasStarted(true)
      setMoves((m) => m + 1)
      slideLockRef.current = false
      return
    }

    if (!hasStarted) beginTrackedRun()
    setSlideMove({
      fromIndex: index,
      tileId: tiles[index],
      rowDelta: emptyRow - fromRow,
      colDelta: emptyCol - fromCol
    })

    slideTimeoutRef.current = window.setTimeout(() => {
      setTiles((prev) => {
        const next = [...prev]
        const nowEmptyIndex = next.indexOf(EMPTY_TILE)
        ;[next[index], next[nowEmptyIndex]] = [next[nowEmptyIndex], next[index]]
        return next
      })
      setHasStarted(true)
      setMoves((m) => m + 1)
      setSlideMove(null)
      slideLockRef.current = false
      slideTimeoutRef.current = null
    }, SLIDE_MS)
  }

  return (
    <div className="puzzle-page">
      <div className={`puzzle-shell ${!hasProfile ? 'pregame-mode' : ''}`}>
        <SiteNav label={`Play-to-WL · ${GRID_LABEL}`} />

        {!hasProfile ? (
          <main className="puzzle-main">
            <section className="puzzle-board-card leaderboard-tab-panel pregame-panel">
              <div className="section-head">
                <h2>Before You Play</h2>
                <span className="status-chip">Required</span>
              </div>
              <p className="submission-help">Enter your X username and wallet address to unlock the puzzle challenge.</p>
              <div className="pregame-guide">
                <div className="pregame-guide-card">
                  <h3>How to Play</h3>
                  <p>Slide tiles into the empty space until the full image is restored.</p>
                  <p>You can click any tile adjacent to the empty slot to move it.</p>
                  <p>Your run starts at 1000 points and your score drops as moves and time increase.</p>
                </div>
                <div className="pregame-guide-card">
                  <h3>Qualification Rules</h3>
                  <p>Finish with a final score of 500 or higher to qualify.</p>
                  <p>Fast, efficient solves earn bonus points and improve your leaderboard rank.</p>
                  <p>Save your profile below first. Your tweet proof will only be requested after you qualify.</p>
                </div>
              </div>
              <div className="pregame-flow-divider">
                <span>Next Step</span>
              </div>
              <div className="pregame-form-shell">
                <p className="pregame-form-lead">Save your profile to unlock the puzzle board and leaderboard.</p>
                <form className="proof-form pregame-form" onSubmit={handleProfileStart}>
                  <label className="proof-label" htmlFor="pregame-x-username">X Username</label>
                  <input
                    id="pregame-x-username"
                    type="text"
                    placeholder="@yourusername"
                    value={xUsername}
                    onChange={(e) => setXUsername(e.target.value)}
                  />
                  <label className="proof-label" htmlFor="pregame-wallet">EVM Wallet Address</label>
                  <input
                    id="pregame-wallet"
                    type="text"
                    placeholder="0x..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                  />
                  <button className="puzzle-btn white" type="submit" disabled={isStartingGame} aria-busy={isStartingGame}>
                    {isStartingGame ? 'Starting Game...' : 'Save & Start Game'}
                  </button>
                </form>
              </div>
            </section>
          </main>
        ) : (
          <>
        <div className="puzzle-tabs">
          <button
            type="button"
            className={`puzzle-tab ${activeTab === 'game' ? 'active' : ''}`}
            onClick={() => setActiveTab('game')}
          >
            Game
          </button>
          <button
            type="button"
            className={`puzzle-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
            disabled={needsVictoryTweet}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
        </div>

        <main className="puzzle-main">
          {activeTab === 'game' ? (
          <>
          <section className={`puzzle-board-card ${scoreAlertLevel === 'red' ? 'alert-red' : scoreAlertLevel === 'amber' ? 'alert-amber' : ''}`}>
            <div className="section-head">
              <h2>Puzzle Board</h2>
              <span className={`status-chip ${boardStatus.tone}`}>
                {boardStatus.label}
              </span>
            </div>
            {needsVictoryTweet && (
              <div className="victory-proof-card victory-proof-card-prominent">
                <div className="section-head victory-proof-head">
                  <h3>Submit Victory Proof</h3>
                  <span className="status-chip warn">Required</span>
                </div>
                <p className="victory-proof-copy">
                  {proofExpired
                    ? 'Your proof window has expired. Submit your victory tweet link now so the proof can be reviewed.'
                    : 'You already qualified. Submit your victory tweet link now before you can continue playing or open the leaderboard.'}
                </p>
                <div className="victory-proof-warning" role="alert">
                  {proofExpired
                    ? 'Your 24-hour proof window has passed. Your leaderboard rank is no longer safe until this proof is resolved.'
                    : 'Your leaderboard rank is hanging on this proof. If you do not submit your victory proof within the next 24 hours, you will be removed from the leaderboard.'}
                </div>
                {isLoadingProofStatus && <p className="victory-proof-meta">Checking latest proof status...</p>}
                <form className="proof-form victory-proof-form" onSubmit={handleVictoryTweetSubmit}>
                  <label className="proof-label" htmlFor="victory-tweet-link">Victory Tweet Link</label>
                  <input
                    id="victory-tweet-link"
                    type="url"
                    placeholder="https://x.com/yourname/status/..."
                    value={victoryTweetLinkInput}
                    onChange={(event) => {
                      setVictoryTweetLinkInput(event.target.value)
                      setVictoryTweetError('')
                    }}
                  />
                  {victoryTweetError && <p className="victory-proof-error">{victoryTweetError}</p>}
                  <div className="victory-proof-actions">
                    <button className="puzzle-btn white" type="button" onClick={() => handleComposeTweet()}>
                      Tweet Victory
                    </button>
                    <button className="puzzle-btn" type="submit" disabled={isSubmittingProof} aria-busy={isSubmittingProof}>
                      {isSubmittingProof ? 'Saving...' : alreadySubmittedProof ? 'Save Link' : 'Submit Proof'}
                    </button>
                  </div>
                </form>
              </div>
            )}
            <div className="puzzle-stats">
              <div className="stat-pill"><span>Moves</span><strong>{moves}</strong></div>
              <div className="stat-pill"><span>Time</span><strong>{formatElapsed(timeSec)}</strong></div>
              <div className="stat-pill"><span>Score</span><strong>{score}</strong></div>
              <div className="stat-pill"><span>Target</span><strong>{PUZZLE_TARGET_SCORE}</strong></div>
            </div>
            <div className="board-qualification">
              <div className="player-row">
                <span className="player-cell">Best Score: <strong>{bestScore}</strong></span>
                <span className="player-cell">X Handle: <strong>{xUsername || '-'}</strong></span>
                <span className="player-cell">Wallet: <strong>{shortWallet(walletAddress)}</strong></span>
                <span className="player-cell">Your Rank: <strong>{userRank ? `#${userRank}` : '-'}</strong></span>
              </div>
            </div>

            <div className="score-track">
              <div
                className="score-fill"
                style={{ width: `${Math.min(100, (score / PUZZLE_TARGET_SCORE) * 100)}%` }}
              />
            </div>

            {gameState === 'won' ? (
              <div className="puzzle-finished">
                <div className="joined-image-wrap">
                  <div
                    className="joined-image"
                    style={{
                      '--grid-size': GRID,
                      backgroundImage: `url(${referenceImage})`
                    }}
                  />
                </div>
                <div className="victory-actions">
                  {qualified ? (
                    <>
                      <button className="puzzle-btn white" type="button" onClick={handleSaveQualifiedImage}>
                        Save Image
                      </button>
                      <button
                        className="puzzle-btn white"
                        type="button"
                        disabled={isSubmittingProof}
                        aria-busy={isSubmittingProof}
                        onClick={() => {
                          handleComposeTweet()
                        }}
                      >
                        {isSubmittingProof ? 'Saving...' : 'Tweet'}
                      </button>
                    </>
                  ) : null}
                  <button className="puzzle-btn" type="button" onClick={handlePlayAgain} disabled={needsVictoryTweet}>
                    Play Again
                  </button>
                </div>
              </div>
            ) : gameState === 'lost' ? (
              <div className="puzzle-finished">
                <div className="result-banner lost">
                  <span className="result-kicker">Run Failed</span>
                  <h3>Score Dropped Below Target</h3>
                  <p>Your live score fell below {PUZZLE_TARGET_SCORE} before the image was solved. Reset and make a cleaner run.</p>
                </div>
                <div className="victory-actions">
                  <button className="puzzle-btn" type="button" onClick={handlePlayAgain} disabled={needsVictoryTweet}>
                    Play Again
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`puzzle-grid ${slideMove ? 'animating' : ''}`}
                style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}
              >
                {tiles.map((tileId, idx) => {
                  const row = Math.floor(tileId / GRID)
                  const col = tileId % GRID
                  const isSlidingTile = slideMove && slideMove.tileId === tileId && slideMove.fromIndex === idx
                  return (
                    <button
                      key={tileId}
                      className={`tile ${tileId === EMPTY_TILE ? 'empty' : ''} ${isSlidingTile ? 'sliding' : ''}`}
                      onClick={() => handleTileSlide(idx)}
                      style={isSlidingTile ? {
                        '--move-row': slideMove.rowDelta,
                        '--move-col': slideMove.colDelta
                      } : undefined}
                    >
                      <span
                        className="tile-image"
                        style={{
                          backgroundImage: `url(${referenceImage})`,
                          backgroundSize: `${GRID * 100}% ${GRID * 100}%`,
                          backgroundPosition: `${(col / (GRID - 1)) * 100}% ${(row / (GRID - 1)) * 100}%`
                        }}
                      />
                    </button>
                  )
                })}
              </div>
            )}

            <p className="instruction">
              {gameState === 'won'
                ? qualified
                  ? needsVictoryTweet
                    ? 'Victory unlocked. Submit your victory proof to continue.'
                    : 'Victory unlocked. Tweet your score and keep climbing the leaderboard.'
                  : 'Run complete. Start another attempt to improve.'
                : gameState === 'lost'
                  ? `Score dropped below ${PUZZLE_TARGET_SCORE}. Start another attempt to continue.`
                : 'Slide tiles into the empty space to arrange the image.'}
            </p>
            <div className="puzzle-board-actions">
              {gameState === 'playing' && (
                <button className="puzzle-btn shuffle-btn" onClick={handleShuffle} disabled={needsVictoryTweet}>Shuffle</button>
              )}
            </div>
          </section>

            <aside className="puzzle-side">
            <div className="side-card side-card-reference">
              <h3>Reference</h3>
              <div className="reference-image medium" style={{ backgroundImage: `url(${referenceImage})` }} />
            </div>

            <div className="side-card side-card-status">
              <h3>Run Status</h3>
              <div className="run-status-grid">
                <div className="run-status-item">
                  <span>Final Score</span>
                  <strong>{projectedFinalScore}</strong>
                </div>
                <div className="run-status-item">
                  <span>Score Left</span>
                  <strong className={projectedFinalScore >= PUZZLE_TARGET_SCORE ? 'ok' : 'pending'}>
                    {projectedFinalScore >= PUZZLE_TARGET_SCORE ? '+' : ''}{projectedFinalScore - PUZZLE_TARGET_SCORE}
                  </strong>
                </div>
                <div className="run-status-item">
                  <span>Vs Best</span>
                  <strong className={projectedDeltaToBest >= 0 ? 'ok' : 'pending'}>
                    {projectedDeltaToBest >= 0 ? '+' : ''}{projectedDeltaToBest}
                  </strong>
                </div>
                <div className="run-status-item">
                  <span>Vs Rival</span>
                  <strong className={rivalDelta !== null && rivalDelta <= 0 ? 'ok' : 'pending'}>
                    {rivalDelta === null ? '-' : `${rivalDelta > 0 ? '+' : ''}${rivalDelta}`}
                  </strong>
                </div>
              </div>
              <div className="run-breakdown">
                <div className="run-breakdown-row">
                  <span>Move penalty</span>
                  <strong>-{scoreBreakdown.movePenalty}</strong>
                </div>
                <div className="run-breakdown-row">
                  <span>Time penalty</span>
                  <strong>-{scoreBreakdown.timePenalty}</strong>
                </div>
                <div className="run-breakdown-row">
                  <span>Potential bonuses</span>
                  <strong className="ok">+{scoreBreakdown.potentialBonus}</strong>
                </div>
              </div>
            </div>

            <div className="side-card side-card-bonuses">
              <h3>Bonus Tracker</h3>
              <div className="bonus-tracker">
                <div className={`bonus-chip ${scoreBreakdown.efficiencyBonus ? 'active' : ''}`}>
                  <span>Low Moves</span>
                  <strong>{scoreBreakdown.efficiencyBonus ? '+120' : '<= 30 moves'}</strong>
                </div>
                <div className={`bonus-chip ${scoreBreakdown.speedBonus ? 'active' : ''}`}>
                  <span>Fast Time</span>
                  <strong>{scoreBreakdown.speedBonus ? '+100' : '<= 90 sec'}</strong>
                </div>
                <div className={`bonus-chip ${scoreBreakdown.stabilityBonus ? 'active' : ''}`}>
                  <span>Clean Run</span>
                  <strong>{scoreBreakdown.stabilityBonus ? '+60' : '<= 60 moves'}</strong>
                </div>
              </div>
            </div>

            <div className="side-card side-card-scoring">
              <h3>Scoring</h3>
              <p>You start every run with 1000 points.</p>
              <p>Moves reduce your score: 3 points each for the first 30 moves, 5 points each for moves 31 to 60, and 7 points each after that.</p>
              <p>Time also reduces your score: 0.5 per second for the first 2 minutes, 1 per second for the next 3 minutes, and 1.5 per second after 5 minutes.</p>
              <p>When you solve the puzzle, you can earn bonuses: +120 for 30 moves or less, +100 for 90 seconds or less, and +60 for 60 moves or less.</p>
              <p>If your live score drops below 500 before you solve the puzzle, the run ends. To qualify, your final solved score must be 500 or more.</p>
            </div>

            <div className="side-card side-card-rivals">
              <h3>Nearby Rivals</h3>
              {rivalSnapshot.above || rivalSnapshot.below ? (
                <div className="rival-list">
                  {rivalSnapshot.above && (
                    <div className="rival-row">
                      <span className="rival-label">Above</span>
                      <span className="rival-name">{rivalSnapshot.above.xUsername || 'Anonymous'}</span>
                      <strong className="rival-score">{rivalSnapshot.above.score}</strong>
                    </div>
                  )}
                  {rivalSnapshot.below && (
                    <div className="rival-row">
                      <span className="rival-label">Below</span>
                      <span className="rival-name">{rivalSnapshot.below.xUsername || 'Anonymous'}</span>
                      <strong className="rival-score">{rivalSnapshot.below.score}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <p>Finish a qualified run to anchor your rank, then track the players directly around you.</p>
              )}
            </div>

          </aside>
          </>
          ) : (
            <section className="puzzle-board-card leaderboard-tab-panel">
              <div className="section-head">
                <h2>Leaderboard</h2>
                <span className="status-chip">Global</span>
              </div>
              <p className="leaderboard-subtitle">Global rankings sorted by solved score, then lower moves.</p>
              <div className="leaderboard-meta">
                <span className="leaderboard-pill">Auto-sync: every 20s</span>
                <span className="leaderboard-pill">
                  {lastLeaderboardSync
                    ? `Last synced: ${new Date(lastLeaderboardSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'Last synced: waiting...'}
                </span>
                {isLeaderboardLoading && <span className="leaderboard-pill loading">Syncing now...</span>}
              </div>
              <div className="leaderboard-search-row">
                <label className="leaderboard-search-field" htmlFor="leaderboard-search">
                  <span className="leaderboard-search-label">Search X Handle</span>
                  <input
                    id="leaderboard-search"
                    type="text"
                    className="leaderboard-search-input"
                    placeholder="@yourhandle"
                    value={leaderboardSearch}
                    onChange={(e) => setLeaderboardSearch(e.target.value)}
                  />
                </label>
                {leaderboardSearch.trim() && (
                  <button
                    type="button"
                    className="puzzle-btn white leaderboard-search-clear"
                    onClick={() => setLeaderboardSearch('')}
                  >
                    Clear
                  </button>
                )}
              </div>
              {leaderboard.length === 0 ? (
                <p>No entries yet.</p>
              ) : filteredLeaderboard.length === 0 ? (
                <p className="leaderboard-empty">
                  No leaderboard entries found for that X handle.
                </p>
              ) : (
                <>
                <div className="leaderboard-list">
                  <div className="leader-row leader-header" aria-hidden="true">
                    <span className="leader-rank">Rank</span>
                    <span className="leader-name">Username</span>
                    <span className="leader-wallet">Wallet</span>
                    <span className="leader-score">Score</span>
                    <span className="leader-time">Moves</span>
                    <span className="leader-time">Time</span>
                  </div>
                  {paginatedLeaderboard.map((row, index) => {
                    const rank = (leaderboardPage - 1) * LEADERBOARD_PAGE_SIZE + index + 1
                    return (
                      <div key={`${row.browserId}-${rank}`} className={`leader-row rank-${rank}`}>
                        <span className="leader-rank">#{rank}</span>
                        <span className="leader-name">{row.xUsername || `Anon-${String(row.browserId || '').slice(-4)}`}</span>
                        <span className="leader-wallet">{shortWallet(row.walletAddress)}</span>
                        <strong className="leader-score">{row.score}</strong>
                        <span className="leader-time">{Number.isFinite(Number(row.moves)) && Number(row.moves) > 0 ? row.moves : '-'}</span>
                        <span className="leader-time">{Number.isFinite(Number(row.timeSec)) && Number(row.timeSec) > 0 ? formatElapsed(row.timeSec) : '-'}</span>
                      </div>
                  )})}
                </div>
                {filteredLeaderboard.length > LEADERBOARD_PAGE_SIZE && (
                  <div className="leaderboard-pagination">
                    <span className="leaderboard-page-info">
                      Page {leaderboardPage} of {totalLeaderboardPages}
                    </span>
                    <div className="leaderboard-page-actions">
                      <button
                        type="button"
                        className="puzzle-btn white leaderboard-page-btn"
                        disabled={leaderboardPage <= 1}
                        onClick={() => setLeaderboardPage((page) => Math.max(1, page - 1))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="puzzle-btn white leaderboard-page-btn"
                        disabled={leaderboardPage >= totalLeaderboardPages}
                        onClick={() => setLeaderboardPage((page) => Math.min(totalLeaderboardPages, page + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}
            </section>
          )}
        </main>
        </>
        )}
      </div>
      {winConfetti.length > 0 && (
        <div className="puzzle-page-confetti" aria-hidden="true">
          {winConfetti.map((piece) => (
            <div
              key={piece.id}
              className="puzzle-page-confetti-piece"
              style={{
                left: `${piece.left}%`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                width: piece.size,
                height: piece.size,
                '--confetti-drift-x': `${piece.driftX}px`,
                '--confetti-rotate-start': `${piece.rotateStart}deg`,
                '--confetti-rotate-end': `${piece.rotateEnd}deg`,
              }}
            />
          ))}
        </div>
      )}
      {modal.open && (
        <div className="puzzle-modal-overlay" onClick={closeModal}>
          <div className={`puzzle-modal ${modal.tone}`} onClick={(e) => e.stopPropagation()}>
            <div className="puzzle-modal-head">
              <span className={`modal-dot ${modal.tone}`} aria-hidden="true" />
              <h3>{modal.title}</h3>
            </div>
            <p className="puzzle-modal-message">{modal.message}</p>
            <div className="puzzle-modal-actions">
              {modal.actionLabel && modalAction && (
                <button
                  className="puzzle-btn"
                  type="button"
                  onClick={() => {
                    closeModal()
                    window.setTimeout(() => {
                      modalAction()
                    }, 0)
                  }}
                >
                  {modal.actionLabel}
                </button>
              )}
              <button className="puzzle-btn white" type="button" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayToWL
