import { useEffect, useMemo, useState } from 'react'
import { drawAgent, generateRandomPenguinTraits } from './App'
import './PlayToWL.css'

const GRID = 3
const TOTAL_TILES = GRID * GRID
const GRID_LABEL = `${GRID}x${GRID}`
const PUZZLE_TARGET_SCORE = 500
const IMAGE_SRC = '/favicon.png'
const EMPTY_TILE = TOTAL_TILES - 1
const SLIDE_MS = 190
const ATTEMPT_TIMEOUT_MS = 10 * 60 * 1000
const ATTEMPT_TIMEOUT_KEY = 'arcadeTimeoutUntil'
const ATTEMPT_TIMEOUT_REASON_KEY = 'arcadeTimeoutReason'
const PUZZLE_SUBMISSION_KEY = 'puzzleGameSubmission'
const PUZZLE_QUALIFIED_IMAGE_KEY = 'arcadeQualifiedImage'
const PUZZLE_LEADERBOARD_KEY = 'puzzleLeaderboard'
const PUZZLE_BROWSER_ID_KEY = 'puzzleBrowserId'
const REQUIRED_TWEET_CAPTION = 'Just Solved The @8bitpenguin_xyz puzzle'
const REQUIRED_TWEET_CTA = 'Secure your Whitelist here: https://8bitpenguins.xyz/play-to-wl'
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzqgy0yX3nGOlMBxGVDdwFQstC0e2ADgW0ESL9hol2yD1eiY3RF3uxq7cbuHYTaMSNt/exec'
const LEADERBOARD_SHEET = 'Leaderboard'
let sessionReferenceImage = ''

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

function computeScore(moves, timeSec) {
  const movePenalty =
    Math.min(moves, 20) * 5 +
    Math.min(Math.max(0, moves - 20), 20) * 8 +
    Math.max(0, moves - 40) * 10

  const timePenalty =
    Math.min(timeSec, 120) * 1 +
    Math.min(Math.max(0, timeSec - 120), 180) * 2 +
    Math.max(0, timeSec - 300) * 3

  const efficiencyBonus = moves <= 30 ? 80 : 0
  const speedBonus = timeSec <= 90 ? 60 : 0

  return Math.max(0, Math.round(1000 - movePenalty - timePenalty + efficiencyBonus + speedBonus))
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function validateEvmAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function validateTweetLink(link) {
  return /^https:\/\/(x\.com|twitter\.com|mobile\.twitter\.com)\/[\w.-]+\/status\/\d+(\?.*)?$/.test(link)
}

function shortWallet(wallet) {
  if (!wallet || wallet.length < 10) return wallet || '-'
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
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

function upsertLeaderboardEntry(entry) {
  const rows = loadLeaderboard()
  const idx = rows.findIndex(
    (row) =>
      row.browserId === entry.browserId ||
      (row.walletAddress && entry.walletAddress && row.walletAddress.toLowerCase() === entry.walletAddress.toLowerCase()) ||
      (row.xUsername && entry.xUsername && row.xUsername.toLowerCase() === entry.xUsername.toLowerCase())
  )

  if (idx >= 0) {
    if (entry.score > Number(rows[idx].score || 0)) {
      rows[idx] = { ...rows[idx], ...entry, updatedAt: Date.now() }
    } else {
      rows[idx] = { ...rows[idx], xUsername: entry.xUsername || rows[idx].xUsername, walletAddress: entry.walletAddress || rows[idx].walletAddress, updatedAt: Date.now() }
    }
  } else {
    rows.push({ ...entry, updatedAt: Date.now() })
  }

  rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
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
      updatedAt: Number(row.updatedAt || row.updated_at || row.timestamp || Date.now()),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
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
    timestamp: Date.now(),
  }

  await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })
}

