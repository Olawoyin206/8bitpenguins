import { drawAgent } from './penguin2d.js'

export const MINT_TRUE_SVG_OPTIONS = Object.freeze({
  outputSize: 256,
  logicalSize: 40,
  offsetX: 0,
  offsetY: 0,
  spriteScale: 0.75,
  outline: true,
  innerOutline: true,
  outerOutline: false,
})

export function renderMintTrueSvg(traits) {
  return renderPenguinSVG(traits, MINT_TRUE_SVG_OPTIONS)
}

function colorToSvgFill(r, g, b, a) {
  const toHex = (value) => value.toString(16).padStart(2, '0')
  if (a >= 255) return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  const alpha = String(Math.round((a / 255) * 1000) / 1000).replace(/0+$/, '').replace(/\.$/, '')
  return `rgba(${r},${g},${b},${alpha})`
}

function escapeXml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function parseHex(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function mixHex(a, b, t) {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return a
  const mix = (x, y) => Math.round(x + (y - x) * t)
  const toHex = (n) => n.toString(16).padStart(2, '0')
  return `#${toHex(mix(ca.r, cb.r))}${toHex(mix(ca.g, cb.g))}${toHex(mix(ca.b, cb.b))}`
}

function createSvgBuilder() {
  const LOGICAL_SIZE = 44
  const offsetX = 2
  const offsetY = 1
  const backgroundElements = []
  const spriteElements = []

  const pushRect = (collection, x, y, width, height, fill) => {
    if (width <= 0 || height <= 0 || !fill) return
    collection.push({ x, y, width, height, fill })
  }

  const rect = (x1, y1, x2, y2, color) => {
    const x = x1 + offsetX
    const y = y1 + offsetY
    const width = x2 - x1 + 1
    const height = y2 - y1 + 1
    pushRect(spriteElements, x, y, width, height, color)
  }

  const bgRect = (x1, y1, x2, y2, color) => {
    const x = x1 + offsetX
    const y = y1 + offsetY
    const width = x2 - x1 + 1
    const height = y2 - y1 + 1
    pushRect(backgroundElements, x, y, width, height, color)
  }

  const bgSet = (x, y, color) => {
    pushRect(backgroundElements, x + offsetX, y + offsetY, 1, 1, color)
  }

  const bgSoftDot = (x, y, core, mid, outer) => {
    bgSet(x, y, core)
    bgSet(x - 1, y, mid)
    bgSet(x + 1, y, mid)
    bgSet(x, y - 1, mid)
    bgSet(x, y + 1, mid)
    bgSet(x - 1, y - 1, outer)
    bgSet(x + 1, y - 1, outer)
    bgSet(x - 1, y + 1, outer)
    bgSet(x + 1, y + 1, outer)
  }

  return { LOGICAL_SIZE, backgroundElements, spriteElements, rect, bgRect, bgSet, bgSoftDot }
}

function emitScaledRects(rects, offset, scale) {
  return rects
    .map(({ x, y, width, height, fill }) => {
      const x1 = Math.round(offset + x * scale)
      const y1 = Math.round(offset + y * scale)
      const x2 = Math.round(offset + (x + width) * scale)
      const y2 = Math.round(offset + (y + height) * scale)
      const scaledWidth = Math.max(1, x2 - x1)
      const scaledHeight = Math.max(1, y2 - y1)
      return `<rect x="${x1}" y="${y1}" width="${scaledWidth}" height="${scaledHeight}" fill="${fill}" />`
    })
}

function scaleRectData(rects, offset, scale) {
  return rects.map(({ x, y, width, height, fill }) => {
    const x1 = Math.round(offset + x * scale)
    const y1 = Math.round(offset + y * scale)
    const x2 = Math.round(offset + (x + width) * scale)
    const y2 = Math.round(offset + (y + height) * scale)
    return {
      x: x1,
      y: y1,
      width: Math.max(1, x2 - x1),
      height: Math.max(1, y2 - y1),
      fill,
    }
  })
}

function buildCompactSvgPaths(rects) {
  const paths = []
  let currentFill = ''
  let currentCommands = []

  rects.forEach(({ x, y, width, height, fill }) => {
    if (!fill || width <= 0 || height <= 0) return
    const command = `M${x} ${y}h${width}v${height}h-${width}z`
    if (fill !== currentFill) {
      if (currentFill && currentCommands.length > 0) {
        paths.push(`<path fill="${currentFill}" d="${currentCommands.join('')}"/>`)
      }
      currentFill = fill
      currentCommands = [command]
      return
    }
    currentCommands.push(command)
  })

  if (currentFill && currentCommands.length > 0) {
    paths.push(`<path fill="${currentFill}" d="${currentCommands.join('')}"/>`)
  }

  return paths
}

function svgRectPath(x, y, width, height) {
  return `M${x} ${y}h${width}v${height}h-${width}z`
}

function svgTag(tag, attrs) {
  return `<${tag} ${attrs}/>`
}

export function renderPenguinMintSVG(traits, options = {}) {
  const outputSize = Math.max(1, Number(options.outputSize) || 40)
  const bg = traits?.background?.color || '#ADD8E6'
  const body = traits?.body?.base || '#1C1C1C'
  const bodyHighlight = traits?.body?.highlight || body
  const bodyShadow = traits?.body?.shadow || body
  const belly = traits?.belly?.base || '#FDF5E6'
  const bellyHighlight = traits?.belly?.highlight || belly
  const beak = traits?.beak?.base || '#FF9F43'
  const beakShadow = traits?.beak?.shadow || beak
  const feet = traits?.feet?.base || '#FF9F43'
  const feetShadow = traits?.feet?.shadow || feet
  const headColor = traits?.head?.color || '#D4AF37'
  const headShadow = traits?.head?.shadow || headColor
  const eyeType = traits?.eyes?.type || 'round'
  const headType = traits?.head?.type || 'none'

  const bodyBasePath = [
    svgRectPath(9, 9, 22, 18),
    svgRectPath(8, 11, 24, 20),
    svgRectPath(7, 14, 26, 18),
    svgRectPath(6, 27, 28, 7),
    svgRectPath(3, 26, 5, 7),
    svgRectPath(32, 26, 5, 7),
  ].join('')

  const bodyLightPath = [
    svgRectPath(10, 10, 20, 4),
    svgRectPath(9, 14, 22, 4),
    svgRectPath(10, 18, 20, 3),
  ].join('')

  const bodyShadePath = [
    svgRectPath(8, 30, 24, 3),
    svgRectPath(9, 33, 22, 2),
    svgRectPath(4, 31, 4, 2),
    svgRectPath(32, 31, 4, 2),
  ].join('')

  const bellyPath = [
    svgRectPath(12, 15, 16, 10),
    svgRectPath(11, 25, 18, 8),
  ].join('')

  const bellyLightPath = [
    svgRectPath(14, 17, 12, 3),
    svgRectPath(14, 27, 10, 3),
  ].join('')

  const eyePath = (() => {
    if (eyeType === 'closed') return 'M14 18h5v1h-5zM25 18h5v1h-5z'
    if (eyeType === 'wink') return 'M14 17h4v2h-4zM25 18h5v1h-5z'
    if (eyeType === 'sleepy') return 'M14 18h5v1h-5zM25 18h5v1h-5zM15 19h3v1h-3zM26 19h3v1h-3z'
    if (eyeType === 'happy') return 'M14 17h5v1h-5zM25 17h5v1h-5z'
    if (eyeType === 'sparkle') return 'M14 17h5v2h-5zM25 17h5v2h-5zM16 16h1v1h-1zM27 16h1v1h-1z'
    if (eyeType === 'angry') return 'M14 17h5v2h-5zM25 17h5v2h-5zM14 16h2v1h-2zM28 16h2v1h-2z'
    return 'M14 17h5v2h-5zM25 17h5v2h-5z'
  })()

  const beakPath = (() => {
    const type = traits?.beak?.type || 'small'
    if (type === 'wide') return 'M17 22h10v3H17zM18 21h8v1h-8z'
    if (type === 'large' || type === 'round') return 'M18 21h8v4h-8zM19 20h6v1h-6z'
    if (type === 'pointy') return 'M19 21h6v3h-6zM21 20h2v1h-2z'
    if (type === 'puffy') return 'M18 21h8v3h-8zM19 20h6v1h-6z'
    return 'M19 21h6v3h-6z'
  })()

  const headPath = (() => {
    if (headType === 'none') return ''
    if (headType === 'halo') return `<path fill="#E8BF2F" d="M16 4h12v2H16zM15 5h14v1H15z"/><path fill="#FFF1A3" d="M18 3h8v1h-8z"/>`
    if (headType === 'crown') return `<path fill="#C69214" d="M12 6h20v3H12zM14 4h3v2h-3zM20 2h4v4h-4zM27 4h3v2h-3z"/><path fill="#F7D55C" d="M14 5h16v1H14z"/>`
    if (headType === 'scarf') return `<path fill="${headColor}" d="M10 25h22v4H10zM29 25h4v9h-4z"/><path fill="${headShadow}" d="M10 28h22v1H10zM30 26h2v7h-2z"/>`
    if (headType === 'headband') return `<path fill="${headColor}" d="M9 8h24v3H9z"/><path fill="${headShadow}" d="M9 10h24v1H9z"/>`
    if (headType === 'cap') return `<path fill="${headColor}" d="M10 7h20v3H10zM28 8h5v2h-5z"/><path fill="${headShadow}" d="M10 9h20v1H10zM30 9h3v1h-3z"/>`
    if (headType === 'beanie') return `<path fill="${headColor}" d="M11 6h18v5H11zM13 4h14v2H13z"/><path fill="${headShadow}" d="M11 10h18v1H11z"/>`
    return ''
  })()

  const feetPath = [
    svgRectPath(10, 36, 5, 2),
    svgRectPath(9, 37, 7, 1),
    svgRectPath(12, 37, 3, 2),
    svgRectPath(8, 37, 3, 2),
    svgRectPath(25, 36, 5, 2),
    svgRectPath(24, 37, 7, 1),
    svgRectPath(25, 37, 3, 2),
    svgRectPath(29, 37, 3, 2),
  ].join('')
  const feetHighlightPath = [
    svgRectPath(11, 35, 3, 2),
    svgRectPath(12, 37, 2, 2),
    svgRectPath(9, 38, 2, 1),
    svgRectPath(26, 35, 3, 2),
    svgRectPath(26, 37, 2, 2),
    svgRectPath(29, 38, 2, 1),
  ].join('')
  const feetShadePath = [
    svgRectPath(11, 37, 4, 1),
    svgRectPath(25, 37, 4, 1),
  ].join('')
  const groundShadowPath = [
    svgRectPath(7, 39, 26, 1),
    svgRectPath(9, 39, 22, 1),
    svgRectPath(11, 39, 18, 1),
    svgRectPath(14, 39, 12, 1),
  ].join('')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}" viewBox="0 0 40 40" shape-rendering="crispEdges">`,
    svgTag('rect', `width="40" height="40" fill="${bg}"`),
    svgTag('path', `fill="${body}" d="${bodyBasePath}"`),
    svgTag('path', `fill="${bodyHighlight}" d="${bodyLightPath}"`),
    svgTag('path', `fill="${bodyShadow}" d="${bodyShadePath}"`),
    svgTag('path', `fill="${belly}" d="${bellyPath}"`),
    svgTag('path', `fill="${bellyHighlight}" d="${bellyLightPath}"`),
    headPath,
    svgTag('path', 'fill="#0A0A0A" d="' + eyePath + '"'),
    svgTag('path', `fill="${beak}" d="${beakPath}"`),
    svgTag('path', `fill="${beakShadow}" d="M19 24h6v1h-6z"`),
    svgTag('path', 'fill="#FFB6C1" d="M10 20h3v3h-3zM27 20h3v3h-3z"'),
    svgTag('path', 'fill="rgba(0,0,0,0.08)" d="' + groundShadowPath + '"'),
    svgTag('path', `fill="${feet}" d="${feetPath}"`),
    svgTag('path', `fill="${feetHighlight}" d="${feetHighlightPath}"`),
    svgTag('path', `fill="${feetShadow}" d="${feetShadePath}"`),
    `</svg>`,
  ].join('')
}

