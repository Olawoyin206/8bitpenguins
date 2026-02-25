import { useState, useEffect } from 'react'
import './Task.css'

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
      action: 'Follow @8bitpenguins',
      link: 'https://x.com/8bitpenguins',
      clicked: clickedFollow,
      setClicked: setClickedFollow,
      completed: completedTasks.follow
    },
    {
      id: 'likeRetweet',
      title: 'Like and Retweet',
      description: 'Like and retweet our pinned post to help spread the word',
      action: 'View Pinned Post',
      link: 'https://x.com/8bitpenguins/status/2025318146135961699',
      clicked: clickedLikeRetweet,
      setClicked: setClickedLikeRetweet,
      completed: completedTasks.likeRetweet
    },
    {
      id: 'quote',
      title: 'Quote the Pinned Post',
      description: 'Click to open X, quote with the message below, then paste your tweet link',
      action: 'Quote Tweet',
      link: 'https://x.com/8bitpenguins/status/2025318146135961699',
      clicked: clickedQuote,
      setClicked: setClickedQuote,
      completed: completedTasks.quote,
      requiresLink: true
    }
  ]

  const allTasksComplete = completedTasks.follow && completedTasks.likeRetweet && completedTasks.quote

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
    return /^https:\/\/(x\.com|twitter\.com|mobile\.twitter\.com)\/[\w.-]+\/status\/\d+(\?.*)?$/.test(link)
  }

  const handleLinkClick = (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      task.setClicked(true)
      setShowLinkWarning(prev => ({ ...prev, [taskId]: false }))
      
      if (taskId === 'quote') {
        const quoteText = "8bit Penguins Coming To Ethereum"
        const tweetUrl = "https://x.com/8bitpenguins/status/2025318146135961699"
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
      setTaskError(prev => ({ ...prev, [taskId]: 'Please enter a valid tweet link' }))
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
      await fetch('https://script.google.com/macros/s/AKfycbzZKMej1Jgpq9cUDATz-ZewbpbSa5os5TgJKh-hfaAUTvmGQmJ8GfXRtFOU8noiF6i-pg/exec', {
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
        <header>
          <h1>8bit Penguins</h1>
          {alreadySubmitted ? (
            <p>You have already submitted</p>
          ) : (
            <p>Complete the tasks below</p>
          )}
          <div className="header-links">
            <a href="https://x.com/8bitpenguins" target="_blank" rel="noopener noreferrer" className="x-btn">Follow us on X</a>
          </div>
        </header>

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
          <div className="tasks-list">
            {tasks.map((task) => (
              <div key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
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

              <form onSubmit={handleSubmit} className="submission-form">
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