function PlayToWL() {
  const [browserId] = useState(() => getBrowserId())
  const [tiles, setTiles] = useState(() => shuffleTiles())
  const [slideMove, setSlideMove] = useState(null)
  const [hasStarted, setHasStarted] = useState(false)
  const [moves, setMoves] = useState(0)
  const [timeSec, setTimeSec] = useState(0)
  const [gameState, setGameState] = useState('playing')
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem('arcadeBestScore') || 0))
  const [qualified, setQualified] = useState(() => localStorage.getItem('arcadeQualified') === 'true')
  const [referenceImage, setReferenceImage] = useState(() => sessionReferenceImage || IMAGE_SRC)
  const [qualifiedImage, setQualifiedImage] = useState(() => localStorage.getItem(PUZZLE_QUALIFIED_IMAGE_KEY) || '')
  const [timeoutUntil, setTimeoutUntil] = useState(() => Number(localStorage.getItem(ATTEMPT_TIMEOUT_KEY) || 0))
  const [timeoutReason, setTimeoutReason] = useState(() => localStorage.getItem(ATTEMPT_TIMEOUT_REASON_KEY) || '')
  const [nowTs, setNowTs] = useState(() => Date.now())
  const [xUsername, setXUsername] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [tweetLink, setTweetLink] = useState('')
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [alreadySubmittedProof, setAlreadySubmittedProof] = useState(() => Boolean(localStorage.getItem(PUZZLE_SUBMISSION_KEY)))
  const [modal, setModal] = useState({ open: false, title: '', message: '', tone: 'info' })
  const [qualifiedScore, setQualifiedScore] = useState(() => Number(localStorage.getItem('arcadeQualifiedScore') || 0))
  const [leaderboard, setLeaderboard] = useState(() => loadLeaderboard())
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false)
  const [lastLeaderboardSync, setLastLeaderboardSync] = useState(null)
  const [activeTab, setActiveTab] = useState('game')

  const solved = useMemo(() => tiles.every((v, idx) => v === idx), [tiles])
  const score = useMemo(() => computeScore(moves, timeSec), [moves, timeSec])
  const isTimedOut = timeoutUntil > nowTs
  const timeoutLeft = Math.max(0, timeoutUntil - nowTs)
  const scoreAlertLevel = useMemo(() => {
    const activeAttempt = hasStarted && gameState === 'playing' && !isTimedOut
    if (!activeAttempt) return 'none'
    if (score < PUZZLE_TARGET_SCORE) return 'red'
    if (score <= PUZZLE_TARGET_SCORE + 100) return 'amber'
    return 'none'
  }, [hasStarted, gameState, isTimedOut, score])

  const openModal = (title, message, tone = 'info') => {
    setModal({ open: true, title, message, tone })
  }

  const closeModal = () => {
    setModal({ open: false, title: '', message: '', tone: 'info' })
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

  useEffect(() => {
    if (gameState !== 'playing') return undefined
    if (isTimedOut) return undefined
    if (!hasStarted) return undefined
    const id = setInterval(() => setTimeSec((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [gameState, isTimedOut, hasStarted])

  useEffect(() => {
    if (!isTimedOut) return undefined
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isTimedOut])

  useEffect(() => {
    if (!timeoutUntil) return
    if (Date.now() < timeoutUntil) return
    localStorage.removeItem(ATTEMPT_TIMEOUT_KEY)
    localStorage.removeItem(ATTEMPT_TIMEOUT_REASON_KEY)
    setTimeoutUntil(0)
    setTimeoutReason('')
    setNowTs(Date.now())
  }, [timeoutUntil, nowTs])

  useEffect(() => {
    if (!hasStarted) return
    if (isTimedOut) return
    if (gameState !== 'playing') return
    if (score > 0) return
    failAndTimeout('Score exhausted')
  }, [score, hasStarted, isTimedOut, gameState])

  useEffect(() => {
    if (!solved || gameState === 'won') return
    const finalScore = computeScore(moves, timeSec)
    const nextBest = Math.max(bestScore, finalScore)
    setBestScore(nextBest)
    localStorage.setItem('arcadeBestScore', String(nextBest))
    if (finalScore >= PUZZLE_TARGET_SCORE) {
      localStorage.setItem('arcadeQualified', 'true')
      localStorage.setItem('arcadeQualifiedScore', String(finalScore))
      localStorage.setItem(PUZZLE_QUALIFIED_IMAGE_KEY, referenceImage)
      setQualified(true)
      setQualifiedScore(finalScore)
      setQualifiedImage(referenceImage)
      setActiveTab('submission')
      setLeaderboard((prev) =>
        upsertLeaderboardEntry({
          browserId,
          xUsername: prev.find((row) => row.browserId === browserId)?.xUsername || `Anon-${browserId.slice(-4)}`,
          walletAddress: prev.find((row) => row.browserId === browserId)?.walletAddress || '',
          score: finalScore,
        })
      )
      openModal('Congratulations', `You reached ${finalScore} points. Submit your puzzle details.`, 'success')
    } else {
      const until = Date.now() + ATTEMPT_TIMEOUT_MS
      localStorage.setItem(ATTEMPT_TIMEOUT_KEY, String(until))
      localStorage.setItem(ATTEMPT_TIMEOUT_REASON_KEY, 'Score below target')
      setTimeoutUntil(until)
      setTimeoutReason('Score below target')
      setNowTs(Date.now())
      openModal('Score Below Target', `Final score ${finalScore}. Retry in 10 minutes.`, 'error')
    }
    setGameState('won')
  }, [solved, gameState, moves, timeSec, bestScore, referenceImage, browserId])

  useEffect(() => {
    // Keep the same qualified image after reload until proof is submitted.
    if (qualified && !alreadySubmittedProof && qualifiedImage) {
      setReferenceImage(qualifiedImage)
      sessionReferenceImage = qualifiedImage
      return undefined
    }

    if (sessionReferenceImage) {
      setReferenceImage(sessionReferenceImage)
      return undefined
    }

    let cancelled = false
    const buildReference = async () => {
      try {
        await document.fonts?.load?.('700 32px "Press Start 2P"')
      } catch {
        // Continue with fallback font if font API is unavailable.
      }
      if (cancelled) return
      const canvas = document.createElement('canvas')
      const traits = generateRandomPenguinTraits()
      drawAgent(traits, canvas, 4096)
      const dataUrl = canvas.toDataURL('image/png')
      setReferenceImage(dataUrl)
      sessionReferenceImage = dataUrl
    }
    buildReference()
    return () => {
      cancelled = true
    }
  }, [qualified, alreadySubmittedProof, qualifiedImage])

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

  const resetGame = () => {
    if (isTimedOut) return
    if (slideMove) return
    setTiles(shuffleTiles())
    setHasStarted(false)
    setMoves(0)
    setTimeSec(0)
    setGameState('playing')
  }

  const failAndTimeout = (reason) => {
    const until = Date.now() + ATTEMPT_TIMEOUT_MS
    localStorage.setItem(ATTEMPT_TIMEOUT_KEY, String(until))
    localStorage.setItem(ATTEMPT_TIMEOUT_REASON_KEY, reason)
    setTimeoutUntil(until)
    setTimeoutReason(reason)
    setNowTs(Date.now())
    setSlideMove(null)
    setGameState('playing')
    setTiles(shuffleTiles())
    setHasStarted(false)
    setMoves(0)
    setTimeSec(0)
    openModal('Attempt Locked', `${reason}. Retry in 10 minutes.`, 'error')
  }

  const handleShuffle = () => {
    if (isTimedOut) return
    if (gameState === 'playing' && (moves > 0 || timeSec > 0)) {
      failAndTimeout('Attempt not completed')
      return
    }
    resetGame()
  }

  const handleComposeTweet = async () => {
    const tweetBody = `${REQUIRED_TWEET_CAPTION}\n\n${REQUIRED_TWEET_CTA}`
    const imageSrc = qualifiedImage || referenceImage
    const composed = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetBody)}`
    if (imageSrc && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      try {
        const res = await fetch(imageSrc)
        const blob = await res.blob()
        const pngBlob = blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' })
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
        window.open(composed, '_blank')
        openModal('Image Copied', 'Puzzle image copied. Paste it into the tweet composer (Ctrl+V).', 'info')
        return
      } catch {
        // Continue with text-only compose fallback.
      }
    }

    window.open(composed, '_blank')
    openModal('Tweet Opened', 'Tweet text opened. If image is not pasted, upload your saved puzzle image manually.', 'info')
  }

  const handleSaveQualifiedImage = () => {
    const src = qualifiedImage || referenceImage
    if (!src) return
    const link = document.createElement('a')
    link.href = src
    link.download = `8bit-penguin-solved-${qualifiedScore || bestScore || Date.now()}.png`
    link.click()
  }

  const handleSubmitProof = async (event) => {
    event.preventDefault()

    if (alreadySubmittedProof) {
      openModal('Already Submitted', 'You already submitted game proof.', 'info')
      return
    }

    const normalizedX = xUsername.trim().replace(/^@+/, '')
    if (!normalizedX || normalizedX.length < 2) {
      openModal('Missing Username', 'Enter your X username.', 'error')
      return
    }

    if (!validateEvmAddress(walletAddress)) {
      openModal('Invalid Wallet', 'Enter a valid EVM wallet address.', 'error')
      return
    }

    if (!validateTweetLink(tweetLink)) {
      openModal('Invalid Tweet Link', 'Enter a valid tweet link containing your puzzle image and caption.', 'error')
      return
    }

    const submittedScore = qualifiedScore > 0 ? qualifiedScore : score

    const payload = {
      sheetName: 'Puzzle Submissions',
      eventType: 'puzzle_submission',
      xUsername: normalizedX.startsWith('@') ? normalizedX : `@${normalizedX}`,
      walletAddress: walletAddress.trim(),
      tweetLink: tweetLink.trim(),
      requiredCaption: REQUIRED_TWEET_CAPTION,
      bestScore,
      currentScore: submittedScore,
      qualified,
      imageData: qualifiedImage || referenceImage,
      timestamp: Date.now()
    }

    setIsSubmittingProof(true)
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      })

      localStorage.setItem(PUZZLE_SUBMISSION_KEY, JSON.stringify(payload))
      setAlreadySubmittedProof(true)
      const entry = {
        browserId,
        xUsername: payload.xUsername,
        walletAddress: payload.walletAddress,
        score: Number(submittedScore || 0),
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
      openModal('Submission Successful', 'Puzzle proof submitted successfully.', 'success')
    } catch {
      openModal('Submission Failed', 'Submission failed. Please try again.', 'error')
    } finally {
      setIsSubmittingProof(false)
    }
  }

  const handleTileSlide = (index) => {
    if (gameState !== 'playing') return
    if (isTimedOut) return
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
      <div className="puzzle-shell">
        <header className="puzzle-header">
          <div>
            <h1>8bit Penguins</h1>
            <p>Play-to-WL {GRID_LABEL} Puzzle Challenge. Reach {PUZZLE_TARGET_SCORE}+ to qualify.</p>
            <div className="header-links">
              <a href="https://x.com/8bitpenguin_xyz" target="_blank" rel="noopener noreferrer" className="x-btn">
                Follow us on X
              </a>
            </div>
          </div>
        </header>

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
          {qualified && (
            <button
              type="button"
              className={`puzzle-tab ${activeTab === 'submission' ? 'active' : ''}`}
              onClick={() => setActiveTab('submission')}
            >
              Submission
            </button>
          )}
        </div>

        <main className="puzzle-main">
          {activeTab === 'game' ? (
          <>
          <section className={`puzzle-board-card ${scoreAlertLevel === 'red' ? 'alert-red' : scoreAlertLevel === 'amber' ? 'alert-amber' : ''}`}>
            <div className="section-head">
              <h2>Puzzle Board</h2>
              <span className={`status-chip ${qualified ? 'ok' : ''}`}>{qualified ? 'Qualified' : 'In Progress'}</span>
            </div>
            <div className="puzzle-stats">
              <div className="stat-pill"><span>Moves</span><strong>{moves}</strong></div>
              <div className="stat-pill"><span>Time</span><strong>{timeSec}s</strong></div>
              <div className="stat-pill"><span>Score</span><strong>{score}</strong></div>
              <div className="stat-pill"><span>Target</span><strong>{PUZZLE_TARGET_SCORE}</strong></div>
            </div>
            <div className="board-qualification">
              <p>Best Score: <strong>{bestScore}</strong></p>
              {qualified && !alreadySubmittedProof && qualifiedScore > 0 && (
                <p>Qualified Score: <strong>{qualifiedScore}</strong></p>
              )}
              <p className={qualified ? 'ok' : 'pending'}>
                {qualified ? 'Qualified for submission' : 'Not qualified yet'}
              </p>
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
              {isTimedOut
                ? 'Cooldown active due to failed attempt.'
                : gameState === 'won'
                  ? 'Completed image assembled.'
                  : 'Slide tiles into the empty space to arrange the image.'}
            </p>
            <div className="puzzle-board-actions">
              <button className="puzzle-btn shuffle-btn" onClick={handleShuffle} disabled={isTimedOut}>
                {isTimedOut ? `Locked ${formatRemaining(timeoutLeft)}` : 'Shuffle'}
              </button>
            </div>
          </section>

          <aside className="puzzle-side">
            <div className="side-card">
              <h3>Reference</h3>
              <div className="reference-image medium" style={{ backgroundImage: `url(${referenceImage})` }} />
            </div>

            <div className="side-card">
              <h3>Scoring</h3>
              <p>Base 1000 points.</p>
              <p>Moves penalty ramps by tiers (5, 8, then 10 each).</p>
              <p>Time penalty ramps by tiers (1, 2, then 3 each second).</p>
              <p>Bonuses: +80 efficient solve (&lt;=30 moves), +60 fast solve (&lt;=90s).</p>
            </div>

          </aside>
          </>
          ) : activeTab === 'leaderboard' ? (
            <section className="puzzle-board-card leaderboard-tab-panel">
              <div className="section-head">
                <h2>Leaderboard</h2>
                <span className="status-chip">Global</span>
              </div>
              <p className="leaderboard-subtitle">Global Top 100 ranked by verified solved scores.</p>
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
                    <span className="leader-score">Solved Score</span>
                  </div>
                  {leaderboard.slice(0, 100).map((row, index) => (
                    <div key={`${row.browserId}-${index}`} className={`leader-row rank-${index + 1}`}>
                      <span className="leader-rank">#{index + 1}</span>
                      <span className="leader-name">{row.xUsername || `Anon-${String(row.browserId || '').slice(-4)}`}</span>
                      <span className="leader-wallet">{shortWallet(row.walletAddress)}</span>
                      <strong className="leader-score">{row.score}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="puzzle-board-card leaderboard-tab-panel">
              <div className="section-head">
                <h2>Puzzle Submission</h2>
                <span className={`status-chip ${alreadySubmittedProof ? '' : 'ok'}`}>
                  {alreadySubmittedProof ? 'Submitted' : 'Ready'}
                </span>
              </div>
              <p className="submission-lead">Qualified Score: <strong>{qualifiedScore || bestScore}</strong></p>
              <p className="submission-help">Save your solved image, post on X, then submit your proof details below.</p>
              <div className="submission-layout">
                <div className="submission-preview">
                  <div className="reference-image medium" style={{ backgroundImage: `url(${qualifiedImage || referenceImage})` }} />
                  <div className="puzzle-board-actions submission-actions">
                    <button className="puzzle-btn white" type="button" onClick={handleSaveQualifiedImage}>
                      Save Image
                    </button>
                  </div>
                  <div className="caption-card">
                    <span className="caption-label">Suggested Tweet</span>
                    <p className="caption-line">"{REQUIRED_TWEET_CAPTION}"</p>
                    <button className="puzzle-btn white caption-compose-btn" type="button" onClick={handleComposeTweet}>
                      Compose Tweet
                    </button>
                  </div>
                </div>
                <div className="submission-form-panel">
                  {alreadySubmittedProof ? (
                    <p className="proof-success">Game proof already submitted. You can still play the puzzle.</p>
                  ) : (
                    <form className="proof-form" onSubmit={handleSubmitProof}>
                      <label className="proof-label" htmlFor="submission-x-username">X Username</label>
                      <input
                        id="submission-x-username"
                        type="text"
                        placeholder="@yourusername"
                        value={xUsername}
                        onChange={(e) => setXUsername(e.target.value)}
                      />
                      <label className="proof-label" htmlFor="submission-wallet">EVM Wallet Address</label>
                      <input
                        id="submission-wallet"
                        type="text"
                        placeholder="0x..."
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                      />
                      <label className="proof-label" htmlFor="submission-tweet-link">Tweet Link</label>
                      <input
                        id="submission-tweet-link"
                        type="text"
                        placeholder="Paste tweet link containing image + caption"
                        value={tweetLink}
                        onChange={(e) => setTweetLink(e.target.value)}
                      />
                      <button className="puzzle-btn white" type="submit" disabled={isSubmittingProof}>
                        {isSubmittingProof ? 'Submitting...' : 'Submit Details'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
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
              <button className="puzzle-btn white" type="button" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayToWL
