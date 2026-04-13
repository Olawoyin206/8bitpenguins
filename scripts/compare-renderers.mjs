import fs from 'node:fs'
import path from 'node:path'
import { createCanvas, loadImage } from 'canvas'

globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`Unsupported element: ${tag}`)
    return createCanvas(0, 0)
  },
}

const rootDir = process.cwd()
const overlayPngs = JSON.parse(fs.readFileSync(path.join(rootDir, 'tmp-render-compare', 'overlay-b64.json'), 'utf8'))

const { generateMintPenguinTraits } = await import('../src/mintTraits.js')
const { renderMintTrueSvg } = await import('../src/penguinSvg.js')

function rectTag(x1, y1, x2, y2, fill) {
  return `<rect x="${x1}" y="${y1}" width="${x2 - x1 + 1}" height="${y2 - y1 + 1}" fill="${fill}"/>`
}

function parseHex(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

function mixHex(a, b, t) {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return a
  const mix = (x, y) => Math.round(x + (y - x) * t)
  const toHex = (n) => n.toString(16).padStart(2, '0')
  return `#${toHex(mix(ca.r, cb.r))}${toHex(mix(ca.g, cb.g))}${toHex(mix(ca.b, cb.b))}`
}

function deepenHex(color, factor = 0.9) {
  const parsed = parseHex(color)
  if (!parsed) return color
  const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${toHex(parsed.r * factor)}${toHex(parsed.g * factor)}${toHex(parsed.b * factor)}`
}

function headAccessoryShades(traits) {
  const headColor = traits.head.color || '#404040'
  const headType = traits.head.type || 'none'
  const profile = {
    beanie: { highlight: 0.3, shadow: 0.18, spec: 0.4, mid: 0.24, deep: 0.08, fold: 0.1 },
    cap: { highlight: 0.26, shadow: 0.2, spec: 0.36, mid: 0.26, deep: 0.1, fold: 0.12 },
    scarf: { highlight: 0.24, shadow: 0.16, spec: 0.32, mid: 0.2, deep: 0.06, fold: 0.08 },
    headband: { highlight: 0.26, shadow: 0.17, spec: 0.38, mid: 0.2, deep: 0.07, fold: 0.08 },
    default: { highlight: 0.28, shadow: 0.22, spec: 0.4, mid: 0.28, deep: 0.12, fold: 0.12 },
  }[headType] || { highlight: 0.28, shadow: 0.22, spec: 0.4, mid: 0.28, deep: 0.12, fold: 0.12 }
  const highlight = traits.head.highlight || mixHex(headColor, '#FFFFFF', profile.highlight)
  const shadow = traits.head.shadow || mixHex(headColor, '#000000', profile.shadow)
  return {
    highlight,
    shadow,
    spec: mixHex(highlight, '#FFFFFF', profile.spec),
    mid: mixHex(headColor, shadow, profile.mid),
    deep: mixHex(shadow, '#000000', profile.deep),
    fold: mixHex(headColor, shadow, profile.fold),
  }
}

function renderOnchainLikeSvg(traits, options = {}) {
  const includeManualOutlines = options.includeManualOutlines !== false
  const parts = []
  const push = (x1, y1, x2, y2, fill) => parts.push(rectTag(x1, y1, x2, y2, fill))
  const softDot = (x, y, core, mid, outer) => {
    push(x, y, x, y, core)
    push(x - 1, y, x - 1, y, mid)
    push(x + 1, y, x + 1, y, mid)
    push(x, y - 1, x, y - 1, mid)
    push(x, y + 1, x, y + 1, mid)
    push(x - 1, y - 1, x - 1, y - 1, outer)
    push(x + 1, y - 1, x + 1, y - 1, outer)
    push(x - 1, y + 1, x - 1, y + 1, outer)
    push(x + 1, y + 1, x + 1, y + 1, outer)
  }

  const body = traits.body.base
  const bodyHighlight = traits.body.highlight
  const bodyShadow = traits.body.shadow
  const belly = traits.belly.base
  const bellyHighlight = traits.belly.highlight
  const beak = traits.beak.base
  const beakHighlight = traits.beak.highlight
  const beakShadow = traits.beak.shadow
  const feet = traits.feet.base
  const feetHighlight = traits.feet.highlight
  const feetShadow = traits.feet.shadow
  const cheeks = traits.cheeks?.base || '#FFB6C1'
  const cheeksHighlight = traits.cheeks?.highlight || '#FFC5CD'
  const headType = traits.head.type || 'none'
  const headStyle = traits.head.style || 'imperial'
  const headColor = traits.head.color || '#404040'
  const headShades = headAccessoryShades(traits)
  const cx = 20

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" shape-rendering="crispEdges">`)
  push(0, 0, 39, 39, traits.background.color)

  if (traits.background.fx === 'snowflakes') {
    const core = 'rgba(255,255,255,0.9)'
    const mid = 'rgba(255,255,255,0.35)'
    const outer = 'rgba(255,255,255,0.14)'
    for (const [x, y] of [[3, 4], [10, 7], [32, 5], [36, 10], [6, 33], [14, 35], [29, 32], [35, 27], [2, 20], [38, 22]]) {
      softDot(x, y, core, mid, outer)
      push(x - 2, y, x - 2, y, 'rgba(255,255,255,0.08)')
      push(x + 2, y, x + 2, y, 'rgba(255,255,255,0.08)')
      push(x, y - 2, x, y - 2, 'rgba(255,255,255,0.08)')
      push(x, y + 2, x, y + 2, 'rgba(255,255,255,0.08)')
    }
  } else if (traits.background.fx === 'softdots') {
    const core = 'rgba(255,255,255,0.24)'
    const mid = 'rgba(255,255,255,0.11)'
    const outer = 'rgba(255,255,255,0.05)'
    for (const [x, y] of [[4, 5], [8, 11], [13, 4], [18, 8], [25, 4], [30, 9], [35, 6], [6, 29], [12, 34], [20, 36], [28, 33], [34, 29]]) {
      softDot(x, y, core, mid, outer)
    }
  }

  parts.push('<g transform="translate(5 5) scale(0.75)">')

  for (const args of [
    [2, 26, 5, 32, body], [1, 27, 6, 31, body], [2, 28, 5, 30, bodyHighlight], [3, 29, 5, 29, bodyHighlight],
    [2, 30, 4, 31, bodyShadow], [1, 31, 3, 32, bodyShadow], [1, 30, 3, 33, body], [2, 31, 3, 32, bodyHighlight],
    [5, 31, 7, 33, body], [6, 32, 7, 33, bodyHighlight],
    [34, 26, 37, 32, body], [33, 27, 38, 31, body], [34, 28, 37, 30, bodyHighlight], [34, 29, 36, 29, bodyHighlight],
    [35, 30, 37, 31, bodyShadow], [36, 31, 38, 32, bodyShadow], [36, 30, 38, 33, body], [36, 31, 37, 32, bodyHighlight],
    [32, 31, 34, 33, body], [32, 32, 33, 33, bodyHighlight],
    [8, 25, 31, 38, body], [7, 26, 32, 37, body], [6, 27, 33, 36, body], [6, 28, 33, 35, body],
    [7, 29, 32, 34, body], [8, 30, 31, 33, body], [9, 31, 30, 32, body], [10, 32, 29, 32, body],
    [10, 26, 29, 27, bodyHighlight], [9, 28, 30, 28, bodyHighlight], [10, 30, 29, 30, bodyHighlight], [11, 32, 28, 32, bodyHighlight],
    [8, 38, 31, 38, bodyShadow], [7, 37, 32, 37, bodyShadow], [6, 36, 33, 36, bodyShadow],
    [12, 27, 12, 27, bodyShadow], [28, 27, 28, 27, bodyShadow], [10, 29, 10, 29, bodyShadow], [30, 29, 30, 29, bodyShadow], [8, 31, 8, 31, bodyShadow], [32, 31, 32, 31, bodyShadow],
    [12, 28, 27, 38, belly], [11, 29, 28, 37, belly], [11, 30, 28, 36, belly], [12, 31, 27, 35, belly], [13, 32, 26, 34, belly], [14, 33, 25, 34, belly], [15, 34, 24, 35, belly],
    [14, 29, 25, 30, bellyHighlight], [14, 31, 25, 32, bellyHighlight], [15, 33, 24, 34, bellyHighlight], [15, 35, 15, 35, bellyHighlight], [24, 35, 24, 35, bellyHighlight], [16, 36, 16, 36, bellyHighlight], [23, 36, 23, 36, bellyHighlight],
    [10, 8, 29, 26, body], [9, 9, 30, 25, body], [8, 10, 31, 24, body], [8, 11, 31, 23, body], [9, 12, 30, 22, body], [10, 13, 29, 21, body], [11, 14, 28, 20, body], [12, 15, 27, 19, body], [13, 16, 26, 18, body], [14, 17, 25, 18, body],
    [12, 9, 27, 10, bodyHighlight], [11, 11, 28, 12, bodyHighlight], [12, 13, 27, 14, bodyHighlight], [13, 15, 26, 16, bodyHighlight], [14, 17, 25, 17, bodyHighlight],
    [10, 26, 29, 26, bodyShadow], [9, 25, 30, 25, bodyShadow], [8, 24, 31, 24, bodyShadow], [11, 10, 11, 10, bodyShadow], [28, 10, 28, 10, bodyShadow], [10, 12, 10, 12, bodyShadow], [29, 12, 29, 12, bodyShadow], [10, 14, 10, 14, bodyShadow], [29, 14, 29, 14, bodyShadow],
    [12, 14, 27, 24, belly], [11, 15, 28, 23, belly], [12, 16, 27, 22, belly], [13, 17, 26, 21, belly], [14, 18, 25, 20, belly], [15, 19, 24, 20, belly],
    [14, 15, 25, 16, bellyHighlight], [14, 17, 25, 18, bellyHighlight], [15, 19, 24, 20, bellyHighlight],
  ]) push(...args)

  const eyeY = 17
  if (traits.eyes.type === 'round' || traits.eyes.type === 'sparkle') {
    for (const args of [[cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A'], [cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A'], [cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A'], [cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A']]) push(...args)
  } else if (traits.eyes.type === 'happy') {
    for (const args of [[cx - 5, eyeY, cx - 2, eyeY + 1, '#0A0A0A'], [cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A'], [cx + 2, eyeY, cx + 5, eyeY + 1, '#0A0A0A'], [cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A']]) push(...args)
  } else if (traits.eyes.type === 'sad') {
    for (const args of [[cx - 4, eyeY, cx - 3, eyeY, '#0A0A0A'], [cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A'], [cx + 3, eyeY, cx + 4, eyeY, '#0A0A0A'], [cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A']]) push(...args)
  } else if (traits.eyes.type === 'angry') {
    for (const args of [[cx - 4, eyeY, cx - 3, eyeY, '#0A0A0A'], [cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A'], [cx - 3, eyeY, cx - 3, eyeY, '#FF0000'], [cx + 3, eyeY, cx + 4, eyeY, '#0A0A0A'], [cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A'], [cx + 4, eyeY, cx + 4, eyeY, '#FF0000']]) push(...args)
  } else if (traits.eyes.type === 'sleepy') {
    for (const args of [[cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A'], [cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A'], [cx - 4, eyeY + 2, cx - 3, eyeY + 2, '#0A0A0A'], [cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A'], [cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A'], [cx + 3, eyeY + 2, cx + 4, eyeY + 2, '#0A0A0A']]) push(...args)
  } else if (traits.eyes.type === 'surprised') {
    for (const args of [[cx - 5, eyeY, cx - 2, eyeY + 1, '#0A0A0A'], [cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A'], [cx + 2, eyeY, cx + 5, eyeY + 1, '#0A0A0A'], [cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A']]) push(...args)
  } else if (traits.eyes.type === 'wink') {
    for (const args of [[cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A'], [cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A'], [cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A']]) push(...args)
  } else if (traits.eyes.type === 'sideeye') {
    for (const args of [[cx - 5, eyeY, cx - 3, eyeY + 1, '#0A0A0A'], [cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A'], [cx + 3, eyeY, cx + 5, eyeY + 1, '#0A0A0A'], [cx + 4, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A']]) push(...args)
  } else if (traits.eyes.type === 'closed') {
    for (const args of [[cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A'], [cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A']]) push(...args)
  }

  for (const args of [[cx - 7, 14, cx - 3, 14, bodyShadow], [cx + 3, 14, cx + 7, 14, bodyShadow], [cx - 8, 13, cx - 4, 13, bodyShadow], [cx + 4, 13, cx + 8, 13, bodyShadow]]) push(...args)

  if (traits.beak.type === 'small') {
    for (const args of [[cx - 2, 21, cx + 1, 23, beak], [cx - 1, 20, cx, 22, beak], [cx - 1, 22, cx, 22, beakShadow]]) push(...args)
  } else if (traits.beak.type === 'large') {
    for (const args of [[cx - 3, 20, cx + 2, 23, beak], [cx - 2, 19, cx + 1, 22, beak], [cx - 1, 18, cx, 20, beak], [cx - 2, 23, cx + 1, 23, beakShadow]]) push(...args)
  } else if (traits.beak.type === 'wide') {
    for (const args of [[cx - 4, 21, cx + 3, 23, beak], [cx - 3, 20, cx + 2, 24, beak], [cx - 2, 20, cx + 1, 20, beak], [cx - 2, 24, cx + 1, 24, beakShadow]]) push(...args)
  } else if (traits.beak.type === 'pointy') {
    for (const args of [[cx - 2, 21, cx + 1, 23, beak], [cx - 1, 19, cx, 22, beak], [cx, 18, cx, 20, beak], [cx - 1, 23, cx, 23, beakShadow]]) push(...args)
  } else if (traits.beak.type === 'round') {
    for (const args of [[cx - 3, 21, cx + 2, 23, beak], [cx - 2, 20, cx + 1, 24, beak], [cx - 1, 20, cx, 20, beak], [cx - 2, 24, cx + 1, 24, beakShadow]]) push(...args)
  } else {
    for (const args of [[cx - 3, 20, cx + 2, 22, beak], [cx - 2, 19, cx + 1, 21, beakHighlight], [cx - 1, 18, cx, 20, beakHighlight], [cx - 2, 22, cx + 1, 22, beakShadow], [cx + 1, 21, cx + 2, 21, beakShadow]]) push(...args)
  }

  for (const args of [[cx - 9, 19, cx - 7, 21, cheeks], [cx + 7, 19, cx + 9, 21, cheeks], [cx - 8, 20, cx - 7, 20, cheeksHighlight], [cx + 7, 20, cx + 8, 20, cheeksHighlight]]) push(...args)

  if (headType === 'crown') {
    if (headStyle === 'elegant') {
      for (const args of [[cx - 9, 7, cx + 9, 9, '#CDA349'], [cx - 8, 6, cx + 8, 7, '#F6D98A'], [cx - 9, 9, cx + 9, 9, '#775314'], [cx - 7, 4, cx - 5, 7, '#E8C86E'], [cx - 3, 3, cx - 1, 7, '#F1D786'], [cx + 1, 3, cx + 3, 7, '#F1D786'], [cx + 5, 4, cx + 7, 7, '#E8C86E'], [cx - 6, 2, cx - 5, 3, '#FFF5C8'], [cx - 1, 1, cx, 2, '#FFF5C8'], [cx + 5, 2, cx + 6, 3, '#FFF5C8'], [cx - 8, 7, cx - 8, 8, '#8A651F'], [cx + 8, 7, cx + 8, 8, '#8A651F'], [cx - 4, 6, cx - 4, 8, '#8A651F'], [cx + 4, 6, cx + 4, 8, '#8A651F'], [cx - 8, 6, cx + 8, 6, '#FFE4A0'], [cx - 6, 7, cx - 5, 8, '#B80F2E'], [cx - 1, 7, cx, 8, '#0E7EEA'], [cx + 4, 7, cx + 5, 8, '#23A455'], [cx - 2, 5, cx + 1, 6, '#B78A2C']]) push(...args)
    } else {
      for (const args of [[cx - 10, 7, cx + 10, 9, '#C69214'], [cx - 9, 6, cx + 9, 7, '#F2C94C'], [cx - 10, 9, cx + 10, 9, '#7A5200'], [cx - 8, 3, cx - 6, 7, '#E5B93A'], [cx - 5, 4, cx - 3, 7, '#DCAA2D'], [cx - 1, 1, cx + 1, 7, '#F7D55C'], [cx + 3, 4, cx + 5, 7, '#DCAA2D'], [cx + 6, 3, cx + 8, 7, '#E5B93A'], [cx - 7, 2, cx - 6, 3, '#FFF3B0'], [cx, 0, cx, 2, '#FFF3B0'], [cx + 6, 2, cx + 7, 3, '#FFF3B0'], [cx - 9, 6, cx - 9, 8, '#8A6108'], [cx + 9, 6, cx + 9, 8, '#8A6108'], [cx - 4, 6, cx - 4, 7, '#8A6108'], [cx + 4, 6, cx + 4, 7, '#8A6108'], [cx - 8, 6, cx + 8, 6, '#FFD76A'], [cx - 7, 7, cx - 6, 8, '#B80F2E'], [cx - 1, 7, cx, 8, '#0E7EEA'], [cx + 5, 7, cx + 6, 8, '#23A455'], [cx - 2, 5, cx + 2, 6, '#BF8F1A']]) push(...args)
    }
  } else if (headType === 'beanie') {
    for (const args of [[cx - 10, 7, cx + 9, 10, headColor], [cx - 9, 5, cx + 8, 7, headShades.highlight], [cx - 7, 3, cx + 6, 6, headColor], [cx - 4, 2, cx + 3, 3, headShades.spec], [cx - 10, 10, cx + 9, 10, headShades.shadow], [cx - 9, 9, cx + 8, 9, headShades.fold], [cx - 8, 8, cx + 7, 8, headShades.mid], [cx - 6, 4, cx - 6, 10, headShades.mid], [cx - 3, 4, cx - 3, 10, headShades.shadow], [cx, 4, cx, 10, headShades.mid], [cx + 3, 4, cx + 3, 10, headShades.shadow], [cx + 6, 4, cx + 6, 10, headShades.mid], [cx - 5, 6, cx - 5, 8, headShades.spec], [cx + 1, 6, cx + 1, 8, headShades.spec], [cx - 2, 10, cx + 1, 10, headShades.deep], [cx - 7, 3, cx - 6, 3, headShades.spec], [cx + 4, 3, cx + 5, 3, headShades.spec]]) push(...args)
  } else if (headType === 'cap') {
    for (const args of [[cx - 11, 7, cx + 9, 9, headColor], [cx - 10, 6, cx + 8, 7, headShades.highlight], [cx - 8, 5, cx + 5, 6, headShades.spec], [cx - 10, 8, cx + 8, 8, headShades.mid], [cx - 10, 9, cx + 8, 9, headShades.shadow], [cx - 2, 8, cx + 5, 8, headShades.deep], [cx - 1, 7, cx + 3, 7, headShades.highlight], [cx + 8, 8, cx + 12, 11, headShades.shadow], [cx + 9, 9, cx + 12, 10, headColor], [cx + 10, 10, cx + 11, 11, headShades.deep], [cx - 12, 8, cx - 8, 9, headShades.shadow], [cx - 11, 9, cx - 10, 10, headShades.deep], [cx + 9, 11, cx + 11, 11, '#111111'], [cx - 8, 9, cx + 3, 9, headShades.deep], [cx - 7, 6, cx - 6, 7, headShades.spec], [cx + 4, 6, cx + 5, 7, headShades.mid], [cx + 8, 10, cx + 10, 11, '#121212']]) push(...args)
  } else if (headType === 'scarf') {
    for (const args of [[cx - 10, 25, cx + 10, 28, headColor], [cx - 9, 24, cx + 9, 26, headShades.highlight], [cx + 8, 25, cx + 11, 33, headColor], [cx + 9, 26, cx + 10, 32, headShades.highlight], [cx - 3, 26, cx + 2, 27, headShades.fold], [cx - 2, 27, cx + 1, 28, headShades.shadow]]) push(...args)
  } else if (headType === 'halo') {
    for (const args of [[cx - 4, 3, cx + 3, 4, '#E8BF2F'], [cx - 5, 4, cx + 4, 5, '#D1A91E'], [cx - 3, 2, cx + 2, 3, '#FFE27A'], [cx - 5, 5, cx + 4, 5, '#AD8614'], [cx - 2, 2, cx - 1, 2, '#FFF1A3'], [cx + 1, 2, cx + 2, 2, '#FFF1A3']]) push(...args)
  } else if (headType === 'headband') {
    for (const args of [[cx - 11, 6, cx + 10, 9, headColor], [cx - 10, 5, cx + 9, 6, headShades.spec], [cx - 11, 9, cx + 10, 9, headShades.shadow], [cx - 10, 8, cx + 9, 8, headShades.mid], [cx - 9, 7, cx + 8, 7, headShades.fold], [cx - 8, 6, cx - 7, 8, headShades.highlight], [cx - 4, 6, cx - 3, 8, headShades.highlight], [cx, 6, cx + 1, 8, headShades.highlight], [cx + 4, 6, cx + 5, 8, headShades.highlight], [cx + 8, 6, cx + 9, 8, headShades.highlight], [cx - 2, 5, cx + 1, 6, headShades.spec], [cx + 2, 7, cx + 3, 8, headShades.deep], [cx - 6, 8, cx - 6, 9, headShades.deep], [cx + 6, 8, cx + 6, 9, headShades.deep], [cx - 10, 9, cx - 10, 9, headShades.deep], [cx + 9, 9, cx + 10, 9, headShades.deep], [cx - 1, 9, cx, 9, headShades.deep], [cx + 9, 7, cx + 9, 8, headShades.deep], [cx - 11, 7, cx - 11, 8, headShades.deep], [cx - 3, 10, cx + 2, 10, 'rgba(0,0,0,0.16)']]) push(...args)
  }

  if (headType !== 'none' && headType !== 'scarf') push(cx - 8, 10, cx + 8, 10, 'rgba(0,0,0,0.12)')

  for (const args of [
    [10, 36, 14, 37, feet], [9, 37, 15, 37, feet], [11, 35, 13, 36, feetHighlight], [11, 37, 14, 37, feetShadow], [12, 37, 14, 38, feet], [12, 37, 13, 38, feetHighlight], [8, 37, 10, 38, feet], [9, 38, 10, 38, feetHighlight],
    [25, 36, 29, 37, feet], [24, 37, 30, 37, feet], [26, 35, 28, 36, feetHighlight], [25, 37, 28, 37, feetShadow], [25, 37, 27, 38, feet], [26, 37, 27, 38, feetHighlight], [29, 37, 31, 38, feet], [29, 38, 30, 38, feetHighlight],
  ]) push(...args)

  if (includeManualOutlines) {
    const bodyEdge = deepenHex(body)
    const bodyHighlightEdge = deepenHex(bodyHighlight)
    const bodyShadowEdge = deepenHex(bodyShadow)
    const bellyEdge = deepenHex(belly)
    const beakEdge = deepenHex(beak)
    const beakHighlightEdge = deepenHex(beakHighlight)
    const beakShadowEdge = deepenHex(beakShadow)
    const cheeksEdge = deepenHex(cheeks)
    const headEdge = deepenHex(headColor)
    const headHighlightEdge = deepenHex(headShades.highlight)
    const headShadowEdge = deepenHex(headShades.shadow)
    const feetEdge = deepenHex(feet)
    const feetHighlightEdge = deepenHex(feetHighlight)
    const feetShadowEdge = deepenHex(feetShadow)

    for (const args of [
      [10, 8, 29, 8, bodyEdge], [9, 9, 9, 25, bodyEdge], [30, 9, 30, 25, bodyEdge], [8, 10, 8, 24, bodyEdge], [31, 10, 31, 24, bodyEdge], [7, 25, 7, 35, bodyEdge], [32, 25, 32, 35, bodyEdge], [7, 36, 7, 38, bodyShadowEdge], [32, 36, 32, 38, bodyShadowEdge], [8, 38, 31, 38, bodyShadowEdge], [2, 26, 2, 29, bodyEdge], [34, 26, 34, 29, bodyEdge], [1, 27, 1, 30, bodyEdge], [38, 27, 38, 30, bodyEdge], [1, 31, 1, 31, bodyShadowEdge], [38, 31, 38, 31, bodyShadowEdge], [2, 32, 2, 32, bodyShadowEdge], [34, 32, 34, 32, bodyShadowEdge],
      [3, 26, 5, 26, bodyEdge], [2, 27, 2, 29, bodyHighlightEdge], [1, 27, 1, 30, bodyEdge], [1, 31, 3, 31, bodyShadowEdge], [2, 32, 3, 32, bodyHighlightEdge], [4, 32, 4, 32, bodyShadowEdge], [5, 31, 7, 31, bodyEdge], [6, 32, 7, 33, bodyHighlightEdge], [34, 26, 36, 26, bodyEdge], [37, 27, 37, 29, bodyHighlightEdge], [38, 27, 38, 30, bodyEdge], [35, 31, 37, 31, bodyShadowEdge], [36, 32, 37, 32, bodyHighlightEdge], [35, 32, 35, 32, bodyShadowEdge], [32, 31, 34, 31, bodyEdge], [32, 32, 33, 33, bodyHighlightEdge],
      [12, 14, 27, 14, bellyEdge], [11, 15, 11, 23, bellyEdge], [28, 15, 28, 23, bellyEdge], [12, 24, 27, 24, bellyEdge], [12, 25, 27, 25, bellyEdge], [12, 26, 12, 38, bellyEdge], [27, 26, 27, 38, bellyEdge], [13, 38, 26, 38, bellyEdge],
    ]) push(...args)

    if (traits.beak.type === 'small') {
      for (const args of [[cx - 1, 20, cx, 20, beakEdge], [cx - 2, 21, cx - 2, 23, beakEdge], [cx + 1, 21, cx + 1, 23, beakEdge], [cx - 1, 23, cx, 23, beakShadowEdge]]) push(...args)
    } else if (traits.beak.type === 'large') {
      for (const args of [[cx - 1, 18, cx, 18, beakEdge], [cx - 2, 19, cx - 2, 23, beakEdge], [cx + 1, 19, cx + 1, 23, beakEdge], [cx - 1, 23, cx, 23, beakShadowEdge]]) push(...args)
    } else if (traits.beak.type === 'wide') {
      for (const args of [[cx - 2, 20, cx + 1, 20, beakEdge], [cx - 3, 21, cx - 3, 23, beakEdge], [cx + 3, 21, cx + 3, 23, beakEdge], [cx - 2, 24, cx + 1, 24, beakShadowEdge]]) push(...args)
    } else if (traits.beak.type === 'pointy') {
      for (const args of [[cx, 18, cx, 18, beakEdge], [cx - 1, 19, cx - 1, 23, beakEdge], [cx + 1, 21, cx + 1, 23, beakEdge], [cx, 23, cx, 23, beakShadowEdge]]) push(...args)
    } else if (traits.beak.type === 'round') {
      for (const args of [[cx - 1, 20, cx, 20, beakEdge], [cx - 2, 21, cx - 2, 24, beakEdge], [cx + 1, 21, cx + 1, 24, beakEdge], [cx - 1, 24, cx, 24, beakShadowEdge]]) push(...args)
    } else {
      for (const args of [[cx - 1, 18, cx, 18, beakHighlightEdge], [cx - 2, 19, cx - 2, 22, beakHighlightEdge], [cx + 1, 20, cx + 2, 20, beakShadowEdge], [cx + 2, 21, cx + 2, 21, beakShadowEdge], [cx - 1, 22, cx, 22, beakShadowEdge]]) push(...args)
    }

    for (const args of [[cx - 9, 19, cx - 7, 19, cheeksEdge], [cx - 9, 20, cx - 9, 21, cheeksEdge], [cx - 7, 20, cx - 7, 21, cheeksEdge], [cx - 8, 21, cx - 8, 21, cheeksEdge], [cx + 7, 19, cx + 9, 19, cheeksEdge], [cx + 7, 20, cx + 7, 21, cheeksEdge], [cx + 9, 20, cx + 9, 21, cheeksEdge], [cx + 8, 21, cx + 8, 21, cheeksEdge]]) push(...args)

    if (headType === 'scarf') {
      for (const args of [[cx - 10, 25, cx + 7, 25, headEdge], [cx + 8, 25, cx + 10, 25, headHighlightEdge], [cx - 10, 26, cx - 10, 28, headEdge], [cx + 10, 26, cx + 10, 32, headHighlightEdge], [cx + 8, 33, cx + 11, 33, headEdge], [cx + 11, 25, cx + 11, 33, headEdge], [cx - 2, 27, cx + 1, 28, headShadowEdge]]) push(...args)
    } else if (headType === 'cap') {
      for (const args of [[cx - 11, 7, cx - 2, 7, headEdge], [cx - 1, 7, cx + 3, 7, headHighlightEdge], [cx + 4, 7, cx + 9, 7, headEdge], [cx - 11, 8, cx - 11, 9, headEdge], [cx + 9, 8, cx + 9, 9, headEdge], [cx + 12, 8, cx + 12, 11, headShadowEdge], [cx - 12, 8, cx - 12, 9, headShadowEdge]]) push(...args)
    } else if (headType === 'beanie') {
      for (const args of [[cx - 7, 3, cx - 5, 3, headHighlightEdge], [cx - 4, 3, cx + 3, 3, deepenHex('#FFFFFF')], [cx + 4, 3, cx + 6, 3, headHighlightEdge], [cx - 9, 5, cx - 9, 10, headHighlightEdge], [cx + 8, 5, cx + 8, 10, headHighlightEdge], [cx - 10, 10, cx - 3, 10, headShadowEdge], [cx - 2, 10, cx + 1, 10, headShadowEdge], [cx + 2, 10, cx + 9, 10, headShadowEdge]]) push(...args)
    } else if (headType === 'headband') {
      for (const args of [[cx - 11, 6, cx - 3, 6, headEdge], [cx - 2, 6, cx + 1, 6, headHighlightEdge], [cx + 2, 6, cx + 10, 6, headEdge], [cx - 11, 7, cx - 11, 9, headShadowEdge], [cx + 10, 7, cx + 10, 9, headShadowEdge], [cx - 11, 9, cx + 10, 9, headShadowEdge]]) push(...args)
    }

    for (const args of [[11, 35, 13, 35, feetHighlightEdge], [10, 36, 10, 36, feetEdge], [14, 36, 14, 36, feetEdge], [9, 37, 9, 37, feetEdge], [15, 37, 15, 37, feetEdge], [8, 38, 8, 38, feetEdge], [9, 38, 10, 38, feetHighlightEdge], [12, 38, 13, 38, feetHighlightEdge], [14, 38, 14, 38, feetEdge], [26, 35, 28, 35, feetHighlightEdge], [25, 36, 25, 36, feetEdge], [29, 36, 29, 36, feetEdge], [24, 37, 24, 37, feetEdge], [30, 37, 30, 37, feetEdge], [25, 38, 25, 38, feetEdge], [26, 38, 27, 38, feetHighlightEdge], [29, 38, 30, 38, feetHighlightEdge], [31, 38, 31, 38, feetEdge], [11, 37, 14, 37, feetShadowEdge], [25, 37, 28, 37, feetShadowEdge]]) push(...args)
  }

  for (const args of [[7, 39, 32, 39, 'rgba(0,0,0,0.08)'], [9, 39, 30, 39, 'rgba(0,0,0,0.14)'], [11, 39, 28, 39, 'rgba(0,0,0,0.20)'], [14, 39, 25, 39, 'rgba(0,0,0,0.12)']]) push(...args)

  parts.push('</g>')
  parts.push('</svg>')
  return parts.join('')
}

function ensureSvgSize(svg, size) {
  return /<svg[^>]*width=/.test(svg)
    ? svg
    : svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
}

async function rasterizeSvg(svg, size = 256) {
  const image = await loadImage(Buffer.from(ensureSvgSize(svg, size)))
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(image, 0, 0, size, size)
  return { canvas, data: ctx.getImageData(0, 0, size, size).data }
}

function diffPixels(a, b) {
  const diffCanvas = createCanvas(256, 256)
  const diffCtx = diffCanvas.getContext('2d')
  const imageData = diffCtx.createImageData(256, 256)
  let differentPixels = 0
  for (let i = 0; i < a.length; i += 4) {
    const changed = a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]
    if (changed) {
      differentPixels += 1
      imageData.data[i] = 255
      imageData.data[i + 1] = 0
      imageData.data[i + 2] = 0
      imageData.data[i + 3] = 255
    }
  }
  diffCtx.putImageData(imageData, 0, 0)
  return { differentPixels, diffCanvas }
}

function applySilhouetteOutline(imageData) {
  const outlined = new Uint8ClampedArray(imageData.data)
  const background = {
    r: imageData.data[0],
    g: imageData.data[1],
    b: imageData.data[2],
    a: imageData.data[3],
  }
  const hasMask = (x, y) => {
    if (x < 0 || x >= 256 || y < 0 || y >= 256) return false
    const index = (y * 256 + x) * 4
    return outlined[index + 3] > 0 && !(
      outlined[index] === background.r &&
      outlined[index + 1] === background.g &&
      outlined[index + 2] === background.b &&
      outlined[index + 3] === background.a
    )
  }

  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      if (!hasMask(x, y)) continue
      const touchesOutside =
        !hasMask(x - 1, y) ||
        !hasMask(x + 1, y) ||
        !hasMask(x, y - 1) ||
        !hasMask(x, y + 1)
      if (!touchesOutside) continue
      const index = (y * 256 + x) * 4
      outlined[index] = Math.round(outlined[index] * 0.9)
      outlined[index + 1] = Math.round(outlined[index + 1] * 0.9)
      outlined[index + 2] = Math.round(outlined[index + 2] * 0.9)
    }
  }

  return outlined
}

function scaleCanvas(sourceCanvas, size = 256) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sourceCanvas, 0, 0, size, size)
  return canvas
}

function traitSummary(traits) {
  return {
    background: traits.background.name,
    body: traits.body.name,
    belly: traits.belly.name,
    beak: traits.beak.name,
    eyes: traits.eyes.name,
    head: traits.head.name,
    feet: traits.feet.name,
  }
}

function outlineKeyForTraits(traits) {
  if (traits.head.type === 'cap') return 'CAP'
  if (traits.head.type === 'beanie') return 'BEANIE'
  if (traits.head.type === 'scarf') return 'SCARF'
  if (traits.head.type === 'headband') return 'HEADBAND'
  if (traits.head.type === 'halo') return 'HALO'
  if (traits.head.type === 'crown') return traits.head.style === 'elegant' ? 'CROWN_ELEGANT' : 'CROWN_IMPERIAL'
  return 'NONE'
}

async function renderCurrentOnchainCanvas(traits) {
  const baseSvg = renderOnchainLikeSvg(traits, { includeManualOutlines: false })
  const base = await rasterizeSvg(baseSvg)
  const canvas = createCanvas(256, 256)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, 256, 256)
  ctx.drawImage(base.canvas, 0, 0)

  const outlineKey = outlineKeyForTraits(traits)
  const outlineImage = await loadImage(`data:image/png;base64,${overlayPngs[outlineKey]}`)
  ctx.drawImage(outlineImage, 0, 0, 256, 256)

  return {
    canvas,
    data: ctx.getImageData(0, 0, 256, 256).data,
    baseSvg,
    outlineKey,
  }
}

const sampleCount = Math.max(1, Number(process.argv[2] || 10))
let worst = null
let worstNoOutline = null

for (let i = 0; i < sampleCount; i += 1) {
  const traits = generateMintPenguinTraits()
  const frontendSvg = renderMintTrueSvg(traits)
  const baseSvg = renderOnchainLikeSvg(traits, { includeManualOutlines: false })
  const frontend = await rasterizeSvg(frontendSvg)
  const base = await rasterizeSvg(baseSvg)
  const current = await renderCurrentOnchainCanvas(traits)
  const diff = diffPixels(frontend.data, current.data)
  const noOutlineDiff = diffPixels(frontend.data, base.data)
  if (!worst || diff.differentPixels > worst.differentPixels) {
    worst = {
      traits,
      frontendSvg,
      baseSvg: current.baseSvg,
      frontendCanvas: frontend.canvas,
      onchainCanvas: current.canvas,
      diffCanvas: diff.diffCanvas,
      differentPixels: diff.differentPixels,
      outlineKey: current.outlineKey,
    }
  }
  if (!worstNoOutline || noOutlineDiff.differentPixels > worstNoOutline.differentPixels) {
    worstNoOutline = {
      traits,
      frontendCanvas: frontend.canvas,
      baseCanvas: base.canvas,
      diffCanvas: noOutlineDiff.diffCanvas,
      baseSvg,
      frontendSvg,
      differentPixels: noOutlineDiff.differentPixels,
    }
  }
  console.log(`sample ${i + 1}/${sampleCount}: current=${diff.differentPixels} px, no-outline=${noOutlineDiff.differentPixels} px, outline=${current.outlineKey}`)
}

if (!worst) process.exit(1)

const artifactDir = path.join(rootDir, 'tmp-render-compare')
fs.mkdirSync(artifactDir, { recursive: true })
fs.writeFileSync(path.join(artifactDir, 'frontend.svg'), worst.frontendSvg)
fs.writeFileSync(path.join(artifactDir, 'onchain.svg'), worst.baseSvg)
fs.writeFileSync(path.join(artifactDir, 'frontend.png'), worst.frontendCanvas.toBuffer('image/png'))
fs.writeFileSync(path.join(artifactDir, 'onchain.png'), worst.onchainCanvas.toBuffer('image/png'))
fs.writeFileSync(path.join(artifactDir, 'diff.png'), worst.diffCanvas.toBuffer('image/png'))
if (worstNoOutline) {
  fs.writeFileSync(path.join(artifactDir, 'frontend-no-outline.svg'), worstNoOutline.frontendSvg)
  fs.writeFileSync(path.join(artifactDir, 'onchain-no-outline.svg'), worstNoOutline.baseSvg)
  fs.writeFileSync(path.join(artifactDir, 'onchain-no-outline.png'), worstNoOutline.baseCanvas.toBuffer('image/png'))
  fs.writeFileSync(path.join(artifactDir, 'diff-no-outline.png'), worstNoOutline.diffCanvas.toBuffer('image/png'))
}
fs.writeFileSync(path.join(artifactDir, 'traits.json'), JSON.stringify(traitSummary(worst.traits), null, 2))

console.log(`worst current diff: ${worst.differentPixels} px`)
console.log(`worst no-outline diff: ${worstNoOutline?.differentPixels ?? 'n/a'} px`)
console.log(`worst outline key: ${worst.outlineKey}`)
console.log(`artifacts: ${artifactDir}`)
console.log(JSON.stringify(traitSummary(worst.traits), null, 2))
