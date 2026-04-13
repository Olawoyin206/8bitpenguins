import { useEffect, useRef } from 'react'

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let turnstileLoader = null

function loadTurnstile() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile unavailable during server render'))
  }

  if (window.turnstile?.render) {
    return Promise.resolve(window.turnstile)
  }

  if (turnstileLoader) {
    return turnstileLoader
  }

  turnstileLoader = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.turnstile?.render) {
        resolve(window.turnstile)
        return
      }
      reject(new Error('Turnstile did not initialize'))
    }

    const fail = () => reject(new Error('Failed to load Turnstile'))
    const existing = document.querySelector('script[data-turnstile-script="true"]')

    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', fail, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.setAttribute('data-turnstile-script', 'true')
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', fail, { once: true })
    document.head.appendChild(script)
  }).catch((error) => {
    turnstileLoader = null
    throw error
  })

  return turnstileLoader
}

export default function TurnstileWidget({
  siteKey,
  action,
  resetKey = 0,
  onTokenChange,
  onStatusChange,
}) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    if (!siteKey) {
      onTokenChange?.('')
      onStatusChange?.('Captcha is not configured right now.')
      return undefined
    }

    let cancelled = false
    onTokenChange?.('')
    onStatusChange?.('')

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: 'dark',
          size: 'flexible',
          callback(token) {
            if (cancelled) return
            onTokenChange?.(String(token || ''))
            onStatusChange?.('')
          },
          'expired-callback'() {
            if (cancelled) return
            onTokenChange?.('')
            onStatusChange?.('Captcha expired. Complete it again.')
          },
          'error-callback'() {
            if (cancelled) return
            onTokenChange?.('')
            onStatusChange?.('Captcha failed to load. Retry in a moment.')
          },
          'timeout-callback'() {
            if (cancelled) return
            onTokenChange?.('')
            onStatusChange?.('Captcha timed out. Complete it again.')
          },
        })
      })
      .catch(() => {
        if (cancelled) return
        onTokenChange?.('')
        onStatusChange?.('Captcha failed to load. Retry in a moment.')
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // Ignore cleanup failures from the external widget.
        }
      }
      widgetIdRef.current = null
    }
  }, [action, onStatusChange, onTokenChange, siteKey])

  useEffect(() => {
    if (widgetIdRef.current === null || !window.turnstile?.reset) return
    try {
      window.turnstile.reset(widgetIdRef.current)
    } catch {
      // Ignore reset failures and let the widget recover naturally.
    }
  }, [resetKey])

  return <div ref={containerRef} className="turnstile-widget" />
}