function traceCanvasRegionData(canvas, region) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { data } = ctx.getImageData(region.x, region.y, region.width, region.height)
  const rects = []
  const activeRects = new Map()

  for (let y = 0; y < region.height; y += 1) {
    let x = 0
    const rowKeys = new Set()
    while (x < region.width) {
      const idx = (y * region.width + x) * 4
      const a = data[idx + 3]
      if (a === 0) {
        x += 1
        continue
      }

      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      let run = 1

      while (x + run < region.width) {
        const nextIdx = (y * region.width + x + run) * 4
        if (
          data[nextIdx] !== r ||
          data[nextIdx + 1] !== g ||
          data[nextIdx + 2] !== b ||
          data[nextIdx + 3] !== a
        ) {
          break
        }
        run += 1
      }

      const fill = colorToSvgFill(r, g, b, a)
      const key = `${x}:${run}:${fill}`
      const current = activeRects.get(key)
      if (current && current.y + current.height === y) {
        current.height += 1
      } else {
        activeRects.set(key, { x, y, width: run, height: 1, fill })
      }
      rowKeys.add(key)
      x += run
    }

    for (const [key, rect] of activeRects.entries()) {
      if (!rowKeys.has(key) && rect.y + rect.height - 1 < y) {
        rects.push({
          x: region.x + rect.x,
          y: region.y + rect.y,
          width: rect.width,
          height: rect.height,
          fill: rect.fill,
        })
        activeRects.delete(key)
      }
    }
  }

  for (const rect of activeRects.values()) {
    rects.push({
      x: region.x + rect.x,
      y: region.y + rect.y,
      width: rect.width,
      height: rect.height,
      fill: rect.fill,
    })
  }

  return rects
}

