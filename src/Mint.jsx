import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import './Mint.css'

const CONTRACT_ADDRESS = '0x80221b01c8eB071E553D21D5cE96442402B131b4'
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

const contractABI = [
  "function mint(uint256 quantity, string[] calldata imageBase64s, string[] calldata names, string[] calldata attributesJson, uint256[] calldata rarityScores) public payable",
  "function balanceOf(address owner) public view returns (uint256)",
  "function totalSupply() public view returns (uint256)",
  "function mintActive() public view returns (bool)",
  "function MAX_SUPPLY() public view returns (uint256)",
  "function MAX_PER_WALLET() public view returns (uint256)",
  "function mintedPerWallet(address owner) public view returns (uint256)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function tokenSeeds(uint256 tokenId) public view returns (uint256)",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "function tokenRarityScore(uint256 tokenId) public view returns (uint256)",
  "function rarityRank(uint256 tokenId) public view returns (uint256)",
  "function tokenMetadataJson(uint256 tokenId) public view returns (string)"
]

function normalizeOnchainImage(image) {
  if (!image || typeof image !== 'string') return ''
  if (image.startsWith('data:image/')) return image
  if (image.startsWith('<svg')) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(image)}`
  }
  if (image.startsWith('ipfs://')) {
    return image.replace('ipfs://', 'https://ipfs.io/ipfs/')
  }
  return image
}

function decodeBase64Loose(input) {
  const cleaned = String(input || '')
    .trim()
    .replace(/^base64,/, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[^A-Za-z0-9+/=]/g, '')

  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4)

  try {
    return atob(padded)
  } catch {
    // Fallback manual base64 decode.
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    let str = ''
    let buffer = 0
    let bits = 0

    for (let i = 0; i < padded.length; i++) {
      const ch = padded[i]
      if (ch === '=') break
      const idx = chars.indexOf(ch)
      if (idx < 0) continue
      buffer = (buffer << 6) | idx
      bits += 6
      if (bits >= 8) {
        bits -= 8
        str += String.fromCharCode((buffer >> bits) & 0xff)
      }
    }
    return str
  }
}

function extractImageFromMetadataString(raw) {
  if (!raw || typeof raw !== 'string') return ''

  try {
    const parsed = JSON.parse(raw)
    return normalizeOnchainImage(parsed.image)
  } catch {
    const marker = '"image":"'
    const start = raw.indexOf(marker)
    if (start === -1) return ''
    const from = raw.slice(start + marker.length)

    const candidates = ['","attributes"', '","description"', '"}']
    let end = -1
    for (const c of candidates) {
      const idx = from.indexOf(c)
      if (idx !== -1 && (end === -1 || idx < end)) end = idx
    }
    if (end === -1) return ''

    const image = from.slice(0, end).replace(/\\"/g, '"')
    return normalizeOnchainImage(image)
  }
}

function generateSVGFromTraits(traits) {
  const scale = 9
  const width = 400
  const height = 400
  const offsetX = 2
  const offsetY = 1
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 ${width} ${height}">`
  
  svg += `<rect width="${width}" height="${height}" fill="${traits.background.color}"/>`
  
  const rectToSvg = (x1, y1, x2, y2, color) => {
    const rx = (x1 + offsetX) * scale
    const ry = (y1 + offsetY) * scale
    const rw = (x2 - x1 + 1) * scale
    const rh = (y2 - y1 + 1) * scale
    return `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${color}"/>`
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
  
  // Body
  svg += rectToSvg(8, 25, 31, 38, body)
  svg += rectToSvg(7, 26, 32, 37, body)
  svg += rectToSvg(6, 27, 33, 36, body)
  svg += rectToSvg(6, 28, 33, 35, body)
  svg += rectToSvg(7, 29, 32, 34, body)
  svg += rectToSvg(8, 30, 31, 33, body)
  svg += rectToSvg(9, 31, 30, 32, body)
  svg += rectToSvg(10, 32, 29, 32, body)
  
  // Body highlights
  svg += rectToSvg(10, 26, 29, 27, bodyHighlight)
  svg += rectToSvg(9, 28, 30, 28, bodyHighlight)
  svg += rectToSvg(10, 30, 29, 30, bodyHighlight)
  svg += rectToSvg(11, 32, 28, 32, bodyHighlight)
  
  // Body shadows
  svg += rectToSvg(8, 38, 31, 38, bodyShadow)
  svg += rectToSvg(7, 37, 32, 37, bodyShadow)
  svg += rectToSvg(6, 36, 33, 36, bodyShadow)
  
  // Belly
  svg += rectToSvg(12, 27, 27, 38, belly)
  svg += rectToSvg(11, 28, 28, 37, belly)
  svg += rectToSvg(11, 29, 28, 36, belly)
  svg += rectToSvg(12, 30, 27, 35, belly)
  svg += rectToSvg(13, 31, 26, 34, belly)
  svg += rectToSvg(14, 32, 25, 33, belly)
  svg += rectToSvg(15, 33, 24, 33, belly)
  
  // Belly highlights
  svg += rectToSvg(14, 29, 25, 30, bellyHighlight)
  svg += rectToSvg(14, 31, 25, 32, bellyHighlight)
  svg += rectToSvg(15, 33, 24, 34, bellyHighlight)
  
  // Head
  svg += rectToSvg(8, 10, 31, 26, body)
  svg += rectToSvg(9, 9, 30, 27, body)
  svg += rectToSvg(10, 8, 29, 28, body)
  svg += rectToSvg(10, 10, 29, 27, bodyHighlight)
  
  // Face panel
  svg += rectToSvg(12, 14, 27, 24, belly)
  svg += rectToSvg(13, 15, 26, 23, bellyHighlight)
  
  // Eyes
  const eyeType = traits.eyes?.type || 'round'
  if (eyeType === 'angry') {
    svg += rectToSvg(13, 15, 15, 15, '#0A0A0A')
    svg += rectToSvg(24, 15, 26, 15, '#0A0A0A')
  } else if (eyeType === 'sleepy' || eyeType === 'closed') {
    svg += rectToSvg(13, 16, 16, 16, '#0A0A0A')
    svg += rectToSvg(23, 16, 26, 16, '#0A0A0A')
  } else if (eyeType === 'wink') {
    svg += rectToSvg(13, 16, 16, 16, '#0A0A0A')
    svg += rectToSvg(24, 15, 26, 16, '#0A0A0A')
  } else {
    svg += rectToSvg(14, 15, 16, 17, '#0A0A0A')
    svg += rectToSvg(23, 15, 25, 17, '#0A0A0A')
  }
  
  // Cheeks
  svg += rectToSvg(10, 18, 12, 19, '#FFB6C1')
  svg += rectToSvg(27, 18, 29, 19, '#FFB6C1')
  
  // Beak
  svg += rectToSvg(17, 18, 22, 20, beak)
  svg += rectToSvg(18, 17, 21, 19, beakHighlight)
  svg += rectToSvg(18, 20, 21, 20, beakShadow)
  
  // Feet
  svg += rectToSvg(10, 39, 15, 40, feet)
  svg += rectToSvg(11, 39, 15, 40, feetHighlight)
  svg += rectToSvg(24, 39, 29, 40, feet)
  svg += rectToSvg(24, 39, 28, 40, feetHighlight)
  
  svg += '</svg>'
  return svg
}

function svgToBase64(svg) {
  return 'data:image/svg+xml;base64,' + btoa(svg)
}

function extractMetadataFromMetadataString(raw) {
  const meta = { name: '', image: '', attributes: [], rarityScore: null, rarityRank: null }
  if (!raw || typeof raw !== 'string') return meta

  try {
    const parsed = JSON.parse(raw)
    meta.name = parsed.name || ''
    meta.image = normalizeOnchainImage(parsed.image || '')
    meta.attributes = Array.isArray(parsed.attributes) ? parsed.attributes : []
    if (Number.isFinite(Number(parsed.rarity_score))) {
      meta.rarityScore = Number(parsed.rarity_score)
    }
    if (Number.isFinite(Number(parsed.rarity_rank))) {
      meta.rarityRank = Number(parsed.rarity_rank)
    }
    if (meta.rarityScore !== null) {
      meta.attributes.push({ trait_type: 'Rarity Score', value: String(meta.rarityScore) })
    }
    if (meta.rarityRank !== null) {
      meta.attributes.push({ trait_type: 'Rarity Rank', value: `#${meta.rarityRank}` })
    }
    return meta
  } catch {
    const nameMarker = '"name":"'
    const nameStart = raw.indexOf(nameMarker)
    if (nameStart !== -1) {
      const rest = raw.slice(nameStart + nameMarker.length)
      const end = rest.indexOf('"')
      if (end !== -1) meta.name = rest.slice(0, end).replace(/\\"/g, '"')
    }

    meta.image = extractImageFromMetadataString(raw)

    const attrsMarker = '"attributes":'
    const attrsStart = raw.indexOf(attrsMarker)
    if (attrsStart !== -1) {
      const rest = raw.slice(attrsStart + attrsMarker.length)
      const end = rest.lastIndexOf('}')
      const rawAttrs = end > 0 ? rest.slice(0, end) : rest
      try {
        const parsedAttrs = JSON.parse(rawAttrs)
        meta.attributes = Array.isArray(parsedAttrs) ? parsedAttrs : []
      } catch {
        meta.attributes = []
      }
    }

    const scoreMatch = raw.match(/"rarity_score"\s*:\s*(\d+)/)
    const rankMatch = raw.match(/"rarity_rank"\s*:\s*(\d+)/)
    if (scoreMatch) meta.rarityScore = Number(scoreMatch[1])
    if (rankMatch) meta.rarityRank = Number(rankMatch[1])
    if (meta.rarityScore !== null) {
      meta.attributes.push({ trait_type: 'Rarity Score', value: String(meta.rarityScore) })
    }
    if (meta.rarityRank !== null) {
      meta.attributes.push({ trait_type: 'Rarity Rank', value: `#${meta.rarityRank}` })
    }

    return meta
  }
}

async function fetchOnchainMetadataFromTokenURI(tokenId) {
  const providers = []
  if (typeof window !== 'undefined' && window.ethereum) {
    providers.push(new ethers.BrowserProvider(window.ethereum))
  }
  providers.push(new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC))

  let lastError = null

  for (const provider of providers) {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
    try {
      try {
        const rawJson = await contract.tokenMetadataJson(tokenId)
        if (rawJson && typeof rawJson === 'string' && rawJson.startsWith('{')) {
          const meta = extractMetadataFromMetadataString(rawJson)
          if (meta.image) return meta
        }
      } catch {}

      const tokenUri = await contract.tokenURI(tokenId)

      if (tokenUri.startsWith('data:application/json;base64,')) {
        const base64Data = tokenUri.replace('data:application/json;base64,', '')
        const jsonStr = decodeBase64Loose(base64Data)
        const meta = extractMetadataFromMetadataString(jsonStr)
        if (!meta.image) throw new Error('Missing image in token metadata')
        return meta
      }

      if (tokenUri.startsWith('data:application/json;utf8,')) {
        const jsonStr = decodeURIComponent(tokenUri.replace('data:application/json;utf8,', ''))
        const meta = extractMetadataFromMetadataString(jsonStr)
        if (!meta.image) throw new Error('Missing image in token metadata')
        return meta
      }

      if (tokenUri.startsWith('http://') || tokenUri.startsWith('https://') || tokenUri.startsWith('ipfs://')) {
        const metadataUrl = tokenUri.startsWith('ipfs://')
          ? tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
          : tokenUri
        const res = await fetch(metadataUrl)
        if (!res.ok) throw new Error('Failed to fetch token metadata')
        const json = await res.json()
        const meta = {
          name: json.name || '',
          image: normalizeOnchainImage(json.image || ''),
          attributes: Array.isArray(json.attributes) ? json.attributes : []
        }
        if (!meta.image) throw new Error('Missing image in token metadata')
        return meta
      }

      throw new Error('Unsupported tokenURI format')
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Unable to fetch on-chain image')
}

const TRAITS = {
  background: [
    { name: 'Light Blue', color: '#ADD8E6', weight: 12 },
    { name: 'Baby Pink', color: '#F4A6B8', weight: 12 },
    { name: 'Sky Blue', color: '#87CEEB', weight: 12 },
    { name: 'Arctic White', color: '#F8FBFF', weight: 4, fx: 'snowflakes' },
    { name: 'Soft Lavender', color: '#C8B6FF', weight: 10 },
    { name: 'Mint Green', color: '#98FFCC', weight: 10 },
    { name: 'Pastel Pink', color: '#FFD1DC', weight: 10 },
    { name: 'Royal Blue', color: '#4169E1', weight: 4, fx: 'softdots' },
    { name: 'Peach Cream', color: '#FFE5B4', weight: 10 },
    { name: 'Lilac Purple', color: '#D8B4F8', weight: 8 },
    { name: 'Warm Beige', color: '#F5F5DC', weight: 8 },
    { name: 'Coral Red', color: '#FF6B6B', weight: 8 },
    { name: 'Midnight Blue', color: '#1A1A2E', weight: 3, fx: 'snowflakes' },
    { name: 'Sunset Orange', color: '#FF7A18', weight: 8 },
    { name: 'Deep Teal', color: '#0F4C5C', weight: 3, fx: 'softdots' },
    { name: 'Forest Green', color: '#2E8B57', weight: 6 },
    { name: 'Charcoal Gray', color: '#36454F', weight: 6 },
    { name: 'Neon Yellow', color: '#F5FF3B', weight: 5 },
    { name: 'Electric Cyan', color: '#00FFFF', weight: 5 },
    { name: 'Golden Glow', color: '#FFD700', weight: 2, fx: 'softdots' },
    { name: 'Crimson Red', color: '#DC143C', weight: 5 },
  ],
  body: [
    { name: 'Skeleton Dark Bone', base: '#D6CCB8', highlight: '#E8E2D4', shadow: '#9F8B7D', weight: 8 },
    { name: 'Snow White', base: '#F5F5F5', highlight: '#FFFFFF', shadow: '#C2C2C2', weight: 8 },
    { name: 'Jet Black', base: '#1C1C1C', highlight: '#484848', shadow: '#000000', weight: 8 },
    { name: 'Ash Gray', base: '#B2B2B2', highlight: '#D9D9D9', shadow: '#858585', weight: 8 },
    { name: 'Cream', base: '#FFF3D6', highlight: '#FFFFEB', shadow: '#CCC2A3', weight: 8 },
    { name: 'Light Brown', base: '#C68642', highlight: '#E0A86A', shadow: '#8E5C2B', weight: 8 },
    { name: 'Chocolate Brown', base: '#5C3A21', highlight: '#8A6145', shadow: '#3A2514', weight: 8 },
    { name: 'Golden Tan', base: '#D2A679', highlight: '#E8C9A4', shadow: '#9E7856', weight: 8 },
    { name: 'Ice Blue', base: '#CFE9FF', highlight: '#F0F8FF', shadow: '#9FBFCD', weight: 8 },
    { name: 'Baby Blue', base: '#A7C7E7', highlight: '#D4E9F5', shadow: '#7A96B0', weight: 8 },
    { name: 'Ocean Blue', base: '#2B6CB0', highlight: '#5A9AD4', shadow: '#1D4D7E', weight: 8 },
    { name: 'Soft Pink', base: '#F4A6B8', highlight: '#FAD2DD', shadow: '#B77A8B', weight: 8 },
    { name: 'Bubblegum Pink', base: '#FF77AA', highlight: '#FFA5CC', shadow: '#CC4F7D', weight: 8 },
    { name: 'Lavender Body', base: '#BFA2DB', highlight: '#D9C9EB', shadow: '#8F76A4', weight: 8 },
    { name: 'Royal Purple', base: '#6B3FA0', highlight: '#9670BF', shadow: '#4D2A75', weight: 8 },
    { name: 'Mint Body', base: '#A8E6CF', highlight: '#D4F5E8', shadow: '#7DB39C', weight: 8 },
    { name: 'Olive Green', base: '#708238', highlight: '#96A65C', shadow: '#515D27', weight: 8 },
    { name: 'Coral Body', base: '#FF8C69', highlight: '#FFB49B', shadow: '#CC634A', weight: 8 },
    { name: 'Sunset Gold', base: '#E6B422', highlight: '#F0CC57', shadow: '#B38618', weight: 8 },
    { name: 'Glass Style', base: '#E0FFFF', highlight: '#F0FFFF', shadow: '#A8C8C8', weight: 8 },
  ],
  belly: [
    { name: 'Cream', base: '#FDF5E6', highlight: '#FFFAF0', shadow: '#F5E6D3', weight: 45 },
    { name: 'Peach', base: '#FFDAB9', highlight: '#FFE4C4', shadow: '#F5CBA7', weight: 25 },
    { name: 'Light Blue', base: '#D6EAF8', highlight: '#EBF5FB', shadow: '#AED6F1', weight: 15 },
    { name: 'Mint', base: '#D5F5E3', highlight: '#E8F8F5', shadow: '#ABEBC6', weight: 10 },
    { name: 'Lavender', base: '#E8DAEF', highlight: '#F4ECF7', shadow: '#D2B4DE', weight: 5 },
  ],
  beak: [
    { name: 'Small', type: 'small', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 20 },
    { name: 'Large', type: 'large', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 18 },
    { name: 'Wide', type: 'wide', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 15 },
    { name: 'Pointy', type: 'pointy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 15 },
    { name: 'Round', type: 'round', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 15 },
    { name: 'Puffy', type: 'puffy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 12 },
  ],
  eyes: [
    { name: 'Normal', type: 'round', weight: 20 },
    { name: 'Happy', type: 'happy', weight: 15 },
    { name: 'Sad', type: 'sad', weight: 12 },
    { name: 'Angry', type: 'angry', weight: 10 },
    { name: 'Sleepy', type: 'sleepy', weight: 12 },
    { name: 'Surprised', type: 'surprised', weight: 10 },
    { name: 'Wink', type: 'wink', weight: 10 },
    { name: 'Side-eye', type: 'sideeye', weight: 8 },
    { name: 'Closed', type: 'closed', weight: 8 },
    { name: 'Sparkle', type: 'sparkle', weight: 10 },
  ],
  head: [
    { name: 'None', type: 'none', weight: 25 },
    { name: 'Cap Gold', type: 'cap', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00', weight: 8 },
    { name: 'Cap Matte Black', type: 'cap', color: '#2B2B2B', highlight: '#545454', shadow: '#141414', weight: 8 },
    { name: 'Cap Sapphire Blue', type: 'cap', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C', weight: 7 },
    { name: 'Cap Crimson', type: 'cap', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C', weight: 7 },
    { name: 'Cap Royal Gold', type: 'cap', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823', weight: 7 },
    { name: 'Beanie Gold', type: 'beanie', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00', weight: 6 },
    { name: 'Beanie Matte Black', type: 'beanie', color: '#2B2B2B', highlight: '#545454', shadow: '#141414', weight: 6 },
    { name: 'Beanie Sapphire Blue', type: 'beanie', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C', weight: 6 },
    { name: 'Beanie Crimson', type: 'beanie', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C', weight: 6 },
    { name: 'Beanie Royal Gold', type: 'beanie', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823', weight: 6 },
    { name: 'Scarf Gold', type: 'scarf', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00', weight: 5 },
    { name: 'Scarf Matte Black', type: 'scarf', color: '#2B2B2B', highlight: '#545454', shadow: '#141414', weight: 5 },
    { name: 'Scarf Sapphire Blue', type: 'scarf', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C', weight: 5 },
    { name: 'Scarf Crimson', type: 'scarf', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C', weight: 5 },
    { name: 'Scarf Royal Gold', type: 'scarf', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823', weight: 5 },
    { name: 'Headband Gold', type: 'headband', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00', weight: 5 },
    { name: 'Headband Matte Black', type: 'headband', color: '#2B2B2B', highlight: '#545454', shadow: '#141414', weight: 5 },
    { name: 'Headband Sapphire Blue', type: 'headband', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C', weight: 5 },
    { name: 'Headband Crimson', type: 'headband', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C', weight: 5 },
    { name: 'Headband Royal Gold', type: 'headband', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823', weight: 5 },
    { name: 'Crown Imperial', type: 'crown', style: 'imperial', weight: 6 },
    { name: 'Crown Elegant', type: 'crown', style: 'elegant', weight: 4 },
    { name: 'Halo', type: 'halo', weight: 8 },
  ],
  feet: [
    { name: 'Default Orange', type: 'default', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 50 },
    { name: 'Default Pink', type: 'default', base: '#FD79A8', highlight: '#FDCBDF', shadow: '#E84393', weight: 20 },
    { name: 'Default Black', type: 'default', base: '#2D3436', highlight: '#636E72', shadow: '#0D1318', weight: 15 },
    { name: 'Default White', type: 'default', base: '#DFE6E9', highlight: '#FFFFFF', shadow: '#B2BEC3', weight: 15 },
  ],
  name: [
    { name: 'Frosty', weight: 15 },
    { name: 'Waddles', weight: 15 },
    { name: 'Pebble', weight: 12 },
    { name: 'Chilly', weight: 12 },
    { name: 'Snowy', weight: 12 },
    { name: 'Flurry', weight: 10 },
    { name: 'Icee', weight: 10 },
    { name: 'Bubbles', weight: 8 },
    { name: 'Nippy', weight: 8 },
    { name: 'Tuxy', weight: 8 },
  ],
}

function createVoxelPenguin(traits, THREE) {
  const group = new THREE.Group()
  
  const body = traits.body.base
  const bodyHighlight = traits.body.highlight
  const bodyShadow = traits.body.shadow
  const belly = traits.belly.base
  const bellyHighlight = traits.belly.highlight
  const beak = traits.beak.base
  const beakShadow = traits.beak.shadow
  const beakHighlight = traits.beak.highlight
  
  const cx = 20
  const voxelSize = 0.55
  const voxelScale = 0.15
  
  const mat = (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  })
  
  const voxel = (x, y, z, color, depth = 4) => {
    const geo = new RoundedBoxGeometry(voxelSize, voxelSize, depth * voxelScale, 2, 0.05)
    const mesh = new THREE.Mesh(geo, mat(color))
    mesh.position.set(
      (x - cx) * voxelSize * 0.5, 
      (20 - y) * voxelSize * 0.5, 
      (z - 1) * voxelSize * 0.4
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  
  const rect = (x1, y1, x2, y2, color, depth = 4, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        group.add(voxel(x, y, z, color, depth))
      }
    }
  }
  
  const rectFront = (x1, y1, x2, y2, color, depth = 4, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const geo = new RoundedBoxGeometry(voxelSize, voxelSize, depth * voxelScale, 2, 0.05)
        const mesh = new THREE.Mesh(geo, mat(color))
        mesh.position.set(
          (x - cx) * voxelSize * 0.5, 
          (20 - y) * voxelSize * 0.5, 
          (z - 1) * voxelSize * 0.4 + (depth * voxelScale * 0.5) + 0.08
        )
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
      }
    }
  }
  
  rect(10, 25, 29, 38, body, 12)
  rect(9, 26, 30, 37, body, 12)
  rect(8, 27, 31, 36, body, 12)
  rect(8, 28, 31, 35, body, 12)
  rect(9, 29, 30, 34, body, 12)
  rect(10, 30, 29, 33, body, 12)
  rect(11, 31, 28, 32, body, 12)
  
  rect(12, 26, 27, 27, bodyHighlight, 12)
  rect(11, 28, 28, 28, bodyHighlight, 12)
  rect(12, 30, 27, 30, bodyHighlight, 12)
  rect(13, 32, 26, 32, bodyHighlight, 12)
  
  rect(10, 38, 29, 38, bodyShadow, 12)
  rect(9, 37, 30, 37, bodyShadow, 12)
  rect(8, 36, 31, 36, bodyShadow, 12)
  
  rect(14, 27, 14, 27, bodyShadow, 12)
  rect(26, 27, 26, 27, bodyShadow, 12)
  rect(12, 29, 12, 29, bodyShadow, 12)
  rect(28, 29, 28, 29, bodyShadow, 12)
  rect(8, 31, 8, 31, bodyShadow, 12)
  rect(32, 31, 32, 31, bodyShadow, 12)
  
  rectFront(12, 26, 27, 36, belly, 6)
  rectFront(11, 27, 28, 35, belly, 6)
  rectFront(11, 28, 28, 34, belly, 6)
  rectFront(12, 29, 27, 33, belly, 6)
  rectFront(13, 30, 26, 32, belly, 6)
  rectFront(14, 31, 25, 32, belly, 6)
  rectFront(15, 32, 24, 33, belly, 6)
  
  rectFront(14, 27, 25, 28, bellyHighlight, 6)
  rectFront(14, 29, 25, 30, bellyHighlight, 6)
  rectFront(15, 31, 24, 32, bellyHighlight, 6)
  
  rect(10, 8, 29, 26, body, 20)
  rect(9, 9, 30, 25, body, 20)
  rect(8, 10, 31, 24, body, 20)
  rect(8, 11, 31, 23, body, 20)
  rect(9, 12, 30, 22, body, 20)
  rect(10, 13, 29, 21, body, 20)
  rect(11, 14, 28, 20, body, 20)
  rect(12, 15, 27, 19, body, 20)
  rect(13, 16, 26, 18, body, 20)
  rect(14, 17, 25, 18, body, 20)
  
  rect(12, 9, 27, 10, bodyHighlight, 20)
  rect(11, 11, 28, 12, bodyHighlight, 20)
  rect(12, 13, 27, 14, bodyHighlight, 20)
  rect(13, 15, 26, 16, bodyHighlight, 20)
  rect(14, 17, 25, 17, bodyHighlight, 20)
  
  rect(10, 26, 29, 26, bodyShadow, 20)
  rect(9, 25, 30, 25, bodyShadow, 20)
  rect(8, 24, 31, 24, bodyShadow, 20)
  
  rect(11, 10, 11, 10, bodyShadow, 11)
  rect(28, 10, 28, 10, bodyShadow, 11)
  rect(10, 12, 10, 12, bodyShadow, 11)
  rect(29, 12, 29, 12, bodyShadow, 11)
  rect(10, 14, 10, 14, bodyShadow, 11)
  rect(29, 14, 29, 14, bodyShadow, 11)
  
  rectFront(12, 14, 27, 24, belly, 11)
  rectFront(11, 15, 28, 23, belly, 11)
  rectFront(12, 16, 27, 22, belly, 11)
  rectFront(13, 17, 26, 21, belly, 11)
  rectFront(14, 18, 25, 20, belly, 11)
  rectFront(15, 19, 24, 20, belly, 11)
  
  rectFront(14, 15, 25, 16, bellyHighlight, 11)
  rectFront(14, 17, 25, 18, bellyHighlight, 11)
  rectFront(15, 19, 24, 20, bellyHighlight, 11)
  
  const eyeY = 17
  
  if (traits.eyes.type === 'round') {
    rectFront(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'happy') {
    rectFront(cx - 5, eyeY, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY, cx + 5, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'sad') {
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 3, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'sleepy') {
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 4, eyeY + 2, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY + 2, cx + 4, eyeY + 2, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'surprised') {
    rectFront(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY, cx + 5, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'wink') {
    rectFront(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'sideeye') {
    rectFront(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY + 1, cx - 4, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'closed') {
    rectFront(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'sparkle') {
    rectFront(cx - 4, eyeY, cx - 3, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY, cx + 4, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'angry') {
    rectFront(cx - 4, eyeY, cx - 3, eyeY, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx - 3, eyeY, cx - 3, eyeY, '#FF0000', 12)
    rectFront(cx + 3, eyeY, cx + 4, eyeY, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 5, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY, cx + 4, eyeY, '#FF0000', 12)
  }
  
  rectFront(cx - 7, 14, cx - 3, 14, bodyShadow, 11, 1.1)
  rectFront(cx + 3, 14, cx + 7, 14, bodyShadow, 11, 1.1)
  rectFront(cx - 8, 13, cx - 4, 13, bodyShadow, 11, 1.1)
  rectFront(cx + 4, 13, cx + 8, 13, bodyShadow, 11, 1.1)
  
  if (traits.beak.type === 'small') {
    rectFront(cx - 2, 21, cx + 1, 23, beak, 14)
    rectFront(cx - 1, 20, cx, 22, beak, 14)
    rectFront(cx - 1, 22, cx, 22, beakShadow, 14)
  } else if (traits.beak.type === 'large') {
    rectFront(cx - 3, 20, cx + 2, 23, beak, 14)
    rectFront(cx - 2, 19, cx + 1, 22, beak, 14)
    rectFront(cx - 1, 18, cx, 20, beak, 14)
    rectFront(cx - 2, 23, cx + 1, 23, beakShadow, 14)
  } else if (traits.beak.type === 'wide') {
    rectFront(cx - 4, 21, cx + 3, 23, beak, 14)
    rectFront(cx - 3, 20, cx + 2, 24, beak, 14)
    rectFront(cx - 2, 20, cx + 1, 20, beak, 14)
    rectFront(cx - 2, 24, cx + 1, 24, beakShadow, 14)
  } else if (traits.beak.type === 'pointy') {
    rectFront(cx - 2, 21, cx + 1, 23, beak, 14)
    rectFront(cx - 1, 19, cx, 22, beak, 14)
    rectFront(cx, 18, cx, 20, beak, 14)
    rectFront(cx - 1, 23, cx, 23, beakShadow, 14)
  } else if (traits.beak.type === 'round') {
    rectFront(cx - 3, 21, cx + 2, 23, beak, 14)
    rectFront(cx - 2, 20, cx + 1, 24, beak, 14)
    rectFront(cx - 1, 20, cx, 20, beak, 14)
    rectFront(cx - 2, 24, cx + 1, 24, beakShadow, 14)
  } else if (traits.beak.type === 'puffy') {
    rectFront(cx - 3, 20, cx + 2, 22, beak, 14)
    rectFront(cx - 2, 19, cx + 1, 21, beakHighlight, 14)
    rectFront(cx - 1, 18, cx, 20, beakHighlight, 14)
    rectFront(cx - 2, 22, cx + 1, 22, beakShadow, 14)
    rectFront(cx + 1, 21, cx + 2, 21, beakShadow, 14)
  } else {
    rectFront(cx - 3, 21, cx + 2, 23, beak, 14)
    rectFront(cx - 2, 20, cx + 1, 22, beak, 14)
    rectFront(cx - 1, 20, cx, 21, beak, 14)
    rectFront(cx - 2, 22, cx + 1, 22, beakShadow, 14)
    rectFront(cx - 3, 21, cx - 3, 22, beakShadow, 14)
  }
  
  rectFront(cx - 9, 19, cx - 7, 21, '#FFB6C1', 11, 1.1)
  rectFront(cx + 7, 19, cx + 9, 21, '#FFB6C1', 11, 1.1)
  rectFront(cx - 8, 20, cx - 7, 20, '#FFC5CD', 11, 1.1)
  rectFront(cx + 7, 20, cx + 8, 20, '#FFC5CD', 11, 1.1)
  
  const headColor = traits.head.color || '#404040'
  const parseHex = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
    if (!m) return null
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
  }
  const mixHex = (a, b, t) => {
    const ca = parseHex(a)
    const cb = parseHex(b)
    if (!ca || !cb) return a
    const mix = (x, y) => Math.round(x + (y - x) * t)
    const toHex = (n) => n.toString(16).padStart(2, '0')
    return `#${toHex(mix(ca.r, cb.r))}${toHex(mix(ca.g, cb.g))}${toHex(mix(ca.b, cb.b))}`
  }
  const headHighlight = traits.head.highlight || mixHex(headColor, '#FFFFFF', 0.28)
  const headShadow = traits.head.shadow || mixHex(headColor, '#000000', 0.38)
  const headSpec = mixHex(headHighlight, '#FFFFFF', 0.42)
  const headMid = mixHex(headColor, headShadow, 0.45)
  const headDeep = mixHex(headShadow, '#000000', 0.35)
  const clothFold = mixHex(headColor, headShadow, 0.25)
  if (traits.head.type === 'crown') {
    const crownStyle = traits.head.style || 'imperial'
    if (crownStyle === 'elegant') {
      rect(cx - 9, 7, cx + 9, 9, '#CDA349', 20)
      rect(cx - 8, 6, cx + 8, 7, '#F6D98A', 20)
      rect(cx - 9, 9, cx + 9, 9, '#775314', 20)
      rect(cx - 7, 4, cx - 5, 7, '#E8C86E', 20)
      rect(cx - 3, 3, cx - 1, 7, '#F1D786', 20)
      rect(cx + 1, 3, cx + 3, 7, '#F1D786', 20)
      rect(cx + 5, 4, cx + 7, 7, '#E8C86E', 20)
      rect(cx - 6, 2, cx - 5, 3, '#FFF5C8', 20)
      rect(cx - 1, 1, cx, 2, '#FFF5C8', 20)
      rect(cx + 5, 2, cx + 6, 3, '#FFF5C8', 20)
      rect(cx - 8, 7, cx - 8, 8, '#8A651F', 20)
      rect(cx + 8, 7, cx + 8, 8, '#8A651F', 20)
      rect(cx - 4, 6, cx - 4, 8, '#8A651F', 20)
      rect(cx + 4, 6, cx + 4, 8, '#8A651F', 20)
      rect(cx - 8, 6, cx + 8, 6, '#FFE4A0', 20)
      rect(cx - 6, 7, cx - 5, 8, '#B80F2E', 20)
      rect(cx - 1, 7, cx, 8, '#0E7EEA', 20)
      rect(cx + 4, 7, cx + 5, 8, '#23A455', 20)
      rect(cx - 2, 5, cx + 1, 6, '#B78A2C', 20)
    } else {
      rect(cx - 10, 7, cx + 10, 9, '#C69214', 20)
      rect(cx - 9, 6, cx + 9, 7, '#F2C94C', 20)
      rect(cx - 10, 9, cx + 10, 9, '#7A5200', 20)
      rect(cx - 8, 3, cx - 6, 7, '#E5B93A', 20)
      rect(cx - 5, 4, cx - 3, 7, '#DCAA2D', 20)
      rect(cx - 1, 1, cx + 1, 7, '#F7D55C', 20)
      rect(cx + 3, 4, cx + 5, 7, '#DCAA2D', 20)
      rect(cx + 6, 3, cx + 8, 7, '#E5B93A', 20)
      rect(cx - 7, 2, cx - 6, 3, '#FFF3B0', 20)
      rect(cx, 0, cx, 2, '#FFF3B0', 20)
      rect(cx + 6, 2, cx + 7, 3, '#FFF3B0', 20)
      rect(cx - 9, 6, cx - 9, 8, '#8A6108', 20)
      rect(cx + 9, 6, cx + 9, 8, '#8A6108', 20)
      rect(cx - 4, 6, cx - 4, 7, '#8A6108', 20)
      rect(cx + 4, 6, cx + 4, 7, '#8A6108', 20)
      rect(cx - 8, 6, cx + 8, 6, '#FFD76A', 20)
      rect(cx - 7, 7, cx - 6, 8, '#B80F2E', 20)
      rect(cx - 1, 7, cx, 8, '#0E7EEA', 20)
      rect(cx + 5, 7, cx + 6, 8, '#23A455', 20)
      rect(cx - 2, 5, cx + 2, 6, '#BF8F1A', 20)
    }
  } else if (traits.head.type === 'tophat') {
    rect(cx - 11, 8, cx + 11, 9, '#111111', 20)
    rect(cx - 10, 6, cx + 10, 8, '#1B1B1B', 20)
    rect(cx - 9, 5, cx + 9, 6, '#2E2E2E', 20)
    rect(cx - 5, 1, cx + 4, 6, '#1A1A1A', 20)
    rect(cx - 4, 1, cx + 3, 2, '#3B3B3B', 20)
    rect(cx - 5, 7, cx + 4, 7, '#8B0000', 20)
    rect(cx - 2, 2, cx - 1, 4, '#7A7A7A', 20)
    rect(cx - 5, 5, cx - 5, 6, '#2F2F2F', 20)
    rect(cx, 2, cx + 1, 5, '#101010', 20)
    rect(cx + 3, 2, cx + 4, 5, '#0B0B0B', 20)
    rect(cx - 9, 9, cx + 9, 9, '#050505', 20)
    rect(cx - 8, 6, cx - 7, 8, '#353535', 20)
    rect(cx + 5, 2, cx + 5, 6, '#080808', 20)
    rect(cx - 3, 1, cx - 1, 1, '#4A4A4A', 20)
    rect(cx - 4, 8, cx + 4, 8, '#2A0000', 20)
    rect(cx + 7, 7, cx + 9, 8, '#080808', 20)
  } else if (traits.head.type === 'beanie') {
    rect(cx - 10, 7, cx + 9, 10, headColor, 20)
    rect(cx - 9, 5, cx + 8, 7, headHighlight, 20)
    rect(cx - 7, 3, cx + 6, 6, headColor, 20)
    rect(cx - 4, 2, cx + 3, 3, headSpec, 20)
    rect(cx - 10, 10, cx + 9, 10, headShadow, 20)
    rect(cx - 9, 9, cx + 8, 9, clothFold, 20)
    rect(cx - 8, 8, cx + 7, 8, headMid, 20)
    rect(cx - 6, 4, cx - 6, 10, headMid, 20)
    rect(cx - 3, 4, cx - 3, 10, headShadow, 20)
    rect(cx, 4, cx, 10, headMid, 20)
    rect(cx + 3, 4, cx + 3, 10, headShadow, 20)
    rect(cx + 6, 4, cx + 6, 10, headMid, 20)
    rect(cx - 5, 6, cx - 5, 8, headSpec, 20)
    rect(cx + 1, 6, cx + 1, 8, headSpec, 20)
    rect(cx - 2, 10, cx + 1, 10, headDeep, 20)
    rect(cx - 7, 3, cx - 6, 3, headSpec, 20)
    rect(cx + 4, 3, cx + 5, 3, headSpec, 20)
  } else if (traits.head.type === 'bow') {
    rect(cx - 10, 7, cx - 7, 9, '#E754A6', 20)
    rect(cx + 7, 7, cx + 10, 9, '#E754A6', 20)
    rect(cx - 6, 7, cx + 6, 9, '#D81B78', 20)
    rect(cx - 8, 6, cx - 6, 8, '#FFC1DC', 20)
    rect(cx + 6, 6, cx + 8, 8, '#FFC1DC', 20)
    rect(cx - 2, 7, cx + 1, 9, '#B3135F', 20)
    rect(cx - 1, 8, cx, 8, '#8A0D48', 20)
    rect(cx - 9, 9, cx - 8, 9, '#9C0F50', 20)
    rect(cx + 8, 9, cx + 9, 9, '#9C0F50', 20)
    rect(cx - 10, 8, cx - 9, 8, '#B3135F', 20)
    rect(cx + 9, 8, cx + 10, 8, '#B3135F', 20)
    rect(cx - 7, 8, cx - 6, 9, '#8A0D48', 20)
    rect(cx + 6, 8, cx + 7, 9, '#8A0D48', 20)
    rect(cx - 4, 7, cx - 3, 8, '#F77FBC', 20)
    rect(cx + 3, 7, cx + 4, 8, '#F77FBC', 20)
  } else if (traits.head.type === 'cap') {
    rect(cx - 11, 7, cx + 9, 9, headColor, 20)
    rect(cx - 10, 6, cx + 8, 7, headHighlight, 20)
    rect(cx - 8, 5, cx + 5, 6, headSpec, 20)
    rect(cx - 10, 8, cx + 8, 8, headMid, 20)
    rect(cx - 10, 9, cx + 8, 9, headShadow, 20)
    rect(cx - 3, 8, cx + 6, 8, headDeep, 20)
    rect(cx - 1, 7, cx + 3, 7, headHighlight, 20)
    rect(cx + 8, 8, cx + 12, 11, headShadow, 20)
    rect(cx + 9, 9, cx + 12, 10, headColor, 20)
    rect(cx + 10, 10, cx + 12, 11, headDeep, 20)
    rect(cx - 12, 8, cx - 8, 9, headShadow, 20)
    rect(cx - 11, 9, cx - 9, 10, headDeep, 20)
    rect(cx + 9, 11, cx + 11, 11, '#111111', 20)
    rect(cx - 9, 9, cx + 4, 9, headDeep, 20)
    rect(cx - 7, 6, cx - 6, 7, headSpec, 20)
    rect(cx + 4, 6, cx + 5, 7, headMid, 20)
    rect(cx + 8, 10, cx + 10, 11, '#121212', 20)
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 25, cx + 10, 28, traits.head.color, 20)
    rect(cx - 9, 24, cx + 9, 26, traits.head.highlight, 20)
    rect(cx + 8, 25, cx + 11, 33, traits.head.color, 20)
    rect(cx + 9, 26, cx + 10, 32, traits.head.highlight, 20)
    rect(cx - 3, 26, cx + 2, 27, traits.head.shadow, 20)
    rect(cx - 2, 27, cx + 1, 28, traits.head.shadow, 20)
  } else if (traits.head.type === 'halo') {
    rect(cx - 4, 3, cx + 3, 4, '#E8BF2F', 20)
    rect(cx - 5, 4, cx + 4, 5, '#D1A91E', 20)
    rect(cx - 3, 2, cx + 2, 3, '#FFE27A', 20)
    rect(cx - 5, 5, cx + 4, 5, '#AD8614', 20)
    rect(cx - 2, 2, cx - 1, 2, '#FFF1A3', 20)
    rect(cx + 1, 2, cx + 2, 2, '#FFF1A3', 20)
  } else if (traits.head.type === 'headband') {
    rect(cx - 11, 6, cx + 10, 9, headColor, 20)
    rect(cx - 10, 5, cx + 9, 6, headSpec, 20)
    rect(cx - 11, 9, cx + 10, 9, headShadow, 20)
    rect(cx - 10, 8, cx + 9, 8, headMid, 20)
    rect(cx - 9, 7, cx + 8, 7, clothFold, 20)
    rect(cx - 8, 6, cx - 7, 8, headHighlight, 20)
    rect(cx - 4, 6, cx - 3, 8, headHighlight, 20)
    rect(cx, 6, cx + 1, 8, headHighlight, 20)
    rect(cx + 4, 6, cx + 5, 8, headHighlight, 20)
    rect(cx + 8, 6, cx + 9, 8, headHighlight, 20)
    rect(cx - 2, 5, cx + 1, 6, headSpec, 20)
    rect(cx + 2, 6, cx + 3, 8, headDeep, 20)
    rect(cx - 6, 8, cx - 5, 9, headDeep, 20)
    rect(cx + 6, 8, cx + 7, 9, headDeep, 20)
    rect(cx - 10, 9, cx - 9, 9, headDeep, 20)
    rect(cx + 8, 9, cx + 10, 9, headDeep, 20)
    rect(cx - 2, 9, cx + 1, 9, headDeep, 20)
    rect(cx + 9, 7, cx + 10, 8, headDeep, 20)
    rect(cx - 11, 7, cx - 10, 8, headDeep, 20)
  }
  
  rect(2, 26, 5, 32, body, 4)
  rect(1, 27, 6, 31, body, 4)
  rect(2, 28, 5, 30, bodyHighlight, 4)
  rect(3, 29, 5, 29, bodyHighlight, 4)
  rect(2, 30, 4, 31, bodyShadow, 4)
  rect(1, 31, 3, 32, bodyShadow, 4)
  rect(1, 30, 3, 33, body, 4)
  rect(2, 31, 3, 32, bodyHighlight, 4)
  rect(5, 31, 7, 33, body, 4)
  rect(6, 32, 7, 33, bodyHighlight, 4)
  
  rect(34, 26, 37, 32, body, 4)
  rect(33, 27, 38, 31, body, 4)
  rect(34, 28, 37, 30, bodyHighlight, 4)
  rect(34, 29, 36, 29, bodyHighlight, 4)
  rect(35, 30, 37, 31, bodyShadow, 4)
  rect(36, 31, 38, 32, bodyShadow, 4)
  rect(36, 30, 38, 33, body, 4)
  rect(36, 31, 37, 32, bodyHighlight, 4)
  rect(32, 31, 34, 33, body, 4)
  rect(32, 32, 33, 33, bodyHighlight, 4)
  
  const footBase = traits.feet?.base || '#FF9F43'
  const footHighlight = traits.feet?.highlight || '#FFBE76'
  const footShadow = traits.feet?.shadow || '#E67E22'
  
  rect(10, 37, 15, 38, footBase, 14)
  rect(9, 38, 16, 38, footBase, 14)
  rect(11, 36, 13, 37, footHighlight, 14)
  rect(10, 38, 15, 38, footHighlight, 14)
  rect(10, 37, 15, 37, footShadow, 14)
  
  rect(7, 38, 9, 39, footBase, 14)
  rect(7, 38, 9, 38, footHighlight, 14)
  rect(7, 39, 9, 39, footShadow, 14)
  rect(7, 38, 8, 38, footHighlight, 14)
  rect(11, 38, 13, 39, footBase, 14)
  rect(11, 38, 13, 38, footHighlight, 14)
  rect(11, 39, 13, 39, footShadow, 14)
  rect(12, 38, 12, 38, footHighlight, 14)
  rect(15, 38, 17, 39, footBase, 14)
  rect(15, 38, 17, 38, footHighlight, 14)
  rect(15, 39, 17, 39, footShadow, 14)
  rect(16, 38, 16, 38, footHighlight, 14)
  
  rect(25, 37, 30, 38, footBase, 14)
  rect(24, 38, 31, 38, footBase, 14)
  rect(26, 36, 28, 37, footHighlight, 14)
  rect(25, 38, 30, 38, footHighlight, 14)
  rect(25, 37, 30, 37, footShadow, 14)
  
  rect(23, 38, 25, 39, footBase, 14)
  rect(23, 38, 25, 38, footHighlight, 14)
  rect(23, 39, 25, 39, footShadow, 14)
  rect(23, 38, 24, 38, footHighlight, 14)
  rect(27, 38, 29, 39, footBase, 14)
  rect(27, 38, 29, 38, footHighlight, 14)
  rect(27, 39, 29, 39, footShadow, 14)
  rect(28, 38, 28, 38, footHighlight, 14)
  rect(31, 38, 33, 39, footBase, 14)
  rect(31, 38, 33, 38, footHighlight, 14)
  rect(31, 39, 33, 39, footShadow, 14)
  rect(32, 38, 32, 38, footHighlight, 14)
  
  return group
}

function render3DSnapshot(traits) {
  if (!traits || !traits.background || !traits.body || !traits.beak) {
    console.error('Invalid traits:', traits)
    return null
  }
  
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(traits.background.color || '#87CEEB')
  scene.fog = new THREE.Fog(traits.background.color, 15, 60)
  
  const aspect = 1
  const frustumSize = 13
  const camera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    1000
  )
  camera.position.set(8, 6, 12)
  camera.lookAt(0, 0, 0)
  
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(400, 400)
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  
  const ambient = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambient)
  
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.4)
  scene.add(hemiLight)
  
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
  keyLight.position.set(5, 10, 15)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.width = 1024
  keyLight.shadow.mapSize.height = 1024
  keyLight.shadow.camera.near = 1
  keyLight.shadow.camera.far = 60
  keyLight.shadow.camera.left = -15
  keyLight.shadow.camera.right = 15
  keyLight.shadow.camera.top = 15
  keyLight.shadow.camera.bottom = -15
  keyLight.shadow.radius = 1
  keyLight.shadow.bias = -0.001
  scene.add(keyLight)
  
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.2)
  fillLight.position.set(8, 8, 5)
  scene.add(fillLight)
  
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
  rimLight.position.set(0, 5, -15)
  scene.add(rimLight)
  
  const penguinPivot = new THREE.Group()
  penguinPivot.position.set(0, 0.5, 0)
  const penguin = createVoxelPenguin(traits, THREE)
  penguinPivot.add(penguin)
  scene.add(penguinPivot)
  
  const groundGeo = new THREE.PlaneGeometry(60, 60)
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -5
  ground.receiveShadow = true
  scene.add(ground)
  
  renderer.render(scene, camera)
  const dataUrl = renderer.domElement.toDataURL('image/png')
  
  renderer.dispose()
  
  return dataUrl
}

function randomItem(arr) {
  const total = arr.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of arr) {
    r -= item.weight
    if (r <= 0) return item
  }
  return arr[0]
}

function buildAttributesFromTraits(traits) {
  const getEffectValue = () => {
    if (traits.effect?.name && traits.effect.name !== 'None') {
      const variant = traits.effect.variant || 'White'
      return `${traits.effect.name} (${variant})`
    }
    if (traits.background?.fx === 'snowflakes') return 'Snow (White)'
    if (traits.background?.fx === 'softdots') return 'Stone (White)'
    return null
  }
  const effectValue = getEffectValue()
  const attrs = [
    { trait_type: 'Background', value: traits.background?.name || 'Unknown' },
    { trait_type: 'Body', value: traits.body?.name || 'Unknown' },
    { trait_type: 'Belly', value: traits.belly?.name || 'Unknown' },
    { trait_type: 'Beak', value: traits.beak?.name || 'Unknown' },
    { trait_type: 'Eyes', value: traits.eyes?.name || 'Unknown' },
    { trait_type: 'Head', value: traits.head?.name || 'Unknown' },
    { trait_type: 'Feet', value: traits.feet?.name || 'Unknown' },
  ]
  if (effectValue) attrs.splice(1, 0, { trait_type: 'Effect', value: effectValue })
  return attrs
}

function calculateRarityScore(traits) {
  const safeWeight = (item) => Math.max(1, Number(item?.weight || 1))
  const scoreFrom = (item, scale = 1000) => Math.round(scale / safeWeight(item))
  return (
    scoreFrom(traits.background) +
    scoreFrom(traits.body) +
    scoreFrom(traits.belly) +
    scoreFrom(traits.beak) +
    scoreFrom(traits.eyes) +
    scoreFrom(traits.head) +
    scoreFrom(traits.feet)
  )
}

function sel10(seed) {
  const w = [15, 15, 12, 12, 12, 12, 10, 10, 8, 3]
  const tot = 131n
  const r = seed % tot
  let c = 0n
  for (let i = 0; i < 10; i++) { c += BigInt(w[i]); if (r < c) return i }
  return 0
}

function sel18(seed) {
  const w = [15, 12, 10, 10, 10, 10, 10, 10, 10, 8, 8, 8, 8, 8, 6, 5, 5, 3]
  const tot = 150n
  const r = seed % tot
  let c = 0n
  for (let i = 0; i < 18; i++) { c += BigInt(w[i]); if (r < c) return i }
  return 0
}

function sel5(seed) {
  const w = [45, 25, 15, 10, 5]
  const tot = 100n
  const r = seed % tot
  let c = 0n
  for (let i = 0; i < 5; i++) { c += BigInt(w[i]); if (r < c) return i }
  return 0
}

function sel6(seed) {
  const w = [20, 18, 15, 15, 15, 12]
  const tot = 95n
  const r = seed % tot
  let c = 0n
  for (let i = 0; i < 6; i++) { c += BigInt(w[i]); if (r < c) return i }
  return 0
}

function sel4(seed) {
  const w = [50, 20, 15, 15]
  const tot = 100n
  const r = seed % tot
  let c = 0n
  for (let i = 0; i < 4; i++) { c += BigInt(w[i]); if (r < c) return i }
  return 0
}

function generateTraitsFromSeed(seed) {
  return {
    background: TRAITS.background[sel10(seed)],
    body: TRAITS.body[sel18(seed >> 8n)],
    belly: TRAITS.belly[sel5(seed >> 16n)],
    beak: TRAITS.beak[sel6(seed >> 24n)],
    eyes: TRAITS.eyes[sel10(seed >> 32n)],
    head: TRAITS.head[sel18(seed >> 40n)],
    feet: { name: 'Default Orange', type: 'default', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }
  }
}

function drawAgent(traits, canvas) {
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const scale = 9
  canvas.width = 400
  canvas.height = 400
  
  ctx.fillStyle = traits.background.color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  const offsetX = 2
  const offsetY = 1
  
  const set = (x, y, color) => {
    if (x >= 0 && x < 40 && y >= 0 && y < 40) {
      ctx.fillStyle = color
      ctx.fillRect((x + offsetX) * scale, (y + offsetY) * scale, scale, scale)
    }
  }
  
  const rect = (x1, y1, x2, y2, color) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) set(x, y, color)
    }
  }
  const softDot = (x, y, core, mid, outer) => {
    set(x, y, core)
    set(x - 1, y, mid)
    set(x + 1, y, mid)
    set(x, y - 1, mid)
    set(x, y + 1, mid)
    set(x - 1, y - 1, outer)
    set(x + 1, y - 1, outer)
    set(x - 1, y + 1, outer)
    set(x + 1, y + 1, outer)
  }

  const fxType = traits.background.fx
  if (fxType === 'snowflakes') {
    const flakes = [[3, 4], [10, 7], [32, 5], [36, 10], [6, 33], [14, 35], [29, 32], [35, 27], [2, 20], [38, 22]]
    for (const [x, y] of flakes) {
      softDot(x, y, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.14)')
      set(x - 2, y, 'rgba(255,255,255,0.08)')
      set(x + 2, y, 'rgba(255,255,255,0.08)')
      set(x, y - 2, 'rgba(255,255,255,0.08)')
      set(x, y + 2, 'rgba(255,255,255,0.08)')
    }
  } else if (fxType === 'softdots') {
    const dots = [[4, 5], [8, 11], [13, 4], [18, 8], [25, 4], [30, 9], [35, 6], [6, 29], [12, 34], [20, 36], [28, 33], [34, 29]]
    for (const [x, y] of dots) {
      softDot(x, y, 'rgba(255,255,255,0.24)', 'rgba(255,255,255,0.11)', 'rgba(255,255,255,0.05)')
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
  
  const cx = 20
  
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
  const parseHex = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
    if (!m) return null
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
  }
  const mixHex = (a, b, t) => {
    const ca = parseHex(a)
    const cb = parseHex(b)
    if (!ca || !cb) return a
    const mix = (x, y) => Math.round(x + (y - x) * t)
    const toHex = (n) => n.toString(16).padStart(2, '0')
    return `#${toHex(mix(ca.r, cb.r))}${toHex(mix(ca.g, cb.g))}${toHex(mix(ca.b, cb.b))}`
  }
  const headHighlight = traits.head.highlight || mixHex(headColor, '#FFFFFF', 0.28)
  const headShadow = traits.head.shadow || mixHex(headColor, '#000000', 0.38)
  const headSpec = mixHex(headHighlight, '#FFFFFF', 0.42)
  const headMid = mixHex(headColor, headShadow, 0.45)
  const headDeep = mixHex(headShadow, '#000000', 0.35)
  const clothFold = mixHex(headColor, headShadow, 0.25)
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
      rect(cx - 6, 2, cx - 5, 3, '#FFF5C8')
      rect(cx - 1, 1, cx, 2, '#FFF5C8')
      rect(cx + 5, 2, cx + 6, 3, '#FFF5C8')
      rect(cx - 8, 7, cx - 8, 8, '#8A651F')
      rect(cx + 8, 7, cx + 8, 8, '#8A651F')
      rect(cx - 4, 6, cx - 4, 8, '#8A651F')
      rect(cx + 4, 6, cx + 4, 8, '#8A651F')
      rect(cx - 8, 6, cx + 8, 6, '#FFE4A0')
      rect(cx - 6, 7, cx - 5, 8, '#B80F2E')
      rect(cx - 1, 7, cx, 8, '#0E7EEA')
      rect(cx + 4, 7, cx + 5, 8, '#23A455')
      rect(cx - 2, 5, cx + 1, 6, '#B78A2C')
    } else {
      rect(cx - 10, 7, cx + 10, 9, '#C69214')
      rect(cx - 9, 6, cx + 9, 7, '#F2C94C')
      rect(cx - 10, 9, cx + 10, 9, '#7A5200')
      rect(cx - 8, 3, cx - 6, 7, '#E5B93A')
      rect(cx - 5, 4, cx - 3, 7, '#DCAA2D')
      rect(cx - 1, 1, cx + 1, 7, '#F7D55C')
      rect(cx + 3, 4, cx + 5, 7, '#DCAA2D')
      rect(cx + 6, 3, cx + 8, 7, '#E5B93A')
      rect(cx - 7, 2, cx - 6, 3, '#FFF3B0')
      rect(cx, 0, cx, 2, '#FFF3B0')
      rect(cx + 6, 2, cx + 7, 3, '#FFF3B0')
      rect(cx - 9, 6, cx - 9, 8, '#8A6108')
      rect(cx + 9, 6, cx + 9, 8, '#8A6108')
      rect(cx - 4, 6, cx - 4, 7, '#8A6108')
      rect(cx + 4, 6, cx + 4, 7, '#8A6108')
      rect(cx - 8, 6, cx + 8, 6, '#FFD76A')
      rect(cx - 7, 7, cx - 6, 8, '#B80F2E')
      rect(cx - 1, 7, cx, 8, '#0E7EEA')
      rect(cx + 5, 7, cx + 6, 8, '#23A455')
      rect(cx - 2, 5, cx + 2, 6, '#BF8F1A')
    }
  } else if (traits.head.type === 'tophat') {
    rect(cx - 11, 8, cx + 11, 9, '#111111')
    rect(cx - 10, 6, cx + 10, 8, '#1B1B1B')
    rect(cx - 9, 5, cx + 9, 6, '#2E2E2E')
    rect(cx - 5, 1, cx + 4, 6, '#1A1A1A')
    rect(cx - 4, 1, cx + 3, 2, '#3B3B3B')
    rect(cx - 5, 7, cx + 4, 7, '#8B0000')
    rect(cx - 2, 2, cx - 1, 4, '#7A7A7A')
    rect(cx - 5, 5, cx - 5, 6, '#2F2F2F')
    rect(cx, 2, cx + 1, 5, '#101010')
    rect(cx + 3, 2, cx + 4, 5, '#0B0B0B')
    rect(cx - 9, 9, cx + 9, 9, '#050505')
    rect(cx - 8, 6, cx - 7, 8, '#353535')
    rect(cx + 5, 2, cx + 5, 6, '#080808')
    rect(cx - 3, 1, cx - 1, 1, '#4A4A4A')
    rect(cx - 4, 8, cx + 4, 8, '#2A0000')
    rect(cx + 7, 7, cx + 9, 8, '#080808')
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
    rect(cx - 5, 6, cx - 5, 8, headSpec)
    rect(cx + 1, 6, cx + 1, 8, headSpec)
    rect(cx - 2, 10, cx + 1, 10, headDeep)
    rect(cx - 7, 3, cx - 6, 3, headSpec)
    rect(cx + 4, 3, cx + 5, 3, headSpec)
    rect(cx - 2, 11, cx + 2, 11, 'rgba(0,0,0,0.16)')
  } else if (traits.head.type === 'bow') {
    rect(cx - 10, 7, cx - 7, 9, '#E754A6')
    rect(cx + 7, 7, cx + 10, 9, '#E754A6')
    rect(cx - 6, 7, cx + 6, 9, '#D81B78')
    rect(cx - 8, 6, cx - 6, 8, '#FFC1DC')
    rect(cx + 6, 6, cx + 8, 8, '#FFC1DC')
    rect(cx - 2, 7, cx + 1, 9, '#B3135F')
    rect(cx - 1, 8, cx, 8, '#8A0D48')
    rect(cx - 9, 9, cx - 8, 9, '#9C0F50')
    rect(cx + 8, 9, cx + 9, 9, '#9C0F50')
    rect(cx - 10, 8, cx - 9, 8, '#B3135F')
    rect(cx + 9, 8, cx + 10, 8, '#B3135F')
    rect(cx - 7, 8, cx - 6, 9, '#8A0D48')
    rect(cx + 6, 8, cx + 7, 9, '#8A0D48')
    rect(cx - 4, 7, cx - 3, 8, '#F77FBC')
    rect(cx + 3, 7, cx + 4, 8, '#F77FBC')
  } else if (traits.head.type === 'cap') {
    rect(cx - 11, 7, cx + 9, 9, headColor)
    rect(cx - 10, 6, cx + 8, 7, headHighlight)
    rect(cx - 8, 5, cx + 5, 6, headSpec)
    rect(cx - 10, 8, cx + 8, 8, headMid)
    rect(cx - 10, 9, cx + 8, 9, headShadow)
    rect(cx - 3, 8, cx + 6, 8, headDeep)
    rect(cx - 1, 7, cx + 3, 7, headHighlight)
    rect(cx + 8, 8, cx + 12, 11, headShadow)
    rect(cx + 9, 9, cx + 12, 10, headColor)
    rect(cx + 10, 10, cx + 12, 11, headDeep)
    rect(cx - 12, 8, cx - 8, 9, headShadow)
    rect(cx - 11, 9, cx - 9, 10, headDeep)
    rect(cx + 9, 11, cx + 11, 11, '#111111')
    rect(cx - 9, 9, cx + 4, 9, headDeep)
    rect(cx - 7, 6, cx - 6, 7, headSpec)
    rect(cx + 4, 6, cx + 5, 7, headMid)
    rect(cx + 8, 10, cx + 10, 11, '#121212')
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 25, cx + 10, 28, traits.head.color)
    rect(cx - 9, 24, cx + 9, 26, traits.head.highlight)
    rect(cx + 8, 25, cx + 11, 33, traits.head.color)
    rect(cx + 9, 26, cx + 10, 32, traits.head.highlight)
    rect(cx - 3, 26, cx + 2, 27, traits.head.shadow)
    rect(cx - 2, 27, cx + 1, 28, traits.head.shadow)
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
    rect(cx - 4, 6, cx - 3, 8, headHighlight)
    rect(cx, 6, cx + 1, 8, headHighlight)
    rect(cx + 4, 6, cx + 5, 8, headHighlight)
    rect(cx + 8, 6, cx + 9, 8, headHighlight)
    rect(cx - 2, 5, cx + 1, 6, headSpec)
    rect(cx + 2, 6, cx + 3, 8, headDeep)
    rect(cx - 6, 8, cx - 5, 9, headDeep)
    rect(cx + 6, 8, cx + 7, 9, headDeep)
    rect(cx - 10, 9, cx - 9, 9, headDeep)
    rect(cx + 8, 9, cx + 10, 9, headDeep)
    rect(cx - 2, 9, cx + 1, 9, headDeep)
    rect(cx + 9, 7, cx + 10, 8, headDeep)
    rect(cx - 11, 7, cx - 10, 8, headDeep)
    rect(cx - 3, 10, cx + 2, 10, 'rgba(0,0,0,0.16)')
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
  
  rect(10, 37, 14, 38, feet)
  rect(9, 38, 15, 38, feet)
  rect(11, 36, 13, 37, feetHighlight)
  rect(10, 38, 13, 38, feetShadow)
  rect(8, 38, 10, 39, feet)
  rect(9, 38, 10, 39, feetHighlight)
  rect(12, 38, 14, 39, feet)
  rect(13, 38, 14, 39, feetHighlight)
  
  rect(25, 37, 29, 38, feet)
  rect(24, 38, 30, 38, feet)
  rect(26, 36, 28, 37, feetHighlight)
  rect(25, 38, 28, 38, feetShadow)
  rect(25, 38, 27, 39, feet)
  rect(26, 38, 27, 39, feetHighlight)
  rect(29, 38, 31, 39, feet)
  rect(24, 39, 25, 40, feetHighlight)
  rect(26, 39, 28, 40, feet)
  rect(27, 39, 28, 40, feetHighlight)
  rect(29, 39, 31, 39, feet)
  rect(30, 39, 31, 39, feetHighlight)
}

function NFTGalleryItem({ tokenId, onEvolve }) {
  const [metadata, setMetadata] = useState({ name: '', image: '', attributes: [] })
  const [loadingOnchain, setLoadingOnchain] = useState(false)
  const [onchainError, setOnchainError] = useState('')
  const [showTraits, setShowTraits] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingOnchain(true)
    setOnchainError('')
    fetchOnchainMetadataFromTokenURI(tokenId)
      .then((meta) => {
        if (!cancelled) setMetadata(meta)
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('On-chain image fetch error:', err)
          setOnchainError('Failed to load on-chain image')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOnchain(false)
      })
    return () => {
      cancelled = true
    }
  }, [tokenId])

  useEffect(() => {
    setShowTraits(false)
  }, [tokenId])

  return (
    <>
    <div className="mint-gallery-item">
      <div
        className="mint-gallery-image"
        onClick={() => setShowTraits(true)}
        style={{ cursor: 'pointer' }}
        title="Click to view traits"
      >
        {metadata.image ? (
          <img src={metadata.image} alt={`${metadata.name || 'NFT'} #${tokenId}`} />
        ) : onchainError ? (
          <div className="mint-loading">{onchainError}</div>
        ) : (
          <div className="mint-loading">Loading...</div>
        )}
      </div>
      <div className="mint-gallery-info">
        <span className="mint-gallery-id">#{tokenId}</span>
        {metadata.name && <span className="mint-gallery-id">{metadata.name}</span>}
        {metadata.rarityRank !== null && (
          <span className="mint-gallery-id">Rank #{metadata.rarityRank}</span>
        )}
        {metadata.rarityScore !== null && (
          <span className="mint-gallery-id">Score {metadata.rarityScore}</span>
        )}
        <div className="mint-gallery-actions">
          <a 
            href={`https://sepolia.basescan.org/nft/${CONTRACT_ADDRESS}/${tokenId}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mint-evolve-btn"
          >
            View
          </a>
        </div>
      </div>
    </div>
    {showTraits && (
      <div className="mint-traits-modal-overlay" onClick={() => setShowTraits(false)}>
        <div className="mint-traits-modal" onClick={(e) => e.stopPropagation()}>
          <button className="mint-traits-close" onClick={() => setShowTraits(false)}>X</button>
          <h3>#{tokenId} {metadata.name ? `- ${metadata.name}` : ''}</h3>
          {metadata.image && <img src={metadata.image} alt={`${metadata.name || 'NFT'} #${tokenId}`} />}
          <div className="mint-gallery-traits">
            {metadata.attributes?.length ? metadata.attributes
              .filter((attr) => !(attr.trait_type === 'Effect' && String(attr.value).toLowerCase().startsWith('none')))
              .map((attr, idx) => (
              <span key={`${tokenId}-${idx}`} className="mint-gallery-trait">
                {attr.trait_type}: {attr.value}
              </span>
            )) : <span className="mint-gallery-trait">No traits available</span>}
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function Mint() {
  const [account, setAccount] = useState(null)
  const [balance, setBalance] = useState(0)
  const [status, setStatus] = useState('')
  const [isMinting, setIsMinting] = useState(false)
  const [myNFTs, setMyNFTs] = useState([])
  const [totalSupply, setTotalSupply] = useState(0)
  const [maxSupply, setMaxSupply] = useState(50)
  const [maxPerWallet, setMaxPerWallet] = useState(5)
  const [previewTraits, setPreviewTraits] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [mintedCount, setMintedCount] = useState(0)
  const [lastTxHash, setLastTxHash] = useState('')
  const [mintedNFT, setMintedNFT] = useState(null)
  const [allNFTs, setAllNFTs] = useState([])
  const [metadataRefreshKey, setMetadataRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState('all')
  const [myPage, setMyPage] = useState(1)
  const [allPage, setAllPage] = useState(1)
  const ITEMS_PER_PAGE = 8
  const previewCanvasRef = useRef(null)
  const mintedCanvasRef = useRef(null)
  const lastKnownSupplyRef = useRef(0)

  useEffect(() => {
    fetchContractData(null)
    generatePreview()
  }, [])

  useEffect(() => {
    lastKnownSupplyRef.current = totalSupply
  }, [totalSupply])

  useEffect(() => {
    let cancelled = false
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)

    const pollSupply = async () => {
      try {
        const latestSupply = Number(await contract.totalSupply())
        if (!cancelled && latestSupply !== lastKnownSupplyRef.current) {
          lastKnownSupplyRef.current = latestSupply
          setTotalSupply(latestSupply)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Supply polling error:', err)
        }
      }
    }

    pollSupply()
    const intervalId = setInterval(pollSupply, 5000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!account && (activeTab.startsWith('my'))) {
      setActiveTab('all')
      setAllPage(1)
    }
  }, [account])

  useEffect(() => {
    if (previewTraits && previewCanvasRef.current) {
      drawAgent(previewTraits, previewCanvasRef.current)
    }
  }, [previewTraits])

  useEffect(() => {
    if (mintedNFT && mintedCanvasRef.current) {
      const traits = generateTraitsFromSeed(mintedNFT.seed)
      drawAgent(traits, mintedCanvasRef.current)
    }
  }, [mintedNFT])

  const generatePreview = () => {
    const traits = {
      background: randomItem(TRAITS.background),
      body: randomItem(TRAITS.body),
      belly: randomItem(TRAITS.belly),
      beak: randomItem(TRAITS.beak),
      eyes: randomItem(TRAITS.eyes),
      head: randomItem(TRAITS.head),
      feet: { name: 'Default Orange', type: 'default', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    }
    
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null
    }
    const diff = (c1, c2) => Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    
    while (diff(hexToRgb(traits.background.color), hexToRgb(traits.body.base)) < 80) {
      traits.body = randomItem(TRAITS.body)
    }
    
    while (diff(hexToRgb(traits.belly.base), hexToRgb(traits.body.base)) < 80) {
      traits.belly = randomItem(TRAITS.belly)
    }
    
    while (diff(hexToRgb(traits.background.color), hexToRgb(traits.belly.base)) < 80) {
      traits.belly = randomItem(TRAITS.belly)
    }
    
    const hasHeadAccessory = traits.head.type !== 'none' && traits.head.type !== 'crown' && traits.head.type !== 'halo'
    if (hasHeadAccessory && traits.head.color) {
      while (diff(hexToRgb(traits.head.color), hexToRgb(traits.body.base)) < 80) {
        traits.head = randomItem(TRAITS.head)
      }
    }
    
    setPreviewTraits(traits)
  }

  const fetchContractData = async (address) => {
    try {
      const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC)
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
      
      const [supply, maxS, maxW, mintActive] = await Promise.all([
        contract.totalSupply(),
        contract.MAX_SUPPLY(),
        contract.MAX_PER_WALLET(),
        contract.mintActive()
      ])
      setTotalSupply(Number(supply))
      setMaxSupply(Number(maxS))
      setMaxPerWallet(Number(maxW))
      setStatus(mintActive ? '' : 'Minting not active')
      
      if (address) {
        const [bal, minted] = await Promise.all([
          contract.balanceOf(address),
          contract.mintedPerWallet(address)
        ])
        setBalance(Number(bal))
        setMintedCount(Number(minted))
      }

      const totalNum = Number(supply)
      if (totalNum > 0) {
        const tokenIds = Array.from({ length: totalNum }, (_, idx) => idx + 1)
        const nftResults = await Promise.allSettled(
          tokenIds.map(async (tokenId) => {
            const seedBigInt = await contract.tokenSeeds(tokenId)
            return { tokenId, seed: seedBigInt }
          })
        )

        const allNfts = nftResults
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value)
          .sort((a, b) => b.tokenId - a.tokenId)

        const dedupedAllNfts = Array.from(
          new Map(allNfts.map((nft) => [nft.tokenId, nft])).values()
        ).sort((a, b) => b.tokenId - a.tokenId)

        const normalizedAddress = address ? address.toLowerCase() : null
        setAllNFTs(dedupedAllNfts)

        if (address) {
          const ownerResults = await Promise.allSettled(
            dedupedAllNfts.map((nft) => contract.ownerOf(nft.tokenId))
          )
          const ownedNfts = dedupedAllNfts.filter((nft, idx) => {
            const result = ownerResults[idx]
            return result.status === 'fulfilled' && result.value.toLowerCase() === normalizedAddress
          })
          const dedupedOwnedNfts = Array.from(
            new Map(ownedNfts.map((nft) => [nft.tokenId, nft])).values()
          ).sort((a, b) => b.tokenId - a.tokenId)
          setMyNFTs(dedupedOwnedNfts)
        }
      } else if (address) {
        setMyNFTs([])
      }
      setMetadataRefreshKey((k) => k + 1)
    } catch (err) {
      console.error('Contract error:', err)
      setStatus('Error: ' + (err.message?.slice(0, 30) || 'Check network'))
    }
  }

  const connect = async () => {
    if (!window.ethereum) {
      setStatus('Install MetaMask')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accounts[0])
      fetchContractData(accounts[0])
      setStatus('')
    } catch {
      setStatus('Connection failed')
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setBalance(0)
    setMintedCount(0)
    setMyNFTs([])
    setMintedNFT(null)
    setStatus('Wallet disconnected')
    setLastTxHash(null)
    setActiveTab('all')
    setAllPage(1)
  }

  const switchToBaseSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }],
      })
    } catch {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x14a34',
            chainName: 'Base Sepolia',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://sepolia.base.org'],
            blockExplorerUrls: ['https://sepolia.basescan.org'],
          }],
        })
      } catch {
        setStatus('Add Base Sepolia manually')
      }
    }
  }

  const mint = async () => {
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    try {
      setIsMinting(true)
      setStatus('Generating...')
      setMintedNFT(null)
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)

      const names = []
      const imageBase64s = []
      const attributesJson = []
      const rarityScores = []
      for (let i = 0; i < quantity; i++) {
        const traits = {
          background: randomItem(TRAITS.background),
          body: randomItem(TRAITS.body),
          belly: randomItem(TRAITS.belly),
          beak: randomItem(TRAITS.beak),
          eyes: randomItem(TRAITS.eyes),
          head: randomItem(TRAITS.head),
          feet: randomItem(TRAITS.feet),
        }
        names.push(randomItem(TRAITS.name).name)

        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 400
        drawAgent(traits, canvas)
        imageBase64s.push(canvas.toDataURL('image/png'))
        attributesJson.push(JSON.stringify(buildAttributesFromTraits(traits)))
        rarityScores.push(calculateRarityScore(traits))
      }

      setStatus('Minting...')
      const tx = await contract.mint(quantity, imageBase64s, names, attributesJson, rarityScores)
      setLastTxHash(tx.hash)
      setStatus('Confirming...')
      await tx.wait()
      
      setStatus(`Minted ${quantity} NFT${quantity > 1 ? 's' : ''}!`)
      
      const totalSupplyAfter = await contract.totalSupply()
      const tokenId = Number(totalSupplyAfter)
      const seed = await contract.tokenSeeds(tokenId)
      
      const newNFT = { tokenId, seed }
      setMintedNFT(newNFT)
      setAllPage(1)
      setMyPage(1)
      
      fetchContractData(account)
    } catch (err) {
      setStatus('Error: ' + (err.reason || err.message?.slice(0, 50)))
    } finally {
      setIsMinting(false)
    }
  }

  const progress = (totalSupply / maxSupply) * 100

  return (
    <div className="mint-page">
      {/* Hero Section */}
      <div className="mint-hero">
        <h1>8bit PENGUINS</h1>
        <p>COLLECT • MINT •</p>
        <div className="header-links">
          <a href="https://x.com/8bitpenguins" target="_blank" rel="noopener noreferrer" className="x-btn">Follow us on X</a>
        </div>
      </div>

        {/* Two Column Layout */}
        <div className="mint-layout">
          {/* Left Column - Mint Card */}
          <div className="mint-card">
            <div className="mint-card-header">
              <span className="mint-card-title">Mint</span>
              <span className="mint-card-badge">Free</span>
            </div>

            {/* Supply Display */}
            <div className="mint-supply">
              <div className="mint-supply-header">
                <span className="mint-supply-label">Minted</span>
                <span className="mint-supply-value">{totalSupply}<span> / {maxSupply}</span></span>
              </div>
              <div className="mint-supply-bar">
                <div className="mint-supply-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="mint-supply-footer">
                <span>{maxSupply - totalSupply} remaining</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Network Button */}
            <button className="mint-network-btn" onClick={switchToBaseSepolia}>
              Switch to Base Sepolia
            </button>

            {/* Connect / Mint Form */}
            {!account ? (
              <button className="mint-connect-btn" onClick={connect}>Connect Wallet</button>
            ) : (
              <div className="mint-connected">
                <div className="mint-wallet">
                  <div className="mint-wallet-main">
                    <button className="mint-wallet-addr-btn" disabled>
                      {account.slice(0, 4)}...{account.slice(-3)}
                    </button>
                    <span className="mint-wallet-bal">{balance} Penguins</span>
                  </div>
                  <button className="mint-disconnect-btn" onClick={disconnectWallet}>
                    Disconnect
                  </button>
                </div>

                <div className="mint-quantity">
                  <button 
                    className="mint-quantity-btn"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >−</button>
                  <span className="mint-quantity-value">{quantity}</span>
                  <button 
                    className="mint-quantity-btn"
                    onClick={() => setQuantity(Math.min(maxPerWallet - mintedCount, quantity + 1, maxSupply - totalSupply))}
                    disabled={quantity >= maxPerWallet - mintedCount || totalSupply >= maxSupply}
                  >+</button>
                  <span className="mint-quantity-limit">max {maxPerWallet - mintedCount}</span>
                </div>

                <button 
                  className="mint-submit-btn"
                  onClick={mint}
                  disabled={isMinting || totalSupply >= maxSupply || mintedCount >= maxPerWallet}
                >
                  {isMinting ? 'Minting...' : totalSupply >= maxSupply ? 'Sold Out' : mintedCount >= maxPerWallet ? 'Max Reached' : 'Mint Free'}
                </button>

                {status && (
                  <div className={`mint-status ${status.includes('Error') ? 'error' : ''}`}>
                    {status}
                  </div>
                )}

                {lastTxHash && (
                  <a 
                    href={`https://sepolia.basescan.org/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mint-tx-link"
                  >
                    View Transaction ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Display */}
          <div className="mint-display">
            {/* Tabs */}
            <div className="mint-tabs">
              <button 
                className={`mint-tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => { setActiveTab('all'); setAllPage(1); }}
              >
                {`ALL NFTs (${allNFTs.length})`}
              </button>
              {account && (
                <button 
                  className={`mint-tab ${activeTab === 'my' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('my'); setMyPage(1); }}
                >
                  {`My NFTs (${myNFTs.length})`}
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div className="mint-tab-content">
              {activeTab === 'all' && (
                <GalleryWithPagination
                  nfts={allNFTs}
                  currentPage={allPage}
                  setPage={setAllPage}
                  refreshKey={metadataRefreshKey}
                />
              )}
              {account && activeTab === 'my' && (
                <GalleryWithPagination
                  nfts={myNFTs}
                  currentPage={myPage}
                  setPage={setMyPage}
                  refreshKey={metadataRefreshKey}
                />
              )}
            </div>
          </div>
        </div>
    </div>
  )
}

function GalleryWithPagination({ nfts, currentPage, setPage, refreshKey }) {
  const ITEMS_PER_PAGE = 8
  const totalPages = Math.max(1, Math.ceil(nfts.length / ITEMS_PER_PAGE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setPage(totalPages)
    }
  }, [currentPage, totalPages, setPage])

  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedNFTs = nfts.slice(startIdx, startIdx + ITEMS_PER_PAGE)

  if (nfts.length === 0) {
    return <div className="mint-empty">No NFTs found</div>
  }

  return (
    <>
      <div className="mint-gallery-grid">
        {paginatedNFTs.map((nft) => (
          <NFTGalleryItem
            key={`${nft.tokenId}-${refreshKey}`}
            tokenId={nft.tokenId}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="mint-pagination">
          <button 
            className="mint-page-btn" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span className="mint-page-info">{currentPage} / {totalPages}</span>
          <button 
            className="mint-page-btn" 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}

export default Mint


