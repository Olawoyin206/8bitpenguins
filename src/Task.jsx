import { useState, useEffect, useMemo } from 'react'
import SiteNav from './SiteNav.jsx'
import './Task.css'
import {
  extractTweetIdFromLink,
  getTaskPinnedPostId,
  getTaskPinnedPostLink,
  TASK_CONFIG_UPDATED_EVENT,
} from './taskConfig.js'

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzkipcZmhdUrpFNJkJ6y4tctkHwKlhG8tEgH2f20syjAx_TD8JML6xiNxSHmQcMTo6h/exec'
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

async function fetchTaskSubmissionStatus({ tweetLink, twitterUsername = '', walletAddress = '' }) {
  const tweetId = extractTweetIdFromLink(tweetLink)
  if (!tweetId) {
    return { ok: false, exists: false, error: 'invalid_link' }
  }

  const query = new URLSearchParams({
    action: 'task_submission_status',
    sheetName: TASK_SUBMISSION_SHEET,
    tweetId,
    tweetLink: String(tweetLink || '').trim(),
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
      action: 'Follow @8bitpenguin_xyz',
      link: 'https://x.com/8bitpenguin_xyz',
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
    const tweetId = extractTweetIdFromLink(link)
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

    if (task.requiresLink) {
      setIsCheckingTweetLink(true)
      setTweetLinkStatus({ type: 'info', message: 'Checking submitted X link...' })

      try {
        const status = await fetchTaskSubmissionStatus({ tweetLink })
        if (status.ok && status.duplicateTweet) {
          setTaskError(prev => ({ ...prev, [taskId]: 'This X link has already been submitted' }))
          setTweetLinkStatus({ type: 'error', message: 'This X link has already been submitted.' })
          return
        }

        if (status.ok) {
          setTweetLinkStatus({ type: 'success', message: 'X link contains a valid tweet ID and has not been submitted.' })
        } else {
          setTweetLinkStatus({ type: 'warning', message: 'Could not verify duplicate X links right now. Final submit will still enforce checks.' })
        }
      } catch {
        setTweetLinkStatus({ type: 'warning', message: 'Could not verify duplicate X links right now. Final submit will still enforce checks.' })
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
    const extractedTweetId = extractTweetIdFromLink(tweetLink)

    if (!extractedTweetId) {
      setSubmitStatus({ type: 'error', message: 'Only direct X status links with a tweet ID are allowed' })
      setIsSubmitting(false)
      return
    }

    try {
      const linkStatus = await fetchTaskSubmissionStatus({
        tweetLink,
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
      tweetLink: String(tweetLink || '').trim(),
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
                          <div className="quote-instruction">
                            <span>Quote with: <strong>"8bit Penguins Coming To Ethereum"</strong></span>
                          </div>
                          <input
                            type="text"
                            placeholder="Paste your quote tweet link here"
                            value={tweetLink}
                            onChange={(e) => {
                              setTweetLink(e.target.value)
                              setTweetLinkStatus(null)
                              setTaskError(prev => ({ ...prev, quote: null }))
                            }}
                          />
                          <button
                            className="verify-btn"
                            onClick={() => handleVerify(task.id)}
                            disabled={isCheckingTweetLink}
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
                      <p>Use your correct X handle.</p>
                      <p>Wallet must be a valid EVM address starting with <strong>0x</strong>.</p>
                      <p>One submission per user is allowed.</p>
                      <p>All submitted details will be verified before whitelist approval.</p>
                    </aside>

                    <form onSubmit={handleSubmit} className="submission-form task-submit-panel">
                      <div className="form-group">
                        <label htmlFor="twitter">Twitter Username</label>
                        <input
                          type="text"
                          id="twitter"
                          value={twitterUsername}
                          onChange={(e) => setTwitterUsername(e.target.value)}
                          placeholder="@username"
                        />
                      </div>

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