function traceCanvasRegionRects(canvas, region) {
  return traceCanvasRegionData(canvas, region).map(({ x, y, width, height, fill }) => (
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" />`
  ))
}

export function renderPenguinSVG(traits, options = {}) {
  const outputSize = Math.max(256, Number(options.outputSize) || 400)
  const sourceCanvas = document.createElement('canvas')
  drawAgent(traits, sourceCanvas, outputSize, options)

  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true })
  const width = sourceCanvas.width
  const height = sourceCanvas.height
  const { data } = ctx.getImageData(0, 0, width, height)
  const rects = []
  const activeRects = new Map()

  for (let y = 0; y < height; y += 1) {
    let x = 0
    const rowKeys = new Set()
    while (x < width) {
      const idx = (y * width + x) * 4
      const a = data[idx + 3]
      if (a === 0) {
        x += 1
        continue
      }

      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      let run = 1

      while (x + run < width) {
        const nextIdx = (y * width + x + run) * 4
        if (
          data[nextIdx] !== r ||
          data[nextIdx + 1] !== g ||
          data[nextIdx + 2] !== b ||
          data[nextIdx + 3] !== a
        ) {
          break
        }
        run += 1
      }

      const fill = colorToSvgFill(r, g, b, a)
      const key = `${x}:${run}:${fill}`
      const current = activeRects.get(key)
      if (current && current.y + current.height === y) {
        current.height += 1
      } else {
        activeRects.set(key, { x, y, width: run, height: 1, fill })
      }
      rowKeys.add(key)
      x += run
    }

    for (const [key, rect] of activeRects.entries()) {
      if (!rowKeys.has(key) && rect.y + rect.height - 1 < y) {
        rects.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          fill: rect.fill,
        })
        activeRects.delete(key)
      }
    }
  }

  for (const rect of activeRects.values()) {
    rects.push({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      fill: rect.fill,
    })
  }

  const compactPaths = buildCompactSvgPaths(rects)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
    ...compactPaths,
    `</svg>`,
  ].join('')
}

