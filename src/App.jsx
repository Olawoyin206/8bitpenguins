import { useState, useEffect, useRef } from 'react'
import {
  generateRandomPenguinTraits,
  renderPenguin4k,
} from './penguin2d.js'
import SiteNav from './SiteNav.jsx'
import './App.css'

const GENERATE_RENDER_OPTIONS = {
  logicalSize: 40,
  offsetX: 0,
  offsetY: 0,
  spriteScale: 0.75,
  outline: true,
  innerOutline: true,
  outerOutline: false,
}
const PREVIEW_CANVAS_SIZE = 320
const GENERATE_ANIMATION_LEAD_MS = 800

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function App() {
  const [traits, setTraits] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [confetti, setConfetti] = useState([])
  const [hasGenerated, setHasGenerated] = useState(false)
  const [idleMatrix] = useState(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      chars: Array.from({ length: 25 }).map(() => (Math.random() > 0.5 ? '1' : '0')).join(''),
    }))
  )
  const [cooldown, setCooldown] = useState(0)
  const canvasRef = useRef(null)

  const triggerConfetti = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C00', '#39FF14', '#FF1493']
    const newConfetti = Array.from({ length: 40 }, (_, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      left: 2 + Math.random() * 96,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.25,
      size: 6 + Math.random() * 8,
    }))
    setConfetti(newConfetti)
    setTimeout(() => setConfetti([]), 1200)
  }

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  const generate = async () => {
    if (cooldown > 0) return
    setIsGenerating(true)
    setIsRevealing(false)
    setConfetti([])
    setHasGenerated(false)
    setCooldown(10)

    try {
      // Let the loading matrix animate briefly before rendering the next penguin.
      await wait(GENERATE_ANIMATION_LEAD_MS)
      const nextTraits = generateRandomPenguinTraits()
      const previewSource = renderPenguin4k(nextTraits, GENERATE_RENDER_OPTIONS)
      const previewCanvas = canvasRef.current
      const ctx = previewCanvas?.getContext('2d')
      if (!previewCanvas || !ctx) {
        throw new Error('Preview canvas is not available')
      }
      previewCanvas.width = PREVIEW_CANVAS_SIZE
      previewCanvas.height = PREVIEW_CANVAS_SIZE
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, PREVIEW_CANVAS_SIZE, PREVIEW_CANVAS_SIZE)
      ctx.drawImage(previewSource, 0, 0, PREVIEW_CANVAS_SIZE, PREVIEW_CANVAS_SIZE)

      setTraits(nextTraits)
      setHasGenerated(true)
      setIsRevealing(true)
      triggerConfetti()
    } catch (err) {
      console.error('Generate failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const effectName = (traitSet) => {
    if (!traitSet) return 'None'
    if (traitSet.effect?.name === 'None') return 'None'
    const variant = traitSet.effect?.variant || 'White'
    if (traitSet.effect?.name) return `${traitSet.effect.name} (${variant})`
    if (traitSet.background?.fx === 'snowflakes') return `Snow (${variant})`
    if (traitSet.background?.fx === 'softdots') return `Stone (${variant})`
    return 'None'
  }

  const hasEffect = (traitSet) => effectName(traitSet) !== 'None'

  const save = () => {
    if (!traits) return

    void (async () => {
      try {
        const highResCanvas = renderPenguin4k(traits, GENERATE_RENDER_OPTIONS)

        const link = document.createElement('a')
        link.download = 'penguin-4k.png'
        link.href = highResCanvas.toDataURL('image/png')
        link.click()
      } catch (error) {
        console.error('Save failed:', error)
      }
    })()
  }

  const tweetGeneratedPenguin = () => {
    if (!traits) return

    const tweetBody = `I just generated an @8bitspenguins_ art.\n\nGenerate yours now:\nhttps://8bitpenguins.xyz/generate`
    const composeUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetBody)}`

    if (typeof window !== 'undefined') {
      window.open(composeUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const showMatrix = isGenerating || !hasGenerated

  return (
    <div className="app-page app generator-page">
      <SiteNav label="Generator" />

      <main>
        <div className="preview">
          <div className={`canvas-wrap ${isGenerating ? 'generating' : ''} ${isRevealing ? 'reveal' : ''} ${!hasGenerated ? 'matrix-idle' : ''}`}>
            <canvas ref={canvasRef} style={{ opacity: hasGenerated ? 1 : 0 }} />
            {showMatrix && (
              <div className="matrix-rain">
                {idleMatrix.map((col) => (
                  <div
                    key={col.id}
                    className="matrix-column"
                    data-chars={col.chars}
                    style={{
                      animationName: 'matrix-fall',
                      animationTimingFunction: 'linear',
                      animationIterationCount: 'infinite',
                      animationDuration: isGenerating ? `${0.3 + Math.random() * 0.4}s` : `${3.8 + Math.random() * 2.6}s`,
                      animationDelay: isGenerating ? `${Math.random() * 0.3}s` : `${Math.random() * 1.2}s`,
                    }}
                  >
                    {col.chars}
                  </div>
                ))}
              </div>
            )}
            {confetti.length > 0 && (
              <div className="confetti">
                {confetti.map((piece) => (
                  <div
                    key={piece.id}
                    className="confetti-piece"
                    style={{
                      left: `${piece.left}%`,
                      backgroundColor: piece.color,
                      animationDelay: `${piece.delay}s`,
                      width: piece.size,
                      height: piece.size,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="btns">
            <button className="btn white" onClick={generate} disabled={isGenerating || cooldown > 0} aria-busy={isGenerating}>
              {isGenerating ? 'Generating' : cooldown > 0 ? `Wait ${cooldown}s` : 'Generate'}
            </button>
            <button className="btn" onClick={save} disabled={!traits}>Save</button>
            <button className="btn white" onClick={tweetGeneratedPenguin} disabled={!traits}>Tweet</button>
          </div>
        </div>

        <div className="traits">
          <h2>Traits</h2>
          {traits ? (
            <ul>
              <li><span>Background</span><span>{traits.background.name}</span></li>
              {hasEffect(traits) && <li><span>Effect</span><span>{effectName(traits)}</span></li>}
              <li><span>Body</span><span>{traits.body.name}</span></li>
              <li><span>Belly</span><span>{traits.belly.name}</span></li>
              <li><span>Beak</span><span>{traits.beak.name}</span></li>
              <li><span>Eyes</span><span>{traits.eyes.name}</span></li>
              <li><span>Head</span><span>{traits.head.name}</span></li>
              <li><span>Name</span><span>{traits.name?.name}</span></li>
            </ul>
          ) : <p className="empty">-</p>}
        </div>
      </main>
    </div>
  )
}

export default App
