import { useEffect, useMemo, useState } from 'react'
import { drawAgent, generateRandomPenguinTraits } from './App'
import SiteNav from './SiteNav.jsx'
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
const REQUIRED_TWEET_CAPTION = 'Just Solved The @8bitpenguin_xyz puzzle'
const REQUIRED_TWEET_CTA = 'Solve The Puzzle And Secure Whitelist: https://8bitpenguins.xyz/play-to-wl'
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBo9wDhr2DYdQSsmhvek2JnY4oo_MYa9FV-WrgzDJ4BctN3IAv3PQvUvZ0QlmZPd0/exec'
const LEADERBOARD_SHEET = 'Leaderboard'

async function buildPuzzleReferenceImage() {
  try {
    await document.fonts?.load?.('700 32px "Press Start 2P"')
  } catch {
    // Continue with fallback font if font API is unavailable.
  }

  const canvas = document.createElement('canvas')
  const traits = generateRandomPenguinTraits()
  drawAgent(traits, canvas, 4096)
  return canvas.toDataURL('image/png')
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

function formatLeaderboardTime(ts) {
  if (!ts) return '-'
  return new Date(Number(ts)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getBrowserId() {
  const existing = localStorage.getItem(PUZZLE_BROWSER_ID_KEY)
  if (existing) return existing
  const next = `b${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(PUZZLE_BROWSER_ID_KEY, next)
  return next
}

function loadLeaderboard() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PUZZLE_LEADERBOARD_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(PUZZLE_LEADERBOARD_KEY, JSON.stringify(entries))
}

function loadPlayerProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PUZZLE_PLAYER_PROFILE_KEY) || '{}')
    const xUsername = String(parsed?.xUsername || '').trim()
    const walletAddress = String(parsed?.walletAddress || '').trim()
    return {
      xUsername,
      walletAddress,
      ready: xUsername.length >= 2 && validateEvmAddress(walletAddress),
    }
  } catch {
    return { xUsername: '', walletAddress: '', ready: false }
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
    limit: '100',
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
    .slice(0, 100)
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
  const [browserId] = useState(() => getBrowserId())
  const [tiles, setTiles] = useState(() => shuffleTiles())
  const [slideMove, setSlideMove] = useState(null)
  const [hasStarted, setHasStarted] = useState(false)
  const [moves, setMoves] = useState(0)
  const [timeSec, setTimeSec] = useState(0)
  const [gameState, setGameState] = useState('playing')
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('arcadeBestScore') || 0))
  const [qualified, setQualified] = useState(() => localStorage.getItem('arcadeQualified') === 'true')
  const [referenceImage, setReferenceImage] = useState('')
  const [qualifiedImage, setQualifiedImage] = useState('')
  const [xUsername, setXUsername] = useState(() => initialProfile.xUsername)
  const [walletAddress, setWalletAddress] = useState(() => initialProfile.walletAddress)
  const [hasProfile, setHasProfile] = useState(() => initialProfile.ready)
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [alreadySubmittedProof, setAlreadySubmittedProof] = useState(() => Boolean(localStorage.getItem(PUZZLE_SUBMISSION_KEY)))
  const [modal, setModal] = useState({ open: false, title: '', message: '', tone: 'info', actionLabel: '' })
  const [modalAction, setModalAction] = useState(null)
  const [qualifiedScore, setQualifiedScore] = useState(() => Number(localStorage.getItem('arcadeQualifiedScore') || 0))
  const [qualifiedMoves, setQualifiedMoves] = useState(() => Number(localStorage.getItem(PUZZLE_QUALIFIED_MOVES_KEY) || 0))
  const [qualifiedTime, setQualifiedTime] = useState(() => Number(localStorage.getItem(PUZZLE_QUALIFIED_TIME_KEY) || 0))
  const [leaderboard, setLeaderboard] = useState(() => loadLeaderboard())
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false)
  const [lastLeaderboardSync, setLastLeaderboardSync] = useState(null)
  const [activeTab, setActiveTab] = useState('game')
  const [verifiedBestScore, setVerifiedBestScore] = useState(0)

  const solved = useMemo(() => tiles.every((v, idx) => v === idx), [tiles])
  const score = useMemo(() => computeScore(moves, timeSec, { includeBonuses: false }), [moves, timeSec])
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

  const refreshLeaderboard = async (silent = false) => {
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
  }

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

  useEffect(() => {
    if (!hasStarted) return
    if (gameState !== 'playing') return
    if (score >= PUZZLE_TARGET_SCORE) return
    setSlideMove(null)
    setGameState('won')
    openModal('Score Dropped', `Score is below ${PUZZLE_TARGET_SCORE}. Click Try Again to restart.`, 'error', {
      label: 'Try Again',
      onClick: resetGame,
    })
  }, [score, hasStarted, gameState])

  useEffect(() => {
    if (!solved || gameState === 'won') return
    const finalScore = computeScore(moves, timeSec, { includeBonuses: true })
    const nextBest = Math.max(bestScore, finalScore)
    setBestScore(nextBest)
    localStorage.setItem('arcadeBestScore', String(nextBest))
    if (finalScore >= PUZZLE_TARGET_SCORE) {
      const previousHigh = Math.max(Number(bestScore || 0), Number(verifiedBestScore || 0))
      const beatBest = finalScore > previousHigh
      localStorage.setItem('arcadeQualified', 'true')
      localStorage.setItem('arcadeQualifiedScore', String(finalScore))
      localStorage.setItem(PUZZLE_QUALIFIED_MOVES_KEY, String(moves))
      localStorage.setItem(PUZZLE_QUALIFIED_TIME_KEY, String(timeSec))
      setQualified(true)
      setQualifiedScore(finalScore)
      setQualifiedMoves(moves)
      setQualifiedTime(timeSec)
      setQualifiedImage(referenceImage)
      syncRunToLeaderboard(finalScore, moves, timeSec)
      submitQualifiedProof(finalScore, moves, timeSec)
      openModal(
        'Qualified',
        beatBest
          ? `Final score ${finalScore}. New personal best (previous ${previousHigh}). Post your victory now.`
          : `Final score ${finalScore}. Qualified for whitelist, but your best score remains ${previousHigh}. Post your victory now.`,
        'success',
        {
          label: 'Tweet Victory',
          onClick: () => handleComposeTweet({ score: finalScore, moves, timeSec }),
        }
      )
    } else {
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
    }
    setGameState('won')
  }, [solved, gameState, moves, timeSec, bestScore, referenceImage, browserId, verifiedBestScore])

  useEffect(() => {
    if (bestScore < PUZZLE_TARGET_SCORE) return
    if (!qualified) {
      setQualified(true)
      localStorage.setItem('arcadeQualified', 'true')
    }
    if (qualifiedScore < PUZZLE_TARGET_SCORE) {
      setQualifiedScore(bestScore)
      localStorage.setItem('arcadeQualifiedScore', String(bestScore))
    }
  }, [bestScore, qualified, qualifiedScore])

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
    if (slideMove) return
    setTiles(shuffleTiles())
    setHasStarted(false)
    setMoves(0)
    setTimeSec(0)
    setGameState('playing')
  }

  const handlePlayAgain = async () => {
    if (slideMove) return
    const nextReferenceImage = await buildPuzzleReferenceImage()
    setReferenceImage(nextReferenceImage)
    resetGame()
  }

  const failRun = (reason) => {
    setSlideMove(null)
    setGameState('playing')
    setTiles(shuffleTiles())
    setHasStarted(false)
    setMoves(0)
    setTimeSec(0)
    openModal('Run Reset', `${reason}. Start a new run now.`, 'info')
  }

  const handleShuffle = () => {
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
    }
    localStorage.setItem(PUZZLE_PLAYER_PROFILE_KEY, JSON.stringify(profile))
    setXUsername(profile.xUsername)
    setWalletAddress(profile.walletAddress)
    setHasProfile(true)
    setVerifiedBestScore(identity.bestScore)
    setBestScore(identity.bestScore)
    localStorage.setItem('arcadeBestScore', String(identity.bestScore))
    if (identity.exactPair) {
      openModal(
        'Welcome Back',
        `Welcome back. Your best verified score is ${identity.bestScore}. We will update it only when you beat this score.`,
        'success'
      )
    } else {
      openModal('Profile Saved', 'Details saved. You can now play the puzzle.', 'success')
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

  const submitQualifiedProof = async (finalScore, submittedMoves, submittedTime) => {
    if (alreadySubmittedProof) return
    const normalizedX = xUsername.trim().replace(/^@+/, '')
    if (!normalizedX || normalizedX.length < 2 || !validateEvmAddress(walletAddress)) return
    const submittedScore = Number(finalScore || 0)
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
      return
    }

    const payload = {
      sheetName: 'Puzzle Submissions',
      eventType: 'puzzle_submission',
      xUsername: normalizedX.startsWith('@') ? normalizedX : `@${normalizedX}`,
      walletAddress: walletAddress.trim(),
      tweetLink: '',
      requiredCaption: REQUIRED_TWEET_CAPTION,
      bestScore,
      currentScore: submittedScore,
      moves: Number(submittedMoves || 0),
      time: Number(submittedTime || 0),
      attemptNumber: 0,
      sessionID: browserId,
      qualified: true,
      imageData: qualifiedImage || referenceImage,
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
          localStorage.setItem(PUZZLE_SUBMISSION_KEY, JSON.stringify({ walletAddress: payload.walletAddress, duplicate: true, timestamp: Date.now() }))
          setAlreadySubmittedProof(true)
          openModal('Wallet Already Submitted', 'This wallet has already submitted puzzle proof. One wallet can only submit once.', 'error')
          return
        }
        throw new Error(String(responseData?.error || `HTTP ${response.status}`))
      }

      localStorage.setItem(PUZZLE_SUBMISSION_KEY, JSON.stringify(payload))
      setAlreadySubmittedProof(true)
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
      openModal('Score Saved', 'Qualification saved successfully. Tweet your victory to complete social proof.', 'success')
    } catch {
      openModal('Save Failed', 'Could not save qualification right now. Try solving again or refresh and retry.', 'error')
    } finally {
      setIsSubmittingProof(false)
    }
  }

  const handleTileSlide = (index) => {
    if (gameState !== 'playing') return
    if (slideMove) return
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

    setSlideMove({
      fromIndex: index,
      tileId: tiles[index],
      rowDelta: emptyRow - fromRow,
      colDelta: emptyCol - fromCol
    })

    window.setTimeout(() => {
      setTiles((prev) => {
        const next = [...prev]
        const nowEmptyIndex = next.indexOf(EMPTY_TILE)
        ;[next[index], next[nowEmptyIndex]] = [next[nowEmptyIndex], next[index]]
        return next
      })
      setHasStarted(true)
      setMoves((m) => m + 1)
      setSlideMove(null)
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
                <button className="puzzle-btn white" type="submit">
                  Save & Start Game
                </button>
              </form>
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
              <span className={`status-chip ${qualified ? 'ok' : ''}`}>
                {qualified ? 'Qualified' : 'In Progress'}
              </span>
            </div>
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
                <div
                  className="joined-image"
                  style={{
                    '--grid-size': GRID,
                    backgroundImage: `url(${referenceImage})`
                  }}
                />
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
                        onClick={() => {
                          handleComposeTweet()
                        }}
                      >
                        {isSubmittingProof ? 'Saving...' : 'Tweet Victory'}
                      </button>
                    </>
                  ) : null}
                  <button className="puzzle-btn" type="button" onClick={handlePlayAgain}>
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
                      key={`${tileId}-${idx}`}
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
                ? qualified ? 'Victory unlocked. Tweet your score and keep climbing the leaderboard.' : 'Run complete. Start another attempt to improve.'
                : 'Slide tiles into the empty space to arrange the image.'}
            </p>
            <div className="puzzle-board-actions">
              {gameState !== 'won' && (
                <button className="puzzle-btn shuffle-btn" onClick={handleShuffle}>Shuffle</button>
              )}
            </div>
          </section>

          <aside className="puzzle-side">
            <div className="side-card">
              <h3>Reference</h3>
              <div className="reference-image medium" style={{ backgroundImage: `url(${referenceImage})` }} />
            </div>

            <div className="side-card">
              <h3>Scoring</h3>
              <p>Your run starts at 1000 points. The live score drops as you use more moves and more time.</p>
              <p>Moves cost 3 each for the first 30 moves, 5 each for moves 31-60, then 7 each after that.</p>
              <p>Time costs 0.5 per second for the first 2 minutes, 1 per second for minutes 3-5, then 1.5 per second after 5 minutes.</p>
              <p>When you finish, bonus points are added: +120 for 30 moves or less, +100 for 90 seconds or less, and +60 for 60 moves or less.</p>
              <p>You qualify only if your solved final score is 500 or higher after those bonuses are added. Final score never goes below 200.</p>
            </div>

          </aside>
          </>
          ) : (
            <section className="puzzle-board-card leaderboard-tab-panel">
              <div className="section-head">
                <h2>Leaderboard</h2>
                <span className="status-chip">Global</span>
              </div>
              <p className="leaderboard-subtitle">Global Top 100 ranked by solved score, then lower moves.</p>
              <div className="leaderboard-meta">
                <span className="leaderboard-pill">Auto-sync: every 20s</span>
                <span className="leaderboard-pill">
                  {lastLeaderboardSync
                    ? `Last synced: ${new Date(lastLeaderboardSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'Last synced: waiting...'}
                </span>
                {isLeaderboardLoading && <span className="leaderboard-pill loading">Syncing now...</span>}
              </div>
              {leaderboard.length === 0 ? (
                <p>No entries yet.</p>
              ) : (
                <div className="leaderboard-list">
                  <div className="leader-row leader-header" aria-hidden="true">
                    <span className="leader-rank">Rank</span>
                    <span className="leader-name">Username</span>
                    <span className="leader-wallet">Wallet</span>
                    <span className="leader-score">Score</span>
                    <span className="leader-time">Moves</span>
                    <span className="leader-time">Time</span>
                  </div>
                  {leaderboard.slice(0, 100).map((row, index) => (
                    <div key={`${row.browserId}-${index}`} className={`leader-row rank-${index + 1}`}>
                      <span className="leader-rank">#{index + 1}</span>
                      <span className="leader-name">{row.xUsername || `Anon-${String(row.browserId || '').slice(-4)}`}</span>
                      <span className="leader-wallet">{shortWallet(row.walletAddress)}</span>
                      <strong className="leader-score">{row.score}</strong>
                      <span className="leader-time">{Number.isFinite(Number(row.moves)) && Number(row.moves) > 0 ? row.moves : '-'}</span>
                      <span className="leader-time">{Number.isFinite(Number(row.timeSec)) && Number(row.timeSec) > 0 ? formatElapsed(row.timeSec) : '-'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
        </>
        )}
      </div>
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