export function renderPenguinStructuredSVG(traits, options = {}) {
  const outputSize = Math.max(1, Number(options.outputSize) || 400)
  const includeFeetOverlay = options.includeFeetOverlay !== false
  const compact = options.compact === true
  const { LOGICAL_SIZE, backgroundElements, spriteElements, rect, bgRect, bgSet, bgSoftDot } = createSvgBuilder()
  const cx = 20

  bgRect(-2, -1, 41, 42, traits.background.color)

  const fxType = traits.background.fx
  const effectVariant = traits.effect?.variant || 'White'
  const effectPalette = (() => {
    if (effectVariant === 'Golden') {
      return {
        snowCore: 'rgba(255,232,170,0.92)',
        snowMid: 'rgba(255,214,120,0.40)',
        snowOuter: 'rgba(255,203,90,0.18)',
        snowFar: 'rgba(255,196,80,0.11)',
        dotCore: 'rgba(255,226,150,0.30)',
        dotMid: 'rgba(255,208,110,0.15)',
        dotOuter: 'rgba(255,194,80,0.07)',
      }
    }
    if (effectVariant === 'Light') {
      return {
        snowCore: 'rgba(215,246,255,0.9)',
        snowMid: 'rgba(180,230,255,0.36)',
        snowOuter: 'rgba(150,216,255,0.15)',
        snowFar: 'rgba(130,206,255,0.09)',
        dotCore: 'rgba(205,236,255,0.26)',
        dotMid: 'rgba(165,220,255,0.12)',
        dotOuter: 'rgba(140,210,255,0.05)',
      }
    }
    return {
      snowCore: 'rgba(255,255,255,0.9)',
      snowMid: 'rgba(255,255,255,0.35)',
      snowOuter: 'rgba(255,255,255,0.14)',
      snowFar: 'rgba(255,255,255,0.08)',
      dotCore: 'rgba(255,255,255,0.24)',
      dotMid: 'rgba(255,255,255,0.11)',
      dotOuter: 'rgba(255,255,255,0.05)',
    }
  })()

  if (fxType === 'snowflakes') {
    const flakes = [[3, 4], [10, 7], [32, 5], [36, 10], [6, 33], [14, 35], [29, 32], [35, 27], [2, 20], [38, 22]]
    for (const [x, y] of flakes) {
      bgSoftDot(x, y, effectPalette.snowCore, effectPalette.snowMid, effectPalette.snowOuter)
      bgSet(x - 2, y, effectPalette.snowFar)
      bgSet(x + 2, y, effectPalette.snowFar)
      bgSet(x, y - 2, effectPalette.snowFar)
      bgSet(x, y + 2, effectPalette.snowFar)
    }
  } else if (fxType === 'softdots') {
    const dots = [[4, 5], [8, 11], [13, 4], [18, 8], [25, 4], [30, 9], [35, 6], [6, 29], [12, 34], [20, 36], [28, 33], [34, 29]]
    for (const [x, y] of dots) {
      bgSoftDot(x, y, effectPalette.dotCore, effectPalette.dotMid, effectPalette.dotOuter)
    }
  }

  const body = traits.body.base
  const bodyHighlight = traits.body.highlight
  const bodyShadow = traits.body.shadow
  const belly = traits.belly.base
  const bellyHighlight = traits.belly.highlight
  const beak = traits.beak.base
  const beakHighlight = traits.beak.highlight
  const beakShadow = traits.beak.shadow
  const feet = traits.feet?.base || '#FF9F43'
  const feetHighlight = traits.feet?.highlight || '#FFBE76'
  const feetShadow = traits.feet?.shadow || '#E67E22'

  rect(8, 25, 31, 38, body)
  rect(7, 26, 32, 37, body)
  rect(6, 27, 33, 36, body)
  rect(6, 28, 33, 35, body)
  rect(7, 29, 32, 34, body)
  rect(8, 30, 31, 33, body)
  rect(9, 31, 30, 32, body)
  rect(10, 32, 29, 32, body)
  rect(10, 26, 29, 27, bodyHighlight)
  rect(9, 28, 30, 28, bodyHighlight)
  rect(10, 30, 29, 30, bodyHighlight)
  rect(11, 32, 28, 32, bodyHighlight)
  rect(8, 38, 31, 38, bodyShadow)
  rect(7, 37, 32, 37, bodyShadow)
  rect(6, 36, 33, 36, bodyShadow)
  rect(12, 27, 12, 27, bodyShadow)
  rect(28, 27, 28, 27, bodyShadow)
  rect(10, 29, 10, 29, bodyShadow)
  rect(30, 29, 30, 29, bodyShadow)
  rect(8, 31, 8, 31, bodyShadow)
  rect(32, 31, 32, 31, bodyShadow)

  rect(12, 28, 27, 38, belly)
  rect(11, 29, 28, 37, belly)
  rect(11, 30, 28, 36, belly)
  rect(12, 31, 27, 35, belly)
  rect(13, 32, 26, 34, belly)
  rect(14, 33, 25, 34, belly)
  rect(15, 34, 24, 35, belly)
  rect(14, 29, 25, 30, bellyHighlight)
  rect(14, 31, 25, 32, bellyHighlight)
  rect(15, 33, 24, 34, bellyHighlight)
  rect(15, 35, 15, 35, bellyHighlight)
  rect(24, 35, 24, 35, bellyHighlight)
  rect(16, 36, 16, 36, bellyHighlight)
  rect(23, 36, 23, 36, bellyHighlight)

  rect(10, 8, 29, 26, body)
  rect(9, 9, 30, 25, body)
  rect(8, 10, 31, 24, body)
  rect(8, 11, 31, 23, body)
  rect(9, 12, 30, 22, body)
  rect(10, 13, 29, 21, body)
  rect(11, 14, 28, 20, body)
  rect(12, 15, 27, 19, body)
  rect(13, 16, 26, 18, body)
  rect(14, 17, 25, 18, body)
  rect(12, 9, 27, 10, bodyHighlight)
  rect(11, 11, 28, 12, bodyHighlight)
  rect(12, 13, 27, 14, bodyHighlight)
  rect(13, 15, 26, 16, bodyHighlight)
  rect(14, 17, 25, 17, bodyHighlight)
  rect(10, 26, 29, 26, bodyShadow)
  rect(9, 25, 30, 25, bodyShadow)
  rect(8, 24, 31, 24, bodyShadow)
  rect(11, 10, 11, 10, bodyShadow)
  rect(28, 10, 28, 10, bodyShadow)
  rect(10, 12, 10, 12, bodyShadow)
  rect(29, 12, 29, 12, bodyShadow)
  rect(10, 14, 10, 14, bodyShadow)
  rect(29, 14, 29, 14, bodyShadow)

  rect(12, 14, 27, 24, belly)
  rect(11, 15, 28, 23, belly)
  rect(12, 16, 27, 22, belly)
  rect(13, 17, 26, 21, belly)
  rect(14, 18, 25, 20, belly)
  rect(15, 19, 24, 20, belly)
  rect(14, 15, 25, 16, bellyHighlight)
  rect(14, 17, 25, 18, bellyHighlight)
  rect(15, 19, 24, 20, bellyHighlight)

  const eyeY = 17
  if (traits.eyes.type === 'round') {
    rect(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A')
  } else if (traits.eyes.type === 'angry') {
    rect(cx - 4, eyeY, cx - 3, eyeY, '#0A0A0A')
    rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx - 3, eyeY, cx - 3, eyeY, '#FF0000')
    rect(cx + 3, eyeY, cx + 4, eyeY, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A')
    rect(cx + 4, eyeY, cx + 4, eyeY, '#FF0000')
  } else if (traits.eyes.type === 'sleepy') {
    rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx - 4, eyeY + 2, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY + 2, cx + 4, eyeY + 2, '#0A0A0A')
  } else if (traits.eyes.type === 'sparkle') {
    rect(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A')
  } else if (traits.eyes.type === 'happy') {
    rect(cx - 5, eyeY, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY, cx + 5, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A')
  } else if (traits.eyes.type === 'wink') {
    rect(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A')
  } else if (traits.eyes.type === 'sad') {
    rect(cx - 4, eyeY, cx - 3, eyeY, '#0A0A0A')
    rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY, cx + 4, eyeY, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A')
  } else if (traits.eyes.type === 'surprised') {
    rect(cx - 5, eyeY, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY, cx + 5, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A')
  } else if (traits.eyes.type === 'sideeye') {
    rect(cx - 5, eyeY, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY, cx + 5, eyeY + 1, '#0A0A0A')
    rect(cx + 4, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A')
  } else if (traits.eyes.type === 'closed') {
    rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A')
  }

  rect(cx - 7, 14, cx - 3, 14, bodyShadow)
  rect(cx + 3, 14, cx + 7, 14, bodyShadow)
  rect(cx - 8, 13, cx - 4, 13, bodyShadow)
  rect(cx + 4, 13, cx + 8, 13, bodyShadow)

  rect(2, 26, 5, 32, body)
  rect(1, 27, 6, 31, body)
  rect(2, 28, 5, 30, bodyHighlight)
  rect(3, 29, 5, 29, bodyHighlight)
  rect(2, 30, 4, 31, bodyShadow)
  rect(1, 31, 3, 32, bodyShadow)
  rect(1, 30, 3, 33, body)
  rect(2, 31, 3, 32, bodyHighlight)
  rect(5, 31, 7, 33, body)
  rect(6, 32, 7, 33, bodyHighlight)

  rect(34, 26, 37, 32, body)
  rect(33, 27, 38, 31, body)
  rect(34, 28, 37, 30, bodyHighlight)
  rect(34, 29, 36, 29, bodyHighlight)
  rect(35, 30, 37, 31, bodyShadow)
  rect(36, 31, 38, 32, bodyShadow)
  rect(36, 30, 38, 33, body)
  rect(36, 31, 37, 32, bodyHighlight)
  rect(32, 31, 34, 33, body)
  rect(32, 32, 33, 33, bodyHighlight)

  if (traits.beak.type === 'small') {
    rect(cx - 2, 21, cx + 1, 23, beak)
    rect(cx - 1, 20, cx, 22, beak)
    rect(cx - 1, 22, cx, 22, beakShadow)
  } else if (traits.beak.type === 'large') {
    rect(cx - 3, 20, cx + 2, 23, beak)
    rect(cx - 2, 19, cx + 1, 22, beak)
    rect(cx - 1, 18, cx, 20, beak)
    rect(cx - 2, 23, cx + 1, 23, beakShadow)
  } else if (traits.beak.type === 'wide') {
    rect(cx - 4, 21, cx + 3, 23, beak)
    rect(cx - 3, 20, cx + 2, 24, beak)
    rect(cx - 2, 20, cx + 1, 20, beak)
    rect(cx - 2, 24, cx + 1, 24, beakShadow)
  } else if (traits.beak.type === 'pointy') {
    rect(cx - 2, 21, cx + 1, 23, beak)
    rect(cx - 1, 19, cx, 22, beak)
    rect(cx, 18, cx, 20, beak)
    rect(cx - 1, 23, cx, 23, beakShadow)
  } else if (traits.beak.type === 'round') {
    rect(cx - 3, 21, cx + 2, 23, beak)
    rect(cx - 2, 20, cx + 1, 24, beak)
    rect(cx - 1, 20, cx, 20, beak)
    rect(cx - 2, 24, cx + 1, 24, beakShadow)
  } else if (traits.beak.type === 'puffy') {
    rect(cx - 3, 20, cx + 2, 22, beak)
    rect(cx - 2, 19, cx + 1, 21, beakHighlight)
    rect(cx - 1, 18, cx, 20, beakHighlight)
    rect(cx - 2, 22, cx + 1, 22, beakShadow)
    rect(cx + 1, 21, cx + 2, 21, beakShadow)
  } else {
    rect(cx - 3, 21, cx + 2, 23, beak)
    rect(cx - 2, 20, cx + 1, 22, beak)
    rect(cx - 1, 20, cx, 21, beak)
    rect(cx - 2, 22, cx + 1, 22, beakShadow)
    rect(cx - 3, 21, cx - 3, 22, beakShadow)
  }

  const cheeksColor = traits.cheeks?.base || '#FFB6C1'
  const cheeksHighlightColor = traits.cheeks?.highlight || '#FFC5CD'
  rect(cx - 9, 19, cx - 7, 21, cheeksColor)
  rect(cx + 7, 19, cx + 9, 21, cheeksColor)
  rect(cx - 8, 20, cx - 7, 20, cheeksHighlightColor)
  rect(cx + 7, 20, cx + 8, 20, cheeksHighlightColor)

  const headColor = traits.head.color || '#404040'
  const headType = traits.head.type || 'none'
  const headShadeProfile = {
    beanie: { highlight: 0.3, shadow: 0.18, spec: 0.4, mid: 0.24, deep: 0.08, fold: 0.1 },
    cap: { highlight: 0.26, shadow: 0.2, spec: 0.36, mid: 0.26, deep: 0.1, fold: 0.12 },
    scarf: { highlight: 0.24, shadow: 0.16, spec: 0.32, mid: 0.2, deep: 0.06, fold: 0.08 },
    headband: { highlight: 0.26, shadow: 0.17, spec: 0.38, mid: 0.2, deep: 0.07, fold: 0.08 },
    default: { highlight: 0.28, shadow: 0.22, spec: 0.4, mid: 0.28, deep: 0.12, fold: 0.12 },
  }[headType] || { highlight: 0.28, shadow: 0.22, spec: 0.4, mid: 0.28, deep: 0.12, fold: 0.12 }
  const headHighlight = traits.head.highlight || mixHex(headColor, '#FFFFFF', headShadeProfile.highlight)
  const headShadow = traits.head.shadow || mixHex(headColor, '#000000', headShadeProfile.shadow)
  const headSpec = mixHex(headHighlight, '#FFFFFF', headShadeProfile.spec)
  const headMid = mixHex(headColor, headShadow, headShadeProfile.mid)
  const headDeep = mixHex(headShadow, '#000000', headShadeProfile.deep)
  const clothFold = mixHex(headColor, headShadow, headShadeProfile.fold)

  if (traits.head.type === 'crown') {
    const crownStyle = traits.head.style || 'imperial'
    if (crownStyle === 'elegant') {
      rect(cx - 9, 7, cx + 9, 9, '#CDA349')
      rect(cx - 8, 6, cx + 8, 7, '#F6D98A')
      rect(cx - 9, 9, cx + 9, 9, '#775314')
      rect(cx - 7, 4, cx - 5, 7, '#E8C86E')
      rect(cx - 3, 3, cx - 1, 7, '#F1D786')
      rect(cx + 1, 3, cx + 3, 7, '#F1D786')
      rect(cx + 5, 4, cx + 7, 7, '#E8C86E')
      rect(cx - 1, 1, cx, 2, '#FFF5C8')
      rect(cx - 8, 7, cx - 8, 8, '#8A651F')
      rect(cx + 8, 7, cx + 8, 8, '#8A651F')
      rect(cx - 8, 6, cx + 8, 6, '#FFE4A0')
      rect(cx - 6, 7, cx - 5, 8, '#B80F2E')
      rect(cx - 1, 7, cx, 8, '#0E7EEA')
      rect(cx + 4, 7, cx + 5, 8, '#23A455')
    } else {
      rect(cx - 10, 7, cx + 10, 9, '#C69214')
      rect(cx - 9, 6, cx + 9, 7, '#F2C94C')
      rect(cx - 10, 9, cx + 10, 9, '#7A5200')
      rect(cx - 8, 3, cx - 6, 7, '#E5B93A')
      rect(cx - 5, 4, cx - 3, 7, '#DCAA2D')
      rect(cx - 1, 1, cx + 1, 7, '#F7D55C')
      rect(cx + 3, 4, cx + 5, 7, '#DCAA2D')
      rect(cx + 6, 3, cx + 8, 7, '#E5B93A')
      rect(cx, 0, cx, 2, '#FFF3B0')
      rect(cx - 9, 6, cx - 9, 8, '#8A6108')
      rect(cx + 9, 6, cx + 9, 8, '#8A6108')
      rect(cx - 8, 6, cx + 8, 6, '#FFD76A')
      rect(cx - 7, 7, cx - 6, 8, '#B80F2E')
      rect(cx - 1, 7, cx, 8, '#0E7EEA')
      rect(cx + 5, 7, cx + 6, 8, '#23A455')
    }
  } else if (traits.head.type === 'beanie') {
    rect(cx - 10, 7, cx + 9, 10, headColor)
    rect(cx - 9, 5, cx + 8, 7, headHighlight)
    rect(cx - 7, 3, cx + 6, 6, headColor)
    rect(cx - 4, 2, cx + 3, 3, headSpec)
    rect(cx - 10, 10, cx + 9, 10, headShadow)
    rect(cx - 9, 9, cx + 8, 9, clothFold)
    rect(cx - 8, 8, cx + 7, 8, headMid)
    rect(cx - 6, 4, cx - 6, 10, headMid)
    rect(cx - 3, 4, cx - 3, 10, headShadow)
    rect(cx, 4, cx, 10, headMid)
    rect(cx + 3, 4, cx + 3, 10, headShadow)
    rect(cx + 6, 4, cx + 6, 10, headMid)
    rect(cx - 1, 10, cx + 1, 10, headDeep)
  } else if (traits.head.type === 'cap') {
    rect(cx - 11, 7, cx + 9, 9, headColor)
    rect(cx - 10, 6, cx + 8, 7, headHighlight)
    rect(cx - 8, 5, cx + 5, 6, headSpec)
    rect(cx - 10, 8, cx + 8, 8, headMid)
    rect(cx - 10, 9, cx + 8, 9, headShadow)
    rect(cx - 2, 8, cx + 5, 8, headDeep)
    rect(cx - 1, 7, cx + 3, 7, headHighlight)
    rect(cx + 8, 8, cx + 12, 11, headShadow)
    rect(cx + 9, 9, cx + 12, 10, headColor)
    rect(cx - 12, 8, cx - 8, 9, headShadow)
    rect(cx - 8, 9, cx + 3, 9, headDeep)
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 25, cx + 10, 28, headColor)
    rect(cx - 9, 24, cx + 9, 26, headHighlight)
    rect(cx + 8, 25, cx + 11, 33, traits.head.color)
    rect(cx + 9, 26, cx + 10, 32, headHighlight)
    rect(cx - 3, 26, cx + 2, 27, clothFold)
    rect(cx - 2, 27, cx + 1, 28, headShadow)
  } else if (traits.head.type === 'halo') {
    rect(cx - 4, 3, cx + 3, 4, '#E8BF2F')
    rect(cx - 5, 4, cx + 4, 5, '#D1A91E')
    rect(cx - 3, 2, cx + 2, 3, '#FFE27A')
    rect(cx - 5, 5, cx + 4, 5, '#AD8614')
    rect(cx - 2, 2, cx - 1, 2, '#FFF1A3')
    rect(cx + 1, 2, cx + 2, 2, '#FFF1A3')
  } else if (traits.head.type === 'headband') {
    rect(cx - 11, 6, cx + 10, 9, headColor)
    rect(cx - 10, 5, cx + 9, 6, headSpec)
    rect(cx - 11, 9, cx + 10, 9, headShadow)
    rect(cx - 10, 8, cx + 9, 8, headMid)
    rect(cx - 9, 7, cx + 8, 7, clothFold)
    rect(cx - 8, 6, cx - 7, 8, headHighlight)
    rect(cx, 6, cx + 1, 8, headHighlight)
    rect(cx + 8, 6, cx + 9, 8, headHighlight)
    rect(cx - 2, 5, cx + 1, 6, headSpec)
    rect(cx - 10, 9, cx - 10, 9, headDeep)
    rect(cx + 9, 9, cx + 10, 9, headDeep)
  }

  if (traits.head.type !== 'none' && traits.head.type !== 'scarf') {
    rect(cx - 8, 10, cx + 8, 10, 'rgba(0,0,0,0.12)')
  }

  rect(2, 26, 5, 32, body)
  rect(1, 27, 6, 31, body)
  rect(2, 28, 5, 30, bodyHighlight)
  rect(3, 29, 5, 29, bodyHighlight)
  rect(2, 30, 4, 31, bodyShadow)
  rect(1, 31, 3, 32, bodyShadow)
  rect(1, 30, 3, 33, body)
  rect(2, 31, 3, 32, bodyHighlight)
  rect(5, 31, 7, 33, body)
  rect(6, 32, 7, 33, bodyHighlight)
  rect(34, 26, 37, 32, body)
  rect(33, 27, 38, 31, body)
  rect(34, 28, 37, 30, bodyHighlight)
  rect(34, 29, 36, 29, bodyHighlight)
  rect(35, 30, 37, 31, bodyShadow)
  rect(36, 31, 38, 32, bodyShadow)
  rect(36, 30, 38, 33, body)
  rect(36, 31, 37, 32, bodyHighlight)
  rect(32, 31, 34, 33, body)
  rect(32, 32, 33, 33, bodyHighlight)

  if (!includeFeetOverlay) {
    rect(10, 37, 14, 38, feet)
    rect(9, 38, 15, 38, feet)
    rect(11, 36, 13, 37, feetHighlight)
    rect(10, 38, 13, 38, feetShadow)
    rect(10, 38, 12, 39, feet)
    rect(11, 38, 12, 39, feetHighlight)
    rect(13, 38, 15, 39, feet)
    rect(26, 37, 30, 38, feet)
    rect(25, 38, 31, 38, feet)
    rect(27, 36, 29, 37, feetHighlight)
    rect(26, 38, 29, 38, feetShadow)
    rect(26, 38, 28, 39, feet)
    rect(27, 38, 28, 39, feetHighlight)
    rect(30, 38, 32, 39, feet)

    rect(8, 39, 31, 39, 'rgba(0,0,0,0.08)')
    rect(10, 39, 29, 39, 'rgba(0,0,0,0.14)')
    rect(12, 39, 15, 39, 'rgba(0,0,0,0.24)')
    rect(25, 39, 28, 39, 'rgba(0,0,0,0.24)')
    rect(17, 39, 23, 39, 'rgba(0,0,0,0.10)')
  }

  const fullScale = outputSize / LOGICAL_SIZE
  const spriteScale = Math.floor(outputSize * 0.9)
  const spriteInset = Math.floor((outputSize - spriteScale) / 2)
  const spriteLogicalScale = spriteScale / LOGICAL_SIZE
  const feetOverlayData = includeFeetOverlay
    ? (() => {
        const referenceCanvas = document.createElement('canvas')
        drawAgent(traits, referenceCanvas, outputSize, options)
        return traceCanvasRegionData(referenceCanvas, {
          x: Math.max(0, Math.floor(spriteInset + 7 * spriteLogicalScale)),
          y: Math.max(0, Math.floor(spriteInset + 35 * spriteLogicalScale)),
          width: Math.min(outputSize, Math.ceil(26 * spriteLogicalScale)),
          height: Math.min(outputSize, Math.ceil(8 * spriteLogicalScale)),
        })
      })()
    : []
  const feetOverlay = feetOverlayData.map(({ x, y, width, height, fill }) => (
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" />`
  ))
  const title = escapeXml(`${traits?.name?.name || '8bit Penguin'} True SVG`)

  if (compact) {
    const compactPaths = buildCompactSvgPaths([
      ...scaleRectData(backgroundElements, 0, fullScale),
      ...scaleRectData(spriteElements, spriteInset, spriteLogicalScale),
      ...feetOverlayData,
    ])
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outputSize} ${outputSize}" shape-rendering="crispEdges">`,
      ...compactPaths,
      `</svg>`,
    ].join('')
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outputSize}" height="${outputSize}" viewBox="0 0 ${outputSize} ${outputSize}" shape-rendering="crispEdges">`,
    `<title>${title}</title>`,
    ...emitScaledRects(backgroundElements, 0, fullScale),
    ...emitScaledRects(spriteElements, spriteInset, spriteLogicalScale),
    ...feetOverlay,
    `</svg>`,
  ].join('\n')
}
