import { useState, useEffect, useMemo } from 'react'
import SiteNav from '../components/SiteNav.jsx'
import '../Task.css'
import {
  extractTweetMetaFromLink,
  extractTweetIdFromLink,
  getTaskPinnedPostId,
  getTaskPinnedPostLink,
  TASK_CONFIG_UPDATED_EVENT,
} from '../taskConfig.js'
import { appendAdminActivityLog } from '../adminLog.js'
import { GOOGLE_SCRIPT_URL } from '../googleScriptConfig.js'

const TASK_SUBMISSION_SHEET = 'Task Submissions'
const TWITTER_USERNAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/

function normalizeTwitterUsername(value) {
  const trimmed = String(value || '').trim().replace(/^@+/, '')
  return trimmed ? `@${trimmed}` : ''
}

function normalizeWalletAddress(value) {
  return String(value || '').trim().toLowerCase()
}

function validateTwitterUsername(value) {
  const normalized = String(value || '').trim().replace(/^@+/, '')
  return TWITTER_USERNAME_PATTERN.test(normalized)
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
      const candidate = parts[statusIndex - 1]
      const parent = parts[statusIndex - 2] || ''
      const isReservedPath = candidate.toLowerCase() === 'web' && parent.toLowerCase() === 'i'
      if (!isReservedPath && TWITTER_USERNAME_PATTERN.test(candidate || '')) {
        parts[statusIndex - 1] = candidate.toLowerCase()
      }
    }

    url.pathname = `/${parts.join('/')}`
    return url.toString()
  } catch {
    // Keep the original input when URL normalization is not possible.
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

async function fetchTaskSubmissionStatus({ tweetLink, twitterUsername = '', walletAddress = '' }) {
  const normalizedTweetLink = normalizeTweetLink(tweetLink)
  const tweetId = extractTweetIdFromLink(normalizedTweetLink)
  if (!tweetId) {
    return { ok: false, exists: false, error: 'invalid_link' }
  }

  const query = new URLSearchParams({
    action: 'task_submission_status',
    sheetName: TASK_SUBMISSION_SHEET,
    tweetId,
    tweetLink: normalizedTweetLink,
    twitterUsername: normalizeTwitterUsername(twitterUsername),
    walletAddress: normalizeWalletAddress(walletAddress),
  })

  const response = await fetch(`${GOOGLE_SCRIPT_URL}?${query.toString()}`)
  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.ok === false) {
    return {
      ok: false,
      exists: false,
      error: String(payload?.errorCode || payload?.error || 'lookup_failed'),
    }
  }

  return {
    ok: true,
    exists: Boolean(payload?.exists),
    duplicateTweet: Boolean(payload?.duplicateTweet),
    duplicateTwitterUsername: Boolean(payload?.duplicateTwitterUsername),
    duplicateWalletAddress: Boolean(payload?.duplicateWalletAddress),
    tweetId,
  }
}

