import { useState, useEffect, useMemo } from 'react'
import SiteNav from './SiteNav.jsx'
import './Task.css'
import { getTaskPinnedPostId, getTaskPinnedPostLink, TASK_CONFIG_UPDATED_EVENT } from './taskConfig.js'

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
    const match = link.trim().match(
      /^https:\/\/(x\.com|twitter\.com|mobile\.twitter\.com)\/([\w.-]+)\/status\/(\d+)(\?.*)?$/
    )

    if (!match) return false

    const tweetId = match[3]
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

  const handleVerify = (taskId) => {
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
      return
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

    if (!validateEvmAddress(walletAddress)) {
      setSubmitStatus({ type: 'error', message: 'Please enter a valid EVM wallet address' })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)

    const submission = {
      twitterUsername: twitterUsername.startsWith('@') ? twitterUsername : `@${twitterUsername}`,
      walletAddress,
      tweetLink,
      timestamp: Date.now()
    }

    localStorage.setItem('taskSubmission', JSON.stringify(submission))

    try {
      await fetch('https://script.google.com/macros/s/AKfycbwBo9wDhr2DYdQSsmhvek2JnY4oo_MYa9FV-WrgzDJ4BctN3IAv3PQvUvZ0QlmZPd0/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(submission)
      })
    } catch (err) {
      console.log('Sheet sync skipped')
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    setIsSubmitted(true)
    setSubmitStatus({ type: 'success', message: 'Submission successful!' })
    setTwitterUsername('')
    setWalletAddress('')
    setTweetLink('')
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
                            onChange={(e) => setTweetLink(e.target.value)}
                          />
                          <button
                            className="verify-btn"
                            onClick={() => handleVerify(task.id)}
                          >
                            Verify
                          </button>
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
