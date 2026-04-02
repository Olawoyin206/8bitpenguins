import { useEffect, useMemo, useRef, useState } from 'react'
import {
  copyCanvasToPreview,
  renderPenguin4k,
} from './penguin2d.js'
import { renderMintTrueSvg, renderPenguinSVG } from './penguinSvg.js'
import { generateMintPenguinTraits } from './mintTraits.js'
import { renderOnchainMintSvgFromTraits } from './onchainRenderer.js'
import SiteNav from './SiteNav.jsx'
import './App.css'

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function toBase64DataUri(svgMarkup) {
  if (!svgMarkup) return ''
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`
}

function SvgGenerator() {
  const [traits, setTraits] = useState(null)
  const [svgMarkup, setSvgMarkup] = useState('')
  const [structuredSvgMarkup, setStructuredSvgMarkup] = useState('')
  const [mintSvgMarkup, setMintSvgMarkup] = useState('')
  const [mintSvgSource, setMintSvgSource] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('SVG test page ready')
  const [cooldown, setCooldown] = useState(0)
  const [hasGenerated, setHasGenerated] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const svgDataUrl = useMemo(() => {
    if (!svgMarkup) return ''
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`
  }, [svgMarkup])

  const structuredSvgDataUrl = useMemo(() => {
    if (!structuredSvgMarkup) return ''
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(structuredSvgMarkup)}`
  }, [structuredSvgMarkup])

  const mintSvgDataUrl = useMemo(() => {
    if (!mintSvgMarkup) return ''
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mintSvgMarkup)}`
  }, [mintSvgMarkup])

  const tracedSvgSize = useMemo(() => new Blob([svgMarkup || '']).size, [svgMarkup])
  const structuredSvgSize = useMemo(() => new Blob([structuredSvgMarkup || '']).size, [structuredSvgMarkup])
  const mintSvgSize = useMemo(() => new Blob([mintSvgMarkup || '']).size, [mintSvgMarkup])
  const mintSvgDataUri = useMemo(() => toBase64DataUri(mintSvgMarkup), [mintSvgMarkup])
  const mintSvgDataUriSize = useMemo(() => new Blob([mintSvgDataUri || '']).size, [mintSvgDataUri])

  const generate = () => {
    if (isGenerating || cooldown > 0) return
    setIsGenerating(true)
    setCooldown(4)
    setStatus('Building PNG + local SVG + live onchain mint SVG')
    setHasGenerated(false)
    setMintSvgSource('')

    setTimeout(async () => {
      try {
        const nextTraits = generateMintPenguinTraits()
        const highResCanvas = renderPenguin4k(nextTraits)
        copyCanvasToPreview(highResCanvas, canvasRef.current)
        const svg = renderPenguinSVG(nextTraits, { outputSize: 400 })
        const localMintSvg = renderMintTrueSvg(nextTraits)
        let mintMatchedTrueSvg = localMintSvg
        let nextStatus = 'PNG, traced SVG, local true SVG, and live onchain mint SVG are ready'
        let nextMintSvgSource = 'onchain'

        try {
          mintMatchedTrueSvg = await renderOnchainMintSvgFromTraits(nextTraits)
        } catch (error) {
          console.warn('Falling back to local mint SVG preview:', error)
          nextStatus = 'Live onchain renderer unavailable. Mint preview is using the local fallback.'
          nextMintSvgSource = 'fallback'
        }

        setTraits(nextTraits)
        setSvgMarkup(svg)
        setStructuredSvgMarkup(localMintSvg)
        setMintSvgMarkup(mintMatchedTrueSvg)
        setMintSvgSource(nextMintSvgSource)
        setHasGenerated(true)
        setStatus(nextStatus)
      } catch (error) {
        console.error('SVG generator failed:', error)
        setStatus('SVG generator failed')
      } finally {
        setIsGenerating(false)
      }
    }, 250)
  }

  const saveSvg = () => {
    if (!svgMarkup || !traits) return
    downloadTextFile(
      `penguin-${traits?.name?.name?.toLowerCase?.() || 'svg'}.svg`,
      svgMarkup,
      'image/svg+xml;charset=utf-8'
    )
    setStatus('SVG downloaded')
  }

  const saveStructuredSvg = () => {
    if (!structuredSvgMarkup || !traits) return
    downloadTextFile(
      `penguin-${traits?.name?.name?.toLowerCase?.() || 'svg'}-true.svg`,
      structuredSvgMarkup,
      'image/svg+xml;charset=utf-8'
    )
    setStatus('True SVG downloaded')
  }

  const saveMintSvg = () => {
    if (!mintSvgMarkup || !traits) return
    downloadTextFile(
      `penguin-${traits?.name?.name?.toLowerCase?.() || 'svg'}-mint.svg`,
      mintSvgMarkup,
      'image/svg+xml;charset=utf-8'
    )
    setStatus('Mint SVG downloaded')
  }

  return (
    <div className="app-page app generator-page svg-generator-page">
      <SiteNav label="SVG Generator" />

      <main>
        <div className="preview svg-generator-preview">
          <div className="tabs">
            <button className="tab active" type="button">
              SVG Match Test
            </button>
          </div>

          <div className="svg-preview-grid">
            <div className="svg-preview-panel">
              <div className="svg-preview-label">PNG Reference</div>
              <div className={`canvas-wrap ${isGenerating ? 'generating' : ''} ${!hasGenerated ? 'matrix-idle' : ''}`}>
                <canvas ref={canvasRef} style={{ opacity: hasGenerated ? 1 : 0 }} />
              </div>
            </div>

            <div className="svg-preview-panel">
              <div className="svg-preview-label">Traced SVG</div>
              <div className={`canvas-wrap svg-wrap ${isGenerating ? 'generating' : ''} ${!hasGenerated ? 'matrix-idle' : ''}`}>
                {svgDataUrl ? (
                  <img className="svg-preview-image" src={svgDataUrl} alt="Generated SVG penguin" />
                ) : null}
              </div>
              <div className="svg-preview-meta">{svgMarkup ? `${tracedSvgSize.toLocaleString()} bytes` : 'No file yet'}</div>
            </div>

            <div className="svg-preview-panel">
              <div className="svg-preview-label">Local True SVG</div>
              <div className={`canvas-wrap svg-wrap ${isGenerating ? 'generating' : ''} ${!hasGenerated ? 'matrix-idle' : ''}`}>
                {structuredSvgDataUrl ? (
                  <img className="svg-preview-image" src={structuredSvgDataUrl} alt="Generated structured SVG penguin" />
                ) : null}
              </div>
              <div className="svg-preview-meta">{structuredSvgMarkup ? `${structuredSvgSize.toLocaleString()} bytes` : 'No file yet'}</div>
            </div>

            <div className="svg-preview-panel">
              <div className="svg-preview-label">Mint SVG (Onchain)</div>
              <div className={`canvas-wrap svg-wrap ${isGenerating ? 'generating' : ''} ${!hasGenerated ? 'matrix-idle' : ''}`}>
                {mintSvgDataUrl ? (
                  <img className="svg-preview-image" src={mintSvgDataUrl} alt="Generated true SVG penguin for mint preview" />
                ) : null}
              </div>
              <div className="svg-preview-meta">
                {mintSvgMarkup ? `${mintSvgSize.toLocaleString()} bytes raw` : 'No file yet'}
              </div>
              {mintSvgMarkup ? (
                <div className="svg-preview-metrics">
                  <div>Source: {mintSvgSource === 'onchain' ? 'Live renderer' : mintSvgSource === 'fallback' ? 'Local fallback' : 'Unknown'}</div>
                  <div>Mint URI: {mintSvgDataUriSize.toLocaleString()} bytes</div>
                  <div>2x mint: {(mintSvgDataUriSize * 2).toLocaleString()} bytes</div>
                  <div>3x mint: {(mintSvgDataUriSize * 3).toLocaleString()} bytes</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="btns">
            <button className="btn white" type="button" onClick={generate} disabled={isGenerating || cooldown > 0} aria-busy={isGenerating}>
              {isGenerating ? 'Generating' : cooldown > 0 ? `Wait ${cooldown}s` : 'Generate'}
            </button>
            <button className="btn" type="button" onClick={saveSvg} disabled={!svgMarkup}>
              Save Traced SVG
            </button>
            <button className="btn" type="button" onClick={saveStructuredSvg} disabled={!structuredSvgMarkup}>
              Save True SVG
            </button>
            <button className="btn" type="button" onClick={saveMintSvg} disabled={!mintSvgMarkup}>
              Save Mint SVG
            </button>
          </div>

          <p className={`status ${status.toLowerCase().includes('failed') ? 'error' : 'success'}`}>{status}</p>
        </div>

        <div className="traits">
          <h2>Traits</h2>
          {traits ? (
            <ul>
              <li><span>Background</span><span>{traits.background.name}</span></li>
              <li><span>Effect</span><span>{traits.effect?.name === 'None' ? 'None' : `${traits.effect?.name} (${traits.effect?.variant || 'White'})`}</span></li>
              <li><span>Body</span><span>{traits.body.name}</span></li>
              <li><span>Belly</span><span>{traits.belly.name}</span></li>
              <li><span>Beak</span><span>{traits.beak.name}</span></li>
              <li><span>Eyes</span><span>{traits.eyes.name}</span></li>
              <li><span>Head</span><span>{traits.head.name}</span></li>
              <li><span>Name</span><span>{traits.name?.name}</span></li>
            </ul>
          ) : (
            <p className="empty">Generate a penguin to compare PNG and SVG output.</p>
          )}
        </div>
      </main>
    </div>
  )
}

export default SvgGenerator