function Task() {
  const [alreadySubmitted, setAlreadySubmitted] = useState(() => {
    return !!localStorage.getItem('taskSubmission')
  })
  const [clickedFollow, setClickedFollow] = useState(false)
  const [clickedLikeRetweet, setClickedLikeRetweet] = useState(false)
  const [clickedQuote, setClickedQuote] = useState(false)
  const [twitterUsername, setTwitterUsername] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [tweetLink, setTweetLink] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [completedTasks, setCompletedTasks] = useState({
    follow: false,
    likeRetweet: false,
    quote: false
  })
  const [showForm, setShowForm] = useState(false)
  const [showLinkWarning, setShowLinkWarning] = useState({})
  const [taskError, setTaskError] = useState({})
  const [tweetLinkStatus, setTweetLinkStatus] = useState(null)
  const [isCheckingTweetLink, setIsCheckingTweetLink] = useState(false)
  const [pinnedPostLink, setPinnedPostLink] = useState(() => getTaskPinnedPostLink())
  const targetTweetId = useMemo(() => getTaskPinnedPostId(pinnedPostLink), [pinnedPostLink])

  useEffect(() => {
    const syncPinnedPost = (event) => {
      const nextLink = event?.detail?.link || getTaskPinnedPostLink()
      setPinnedPostLink(nextLink)
    }

    window.addEventListener('storage', syncPinnedPost)
    window.addEventListener(TASK_CONFIG_UPDATED_EVENT, syncPinnedPost)
    return () => {
      window.removeEventListener('storage', syncPinnedPost)
      window.removeEventListener(TASK_CONFIG_UPDATED_EVENT, syncPinnedPost)
    }
  }, [])

  useEffect(() => {
    if (alreadySubmitted) {
      setIsSubmitted(true)
    }
  }, [alreadySubmitted])

  const tasks = [
    {
      id: 'follow',
      title: 'Follow Us on X',
      description: 'Follow our official account to stay updated',
      action: 'Follow @8bitspenguins_',
      link: 'https://x.com/8bitspenguins_',
      clicked: clickedFollow,
      setClicked: setClickedFollow,
      completed: completedTasks.follow
    },
    {
      id: 'likeRetweet',
      title: 'Like and Retweet',
      description: 'Like and retweet our pinned post to help spread the word',
      action: 'View Pinned Post',
      link: pinnedPostLink,
      clicked: clickedLikeRetweet,
      setClicked: setClickedLikeRetweet,
      completed: completedTasks.likeRetweet
    },
    {
      id: 'quote',
      title: 'Quote the Pinned Post',
      description: 'Click to open X, quote with the message below, then paste your tweet link',
      action: 'Quote Tweet',
      link: pinnedPostLink,
      clicked: clickedQuote,
      setClicked: setClickedQuote,
      completed: completedTasks.quote,
      requiresLink: true
    }
  ]

  const allTasksComplete = completedTasks.follow && completedTasks.likeRetweet && completedTasks.quote
  const completedCount = Object.values(completedTasks).filter(Boolean).length
  const totalTasks = tasks.length

  useEffect(() => {
    if (!submitStatus?.message) return
    appendAdminActivityLog({
      level: submitStatus.type || 'info',
      source: 'task',
      message: submitStatus.message,
    }).catch(() => {})
  }, [submitStatus])

  useEffect(() => {
    if (!tweetLinkStatus?.message || !['error', 'warning', 'success'].includes(tweetLinkStatus.type)) return
    appendAdminActivityLog({
      level: tweetLinkStatus.type,
      source: 'task',
      message: tweetLinkStatus.message,
    }).catch(() => {})
  }, [tweetLinkStatus])

  useEffect(() => {
    if (allTasksComplete) {
      const timer = setTimeout(() => setShowForm(true), 500)
      return () => clearTimeout(timer)
    } else {
      setShowForm(false)
    }
  }, [allTasksComplete])

  const validateEvmAddress = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const validateTweetLink = (link) => {
    const { tweetId } = extractTweetMetaFromLink(link)
    if (!tweetId) return false
    return tweetId !== targetTweetId
  }

  const handleLinkClick = (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      task.setClicked(true)
      setShowLinkWarning(prev => ({ ...prev, [taskId]: false }))

      if (taskId === 'quote') {
        const quoteText = '8bit Penguins Coming To Ethereum'
        const tweetUrl = pinnedPostLink
        const composeUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(quoteText)}&url=${encodeURIComponent(tweetUrl)}`
        window.open(composeUrl, '_blank')
      }
    }
  }

  const handleVerify = async (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (!task.clicked) {
      setTaskError(prev => ({ ...prev, [taskId]: 'Complete task' }))
      return
    }

    if (task.requiresLink && !tweetLink.trim()) {
      setTaskError(prev => ({ ...prev, [taskId]: 'Please submit your tweet link' }))
      return
    }

    if (task.requiresLink && !validateTweetLink(tweetLink)) {
      setTaskError(prev => ({ ...prev, [taskId]: 'Enter a valid quote-tweet link, not the original post link' }))
      setTweetLinkStatus(null)
      return
    }

    if (task.requiresLink && !twitterUsername.trim()) {
      setTaskError(prev => ({ ...prev, [taskId]: 'Enter your X username before verifying the quote link' }))
      setTweetLinkStatus(null)
      return
    }

    if (task.requiresLink && !validateTwitterUsername(twitterUsername)) {
      setTaskError(prev => ({ ...prev, [taskId]: 'Enter a valid X username before verifying the quote link' }))
      setTweetLinkStatus(null)
      return
    }

    if (task.requiresLink) {
      const normalizedTwitterUsername = normalizeTwitterUsername(twitterUsername)
      const normalizedTweetLink = normalizeTweetLink(tweetLink)
      setIsCheckingTweetLink(true)
      setTweetLinkStatus({ type: 'info', message: 'Checking submitted X link...' })

      try {
        const liveTweet = await verifyLiveTweetLink(normalizedTweetLink)
        if (!liveTweet.ok) {
          setTaskError(prev => ({ ...prev, [taskId]: null }))
          setTweetLinkStatus({ type: 'error', message: 'This X link could not be verified as a live post.' })
          return
        }

        const { username: linkUsername } = extractTweetMetaFromLink(normalizedTweetLink)
        if (!usernamesMatch(linkUsername, normalizedTwitterUsername)) {
          setTaskError(prev => ({ ...prev, [taskId]: null }))
          setTweetLinkStatus({
            type: 'error',
            message: 'The X username in the quote link does not match your entered username.',
          })
          return
        }

        if (!usernamesMatch(liveTweet.authorUsername, normalizedTwitterUsername)) {
          setTaskError(prev => ({ ...prev, [taskId]: null }))
          setTweetLinkStatus({
            type: 'error',
            message: 'The verified X author on this link does not match your entered username.',
          })
          return
        }

        const status = await fetchTaskSubmissionStatus({ tweetLink: normalizedTweetLink })
        if (status.ok && status.duplicateTweet) {
          setTaskError(prev => ({ ...prev, [taskId]: null }))
          setTweetLinkStatus({ type: 'error', message: 'This X link has already been submitted.' })
          return
        }

        if (status.ok) {
          setTweetLinkStatus({ type: 'success', message: 'X link was verified as a live post and has not been submitted.' })
        } else {
          setTweetLinkStatus({ type: 'warning', message: 'Could not verify duplicate X links right now. Final submit will still enforce checks.' })
          return
        }
      } catch {
        setTweetLinkStatus({ type: 'error', message: 'Could not verify this X link right now. Please try again.' })
        return
      } finally {
        setIsCheckingTweetLink(false)
      }
    }

    setTaskError(prev => ({ ...prev, [taskId]: null }))
    setCompletedTasks(prev => ({ ...prev, [taskId]: true }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!twitterUsername.trim()) {
      setSubmitStatus({ type: 'error', message: 'Please enter your Twitter username' })
      return
    }

    if (!validateTwitterUsername(twitterUsername)) {
      setSubmitStatus({ type: 'error', message: 'Enter a valid X username using only letters, numbers, and underscores' })
      return
    }

    if (!validateEvmAddress(walletAddress)) {
      setSubmitStatus({ type: 'error', message: 'Please enter a valid EVM wallet address' })
      return
    }

    if (!validateTweetLink(tweetLink)) {
      setSubmitStatus({ type: 'error', message: 'Please enter a valid quote-tweet link before submitting' })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)

    const normalizedTwitterUsername = normalizeTwitterUsername(twitterUsername)
    const normalizedWalletAddress = normalizeWalletAddress(walletAddress)
    const normalizedTweetLink = normalizeTweetLink(tweetLink)
    const { tweetId: extractedTweetId, username: linkUsername } = extractTweetMetaFromLink(normalizedTweetLink)

    if (!extractedTweetId) {
      setSubmitStatus({ type: 'error', message: 'Only direct X status links with a tweet ID are allowed' })
      setIsSubmitting(false)
      return
    }

    try {
      const liveTweet = await verifyLiveTweetLink(normalizedTweetLink)
      if (!liveTweet.ok) {
        setSubmitStatus({ type: 'error', message: 'This X link could not be verified as a live post' })
        setTweetLinkStatus({ type: 'error', message: 'This X link could not be verified as a live post.' })
        setIsSubmitting(false)
        return
      }

      if (!usernamesMatch(linkUsername, normalizedTwitterUsername)) {
        setSubmitStatus({
          type: 'error',
          message: `The X username in the quote link does not match ${normalizedTwitterUsername}`,
        })
        setTweetLinkStatus({
          type: 'error',
          message: 'The X username in the quote link does not match the submitted username.',
        })
        setIsSubmitting(false)
        return
      }

      if (!usernamesMatch(liveTweet.authorUsername, normalizedTwitterUsername)) {
        setSubmitStatus({
          type: 'error',
          message: `The verified X author does not match ${normalizedTwitterUsername}`,
        })
        setTweetLinkStatus({
          type: 'error',
          message: 'The verified X author on this link does not match the submitted username.',
        })
        setIsSubmitting(false)
        return
      }
    } catch {
      setSubmitStatus({ type: 'error', message: 'Could not verify this X link live. Please try again.' })
      setTweetLinkStatus({ type: 'error', message: 'Could not verify this X link live. Please try again.' })
      setIsSubmitting(false)
      return
    }

    try {
      const linkStatus = await fetchTaskSubmissionStatus({
        tweetLink: normalizedTweetLink,
        twitterUsername: normalizedTwitterUsername,
        walletAddress: normalizedWalletAddress,
      })
      if (linkStatus.ok && linkStatus.duplicateTweet) {
        setSubmitStatus({ type: 'error', message: 'This X link has already been submitted' })
        setTweetLinkStatus({ type: 'error', message: 'This X link has already been submitted.' })
        setIsSubmitting(false)
        return
      }
      if (linkStatus.ok && linkStatus.duplicateTwitterUsername) {
        setSubmitStatus({ type: 'error', message: 'This X username has already been submitted' })
        setIsSubmitting(false)
        return
      }
      if (linkStatus.ok && linkStatus.duplicateWalletAddress) {
        setSubmitStatus({ type: 'error', message: 'This wallet address has already been submitted' })
        setIsSubmitting(false)
        return
      }
    } catch {
      // Final POST still performs the authoritative duplicate check when the Apps Script supports it.
    }

    const submission = {
      twitterUsername: normalizedTwitterUsername,
      walletAddress: normalizedWalletAddress,
      tweetLink: normalizedTweetLink,
      tweetId: extractedTweetId,
      timestamp: Date.now()
    }

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(submission)
      })
      const payload = await response.json().catch(() => null)

      const errorCode = String(payload?.errorCode || payload?.error || '').toLowerCase()
      const duplicateTweet =
        errorCode.includes('duplicate_tweet_id') ||
        errorCode.includes('duplicate_tweet_link') ||
        errorCode.includes('tweet already submitted')
      const duplicateTwitterUsername =
        errorCode.includes('duplicate_twitter_username') ||
        errorCode.includes('duplicate_x_username') ||
        errorCode.includes('username already submitted')
      const duplicateWalletAddress =
        errorCode.includes('duplicate_wallet_address') ||
        errorCode.includes('duplicate_wallet') ||
        errorCode.includes('wallet already submitted')

      if (!response.ok || payload?.ok === false) {
        if (duplicateTweet) {
          setSubmitStatus({ type: 'error', message: 'This X link has already been submitted' })
          setTweetLinkStatus({ type: 'error', message: 'This X link has already been submitted.' })
          setIsSubmitting(false)
          return
        }
        if (duplicateTwitterUsername) {
          setSubmitStatus({ type: 'error', message: 'This X username has already been submitted' })
          setIsSubmitting(false)
          return
        }
        if (duplicateWalletAddress) {
          setSubmitStatus({ type: 'error', message: 'This wallet address has already been submitted' })
          setIsSubmitting(false)
          return
        }

        throw new Error(String(payload?.error || `HTTP ${response.status}`))
      }
    } catch {
      console.log('Sheet sync skipped')
      setSubmitStatus({ type: 'error', message: 'Could not submit right now. Please try again.' })
      setIsSubmitting(false)
      return
    }

    localStorage.setItem('taskSubmission', JSON.stringify(submission))

    await new Promise(resolve => setTimeout(resolve, 1000))

    setIsSubmitted(true)
    setAlreadySubmitted(true)
    setSubmitStatus({ type: 'success', message: 'Submission successful!' })
    setTwitterUsername('')
    setWalletAddress('')
    setTweetLink('')
    setTweetLinkStatus(null)
    setIsSubmitting(false)
  }

  return (
    <div className="task-page">
      <div className="task-container">
        <SiteNav label={alreadySubmitted ? 'Already Submitted' : 'Whitelist Tasks'} />

        {alreadySubmitted ? (
          <div className="form-section show">
            <div className="unlock-message already-submitted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3>Already Submitted</h3>
              <p>We only allow one submission per user</p>
            </div>
          </div>
        ) : (
          <>
            <main>
              {!allTasksComplete && (
                <div className="task-progress">
                  <div className="task-progress-head">
                    <h2>Whitelist Tasks</h2>
                    <span>{completedCount}/{totalTasks} Completed</span>
                  </div>
                  <div className="task-progress-track">
                    <div className="task-progress-fill" style={{ width: `${(completedCount / totalTasks) * 100}%` }} />
                  </div>
                </div>
              )}

              {!allTasksComplete && (
                <div className="tasks-list">
                  {tasks.map((task, index) => (
                    <div key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
                      <div className="task-top">
                        <span className="task-step">Task {index + 1}</span>
                        <span className={`task-state ${task.completed ? 'done' : task.clicked ? 'opened' : 'pending'}`}>
                          {task.completed ? 'Done' : task.clicked ? 'Opened' : 'Pending'}
                        </span>
                      </div>
                      <div className="task-info">
                        <h3>{task.title}</h3>
                        <p>{task.description}</p>
                      </div>

                      <div className="task-action">
                        {task.completed ? (
                          <span className="completed-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Done
                          </span>
                        ) : (
                          <>
                            <a
                              href={task.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`task-btn ${task.clicked && !task.completed ? 'clicked' : ''}`}
                              onClick={(e) => {
                                e.preventDefault()
                                window.open(task.link, '_blank')
                                handleLinkClick(task.id)
                              }}
                            >
                              {task.clicked && !task.completed ? 'Opened - Click Verify' : task.action}
                            </a>
                            {!task.requiresLink && (
                              <button
                                className="verify-btn"
                                onClick={() => handleVerify(task.id)}
                              >
                                Verify
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {task.requiresLink && !task.completed && (
                        <div className="tweet-link-input">
                          <div className="tweet-link-field">
                            <label htmlFor="quote-twitter-username">X Username</label>
                            <input
                              id="quote-twitter-username"
                              type="text"
                              placeholder="@username"
                              value={twitterUsername}
                              onChange={(e) => {
                                setTwitterUsername(e.target.value)
                                setTweetLinkStatus(null)
                                setTaskError(prev => ({ ...prev, quote: null }))
                              }}
                            />
                          </div>
                          <div className="quote-instruction">
                            <span>Quote with: <strong>"8bit Penguins Coming To Ethereum"</strong></span>
                          </div>
                          <div className="tweet-link-field">
                            <label htmlFor="quote-tweet-link">Quote Tweet Link</label>
                            <input
                              id="quote-tweet-link"
                              type="text"
                              placeholder="Paste your quote tweet link here"
                              value={tweetLink}
                              onChange={(e) => {
                                setTweetLink(e.target.value)
                                setTweetLinkStatus(null)
                                setTaskError(prev => ({ ...prev, quote: null }))
                              }}
                            />
                          </div>
                          <button
                            className="verify-btn"
                            onClick={() => handleVerify(task.id)}
                            disabled={isCheckingTweetLink}
                            aria-busy={isCheckingTweetLink}
                          >
                            {isCheckingTweetLink ? 'Checking...' : 'Verify'}
                          </button>
                          {tweetLinkStatus && (
                            <div className={`tweet-link-status ${tweetLinkStatus.type}`}>
                              {tweetLinkStatus.message}
                            </div>
                          )}
                        </div>
                      )}

                      {showLinkWarning[task.id] && (
                        <div className="link-warning">
                          Please click the link first to complete this task
                        </div>
                      )}

                      {taskError[task.id] && (
                        <div className="link-warning">
                          {taskError[task.id]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {allTasksComplete && !isSubmitted && (
                <div className={`form-section ${showForm ? 'show' : ''}`}>
                  <div className="unlock-message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <h3>All Tasks Complete!</h3>
                    <p>Enter your details below to continue</p>
                  </div>

                  <div className="task-submit-layout">
                    <aside className="task-submit-panel task-submit-summary">
                      <h4>Submission Checklist</h4>
                      <p>Your X username was captured and verified during the quote-tweet step.</p>
                      <p>Enter the wallet you want reviewed for whitelist access.</p>
                      <p>Wallet must be a valid EVM address starting with <strong>0x</strong>.</p>
                      <p>One submission is allowed per X username, wallet, and quote link.</p>
                    </aside>

                    <form onSubmit={handleSubmit} className="submission-form task-submit-panel">
                      <div className="form-group">
                        <label htmlFor="wallet">EVM Wallet Address</label>
                        <input
                          type="text"
                          id="wallet"
                          value={walletAddress}
                          onChange={(e) => setWalletAddress(e.target.value)}
                          placeholder="0x..."
                        />
                        <span className="hint">Supports Ethereum, Polygon, BSC, and other EVM chains</span>
                      </div>

                      <button
                        type="submit"
                        className="submit-btn"
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit & Continue'}
                      </button>

                      {submitStatus && (
                        <div className={`submit-status ${submitStatus.type}`}>
                          {submitStatus.message}
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              )}

              {isSubmitted && (
                <div className="form-section show">
                  <div className="unlock-message">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <h3>Submission Successful!</h3>
                    <p>Thank you for completing all tasks</p>
                  </div>
                </div>
              )}
            </main>
          </>
        )}
      </div>
    </div>
  )
}

export default Task
