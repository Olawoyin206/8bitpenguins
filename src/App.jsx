import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { uploadToIPFS, saveToSharedGallery, fetchSharedGallery } from './ipfs'
import './App.css'

const CONTRACT_ADDRESS = '0xd0510B85EdC7e077b57Ce6AD81D10253608eed92'

const contractABI = [
  "function mint() public payable",
  "function balanceOf(address owner) public view returns (uint256)"
]

const GRID_SIZE = 80

function convertToPenguinStyle(imageSrc, canvas) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      canvas.width = 400
      canvas.height = 400
      
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = 40
      tempCanvas.height = 40
      const tempCtx = tempCanvas.getContext('2d')
      
      tempCtx.drawImage(img, 0, 0, 40, 40)
      const imageData = tempCtx.getImageData(0, 0, 40, 40)
      const data = imageData.data
      
      const getPixel = (x, y) => {
        const i = (y * 40 + x) * 4
        return {
          r: data[i], g: data[i+1], b: data[i+2], a: data[i+3],
          hex: `#${data[i].toString(16).padStart(2,'0')}${data[i+1].toString(16).padStart(2,'0')}${data[i+2].toString(16).padStart(2,'0')}`
        }
      }
      
      const isTransparent = (p) => p.a < 128
      
      const getRegionColors = (x1, y1, x2, y2) => {
        const colors = []
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            const p = getPixel(x, y)
            if (!isTransparent(p)) colors.push(p)
          }
        }
        return colors
      }
      
      const avgColor = (colors) => {
        if (colors.length === 0) return { r: 93, g: 173, b: 226, hex: '#5DADE2' }
        let r = 0, g = 0, b = 0
        for (const c of colors) { r += c.r; g += c.g; b += c.b }
        r = Math.round(r / colors.length)
        g = Math.round(g / colors.length)
        b = Math.round(b / colors.length)
        return { r, g, b, hex: `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}` }
      }
      
      const adj = (c, a) => ({
        r: Math.min(255, Math.max(0, c.r + a)),
        g: Math.min(255, Math.max(0, c.g + a)),
        b: Math.min(255, Math.max(0, c.b + a)),
        hex: `#${Math.min(255, Math.max(0, c.r + a)).toString(16).padStart(2,'0')}${Math.min(255, Math.max(0, c.g + a)).toString(16).padStart(2,'0')}${Math.min(255, Math.max(0, c.b + a)).toString(16).padStart(2,'0')}`
      })
      
      const diff = (c1, c2) => Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
      const brightness = (c) => c.r + c.g + c.b
      
      // Sample ALL corners and edges for background
      const bgPixels = []
      // Top row
      for (let x = 0; x < 40; x++) bgPixels.push(getPixel(x, 0))
      // Bottom row  
      for (let x = 0; x < 40; x++) bgPixels.push(getPixel(x, 39))
      // Left column
      for (let y = 0; y < 40; y++) bgPixels.push(getPixel(0, y))
      // Right column
      for (let y = 0; y < 40; y++) bgPixels.push(getPixel(39, y))
      // Top-left corner area
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bgPixels.push(getPixel(x, y))
      // Top-right corner area
      for (let y = 0; y < 8; y++) for (let x = 32; x < 40; x++) bgPixels.push(getPixel(x, y))
      // Bottom-left corner area
      for (let y = 32; y < 40; y++) for (let x = 0; x < 8; x++) bgPixels.push(getPixel(x, y))
      // Bottom-right corner area
      for (let y = 32; y < 40; y++) for (let x = 32; x < 40; x++) bgPixels.push(getPixel(x, y))
      
      const faceColors = getRegionColors(10, 12, 29, 26)
      const shirtColors = getRegionColors(8, 28, 31, 39)
      
      let bg = avgColor(bgPixels.filter(p => !isTransparent(p)))
      let face = avgColor(faceColors)
      let shirt = avgColor(shirtColors)
      
      // Ensure differentiation - bg must be different from shirt
      if (diff(bg, shirt) < 60) {
        // Find a color that's different enough from both face and shirt
        for (let i = 0; i < bgPixels.length; i += 5) {
          const p = bgPixels[i]
          if (!isTransparent(p) && diff(p, shirt) > 50 && diff(p, face) > 40) {
            bg = p
            break
          }
        }
      }
      
      if (diff(face, shirt) < 40) {
        shirt = adj(face, brightness(face) > brightness(shirt) ? -60 : 60)
      }
      
      const faceHighlight = adj(face, 40)
      const faceShadow = adj(face, -40)
      const shirtHighlight = adj(shirt, 50)
      const shirtShadow = adj(shirt, -50)
      
      const traits = {
        background: { name: 'Custom', color: bg.hex },
        body: { name: 'Custom', base: shirt.hex, highlight: shirtHighlight.hex, shadow: shirtShadow.hex },
        belly: { name: 'Custom', base: face.hex, highlight: faceHighlight.hex, shadow: faceShadow.hex },
        beak: { name: 'Orange', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
        eyes: { name: 'Round', type: 'round', color: '#0A0A0A' },
        head: { name: 'None', type: 'none', color: '#323232' },
      }
      
      ctx.fillStyle = bg.hex
      ctx.fillRect(0, 0, 400, 400)
      
      const scale = 10
      const set = (x, y, color) => {
        if (x >= 0 && x < 40 && y >= 0 && y < 40) {
          ctx.fillStyle = color
          ctx.fillRect(x * scale, y * scale, scale, scale)
        }
      }
      
      const rect = (x1, y1, x2, y2, color) => {
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) set(x, y, color)
        }
      }
      
      const cx = 20
      
      rect(8, 25, 31, 38, shirt.hex)
      rect(7, 26, 32, 37, shirt.hex)
      rect(6, 27, 33, 36, shirt.hex)
      rect(6, 28, 33, 35, shirt.hex)
      rect(7, 29, 32, 34, shirt.hex)
      rect(8, 30, 31, 33, shirt.hex)
      rect(9, 31, 30, 32, shirt.hex)
      rect(10, 32, 29, 32, shirt.hex)
      rect(10, 26, 29, 27, shirtHighlight.hex)
      rect(9, 28, 30, 28, shirtHighlight.hex)
      rect(10, 30, 29, 30, shirtHighlight.hex)
      rect(11, 32, 28, 32, shirtHighlight.hex)
      rect(8, 38, 31, 38, shirtShadow.hex)
      rect(7, 37, 32, 37, shirtShadow.hex)
      rect(6, 36, 33, 36, shirtShadow.hex)
      
      rect(12, 28, 27, 38, face.hex)
      rect(11, 29, 28, 37, face.hex)
      rect(11, 30, 28, 36, face.hex)
      rect(12, 31, 27, 35, face.hex)
      rect(13, 32, 26, 34, face.hex)
      rect(14, 33, 25, 34, face.hex)
      rect(15, 34, 24, 35, face.hex)
      rect(14, 29, 25, 30, faceHighlight.hex)
      rect(14, 31, 25, 32, faceHighlight.hex)
      rect(15, 33, 24, 34, faceHighlight.hex)
      
      rect(10, 8, 29, 26, shirt.hex)
      rect(9, 9, 30, 25, shirt.hex)
      rect(8, 10, 31, 24, shirt.hex)
      rect(8, 11, 31, 23, shirt.hex)
      rect(9, 12, 30, 22, shirt.hex)
      rect(10, 13, 29, 21, shirt.hex)
      rect(11, 14, 28, 20, shirt.hex)
      rect(12, 15, 27, 19, shirt.hex)
      rect(13, 16, 26, 18, shirt.hex)
      rect(14, 17, 25, 18, shirt.hex)
      rect(12, 9, 27, 10, shirtHighlight.hex)
      rect(11, 11, 28, 12, shirtHighlight.hex)
      rect(12, 13, 27, 14, shirtHighlight.hex)
      rect(13, 15, 26, 16, shirtHighlight.hex)
      rect(14, 17, 25, 17, shirtHighlight.hex)
      rect(10, 26, 29, 26, shirtShadow.hex)
      rect(9, 25, 30, 25, shirtShadow.hex)
      rect(8, 24, 31, 24, shirtShadow.hex)
      
      rect(12, 14, 27, 24, face.hex)
      rect(11, 15, 28, 23, face.hex)
      rect(12, 16, 27, 22, face.hex)
      rect(13, 17, 26, 21, face.hex)
      rect(14, 18, 25, 20, face.hex)
      rect(15, 19, 24, 20, face.hex)
      rect(14, 15, 25, 16, faceHighlight.hex)
      rect(14, 17, 25, 18, faceHighlight.hex)
      rect(15, 19, 24, 20, faceHighlight.hex)
      
      const eyeY = 17
      
      rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A')
      rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A')
      rect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF')
      rect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A')
      rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A')
      rect(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF')
      
      rect(cx - 7, 14, cx - 3, 14, shirtShadow.hex)
      rect(cx + 3, 14, cx + 7, 14, shirtShadow.hex)
      rect(cx - 8, 13, cx - 4, 13, shirtShadow.hex)
      rect(cx + 4, 13, cx + 8, 13, shirtShadow.hex)
      
      rect(2, 26, 5, 32, shirt.hex)
      rect(1, 27, 6, 31, shirt.hex)
      rect(2, 28, 5, 30, shirtHighlight.hex)
      rect(34, 26, 37, 32, shirt.hex)
      rect(33, 27, 38, 31, shirt.hex)
      rect(34, 28, 37, 30, shirtHighlight.hex)
      
      rect(10, 37, 14, 38, '#FF9F43')
      rect(9, 38, 15, 38, '#FF9F43')
      rect(25, 37, 29, 38, '#FF9F43')
      rect(24, 38, 30, 38, '#FF9F43')
      
      rect(8, 38, 31, 38, 'rgba(0,0,0,0.3)')
      
      resolve(traits)
    }
    img.src = imageSrc
  })
}

const TRAITS = {
  background: [
    { name: 'Soft Pink', color: '#FADBD8', weight: 20 },
    { name: 'Mint Green', color: '#D5F5E3', weight: 20 },
    { name: 'Peach', color: '#FAD7A0', weight: 15 },
    { name: 'Lavender', color: '#E8DAEF', weight: 15 },
    { name: 'Sky Blue', color: '#D4E6F1', weight: 15 },
    { name: 'Cream', color: '#FCF3CF', weight: 15 },
  ],
  body: [
    { name: 'Sky Blue', base: '#5DADE2', highlight: '#85C1E9', shadow: '#3498DB', weight: 15 },
    { name: 'Ocean Blue', base: '#3498DB', highlight: '#5DADE2', shadow: '#2471A3', weight: 15 },
    { name: 'Cobalt', base: '#2E86AB', highlight: '#54A0FF', shadow: '#1F618D', weight: 12 },
    { name: 'Purple', base: '#8E44AD', highlight: '#A569BD', shadow: '#6C3483', weight: 12 },
    { name: 'Pink', base: '#E91E63', highlight: '#EC407A', shadow: '#C2185B', weight: 12 },
    { name: 'Green', base: '#27AE60', highlight: '#58D68D', shadow: '#1E8449', weight: 12 },
    { name: 'Coral', base: '#E74C3C', highlight: '#EC7063', shadow: '#C0392B', weight: 12 },
    { name: 'Yellow', base: '#F39C12', highlight: '#F7DC6F', shadow: '#D68910', weight: 10 },
  ],
  belly: [
    { name: 'Cream', base: '#FDF5E6', highlight: '#FFFAF0', shadow: '#F5E6D3', weight: 50 },
    { name: 'White', base: '#FFFFFF', highlight: '#FFFFFF', shadow: '#F0F0F0', weight: 30 },
    { name: 'Peach', base: '#FFDAB9', highlight: '#FFE4C4', shadow: '#F5CBA7', weight: 20 },
  ],
  beak: [
    { name: 'Small', type: 'small', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 20 },
    { name: 'Large', type: 'large', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 20 },
    { name: 'Wide', type: 'wide', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 15 },
    { name: 'Pointy', type: 'pointy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 15 },
    { name: 'Round', type: 'round', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 15 },
    { name: 'Coral Small', type: 'small', base: '#FF6B6B', highlight: '#FF8787', shadow: '#EE5A5A', weight: 15 },
  ],
  eyes: [
    { name: 'Round', type: 'round', weight: 20 },
    { name: 'Tender', type: 'tender', weight: 15 },
    { name: 'Curious', type: 'curious', weight: 15 },
    { name: 'Sleepy', type: 'sleepy', weight: 12 },
    { name: 'Sparkle', type: 'sparkle', weight: 15 },
    { name: 'Happy', type: 'happy', weight: 13 },
    { name: 'Wink', type: 'wink', weight: 10 },
  ],
  head: [
    { name: 'None', type: 'none', weight: 30 },
    { name: 'Crown', type: 'crown', weight: 12 },
    { name: 'Top Hat', type: 'tophat', weight: 12 },
    { name: 'Beanie', type: 'beanie', weight: 12 },
    { name: 'Bow', type: 'bow', weight: 12 },
    { name: 'Cap', type: 'cap', weight: 12 },
    { name: 'Scarf', type: 'scarf', weight: 10 },
  ],
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

function drawAgent(traits, canvas) {
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  const scale = 10
  canvas.width = 400
  canvas.height = 400
  
  ctx.fillStyle = traits.background.color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  const set = (x, y, color) => {
    if (x >= 0 && x < 40 && y >= 0 && y < 40) {
      ctx.fillStyle = color
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  
  const rect = (x1, y1, x2, y2, color) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) set(x, y, color)
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
  
  const cx = 20
  
  // Body - detailed pixel art
  // Main body shape
  rect(8, 25, 31, 38, body)
  rect(7, 26, 32, 37, body)
  rect(6, 27, 33, 36, body)
  rect(6, 28, 33, 35, body)
  rect(7, 29, 32, 34, body)
  rect(8, 30, 31, 33, body)
  rect(9, 31, 30, 32, body)
  rect(10, 32, 29, 32, body)
  
  // Body highlights
  rect(10, 26, 29, 27, bodyHighlight)
  rect(9, 28, 30, 28, bodyHighlight)
  rect(10, 30, 29, 30, bodyHighlight)
  rect(11, 32, 28, 32, bodyHighlight)
  
  // Body shadows
  rect(8, 38, 31, 38, bodyShadow)
  rect(7, 37, 32, 37, bodyShadow)
  rect(6, 36, 33, 36, bodyShadow)
  
  // Body texture/detail pixels
  rect(12, 27, 12, 27, bodyShadow)
  rect(28, 27, 28, 27, bodyShadow)
  rect(10, 29, 10, 29, bodyShadow)
  rect(30, 29, 30, 29, bodyShadow)
  rect(8, 31, 8, 31, bodyShadow)
  rect(32, 31, 32, 31, bodyShadow)
  
  // Belly - white front
  rect(12, 28, 27, 38, belly)
  rect(11, 29, 28, 37, belly)
  rect(11, 30, 28, 36, belly)
  rect(12, 31, 27, 35, belly)
  rect(13, 32, 26, 34, belly)
  rect(14, 33, 25, 34, belly)
  rect(15, 34, 24, 35, belly)
  
  // Belly highlights
  rect(14, 29, 25, 30, bellyHighlight)
  rect(14, 31, 25, 32, bellyHighlight)
  rect(15, 33, 24, 34, bellyHighlight)
  
  // Belly texture
  rect(15, 35, 15, 35, bellyHighlight)
  rect(24, 35, 24, 35, bellyHighlight)
  rect(16, 36, 16, 36, bellyHighlight)
  rect(23, 36, 23, 36, bellyHighlight)
  
  // Head
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
  
  // Head highlights
  rect(12, 9, 27, 10, bodyHighlight)
  rect(11, 11, 28, 12, bodyHighlight)
  rect(12, 13, 27, 14, bodyHighlight)
  rect(13, 15, 26, 16, bodyHighlight)
  rect(14, 17, 25, 17, bodyHighlight)
  
  // Head shadow
  rect(10, 26, 29, 26, bodyShadow)
  rect(9, 25, 30, 25, bodyShadow)
  rect(8, 24, 31, 24, bodyShadow)
  
  // Head texture/details
  rect(11, 10, 11, 10, bodyShadow)
  rect(28, 10, 28, 10, bodyShadow)
  rect(10, 12, 10, 12, bodyShadow)
  rect(29, 12, 29, 12, bodyShadow)
  rect(10, 14, 10, 14, bodyShadow)
  rect(29, 14, 29, 14, bodyShadow)
  
  // Face - white area
  rect(12, 14, 27, 24, belly)
  rect(11, 15, 28, 23, belly)
  rect(12, 16, 27, 22, belly)
  rect(13, 17, 26, 21, belly)
  rect(14, 18, 25, 20, belly)
  rect(15, 19, 24, 20, belly)
  
  // Face highlights
  rect(14, 15, 25, 16, bellyHighlight)
  rect(14, 17, 25, 18, bellyHighlight)
  rect(15, 19, 24, 20, bellyHighlight)
  
  // Eyes - based on type
  const eyeY = 17
  
  if (traits.eyes.type === 'round') {
    // Round eyes
    rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A')
    rect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF')
    rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF')
    rect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A')
    rect(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF')
    rect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#FFFFFF')
  } else if (traits.eyes.type === 'tender') {
    // Tender eyes - slightly closed
    rect(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx - 5, eyeY, cx - 4, eyeY + 1, '#FFFFFF')
    rect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A')
    rect(cx + 4, eyeY, cx + 5, eyeY + 1, '#FFFFFF')
  } else if (traits.eyes.type === 'curious') {
    // Curious eyes - looking up
    rect(cx - 5, eyeY - 1, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx - 6, eyeY, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx - 5, eyeY - 1, cx - 4, eyeY - 1, '#FFFFFF')
    rect(cx + 3, eyeY - 1, cx + 5, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY, cx + 6, eyeY + 1, '#0A0A0A')
    rect(cx + 4, eyeY - 1, cx + 5, eyeY - 1, '#FFFFFF')
  } else if (traits.eyes.type === 'sleepy') {
    // Sleepy eyes - half closed
    rect(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A')
    rect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A')
  } else if (traits.eyes.type === 'sparkle') {
    // Sparkle eyes - star highlights
    rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A')
    rect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF')
    rect(cx - 3, eyeY + 2, cx - 3, eyeY + 2, '#FFFFFF')
    rect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A')
    rect(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF')
    rect(cx + 5, eyeY + 2, cx + 5, eyeY + 2, '#FFFFFF')
  } else if (traits.eyes.type === 'happy') {
    // Happy eyes - curved
    rect(cx - 6, eyeY, cx - 2, eyeY + 2, '#0A0A0A')
    rect(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx + 2, eyeY, cx + 6, eyeY + 2, '#0A0A0A')
    rect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A')
  } else if (traits.eyes.type === 'wink') {
    // Wink - one eye closed
    rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A')
    rect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF')
    rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF')
    // Right eye winking
    rect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A')
  }
  
  // Eyebrows
  if (traits.eyes.type !== 'sleepy') {
    rect(cx - 7, 14, cx - 3, 14, bodyShadow)
    rect(cx + 3, 14, cx + 7, 14, bodyShadow)
    rect(cx - 8, 13, cx - 4, 13, bodyShadow)
    rect(cx + 4, 13, cx + 8, 13, bodyShadow)
  }
  
  // Beak - based on type
  if (traits.beak.type === 'small') {
    rect(cx - 2, 21, cx + 1, 23, beak)
    rect(cx - 1, 20, cx, 22, beak)
    rect(cx - 1, 22, cx, 22, beakShadow)
  } else if (traits.beak.type === 'large') {
    rect(cx - 4, 20, cx + 3, 24, beak)
    rect(cx - 3, 19, cx + 2, 23, beak)
    rect(cx - 2, 19, cx + 1, 20, beak)
    rect(cx - 3, 24, cx + 2, 24, beakShadow)
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
  } else {
    // Default small
    rect(cx - 3, 21, cx + 2, 23, beak)
    rect(cx - 2, 20, cx + 1, 22, beak)
    rect(cx - 1, 20, cx, 21, beak)
    rect(cx - 2, 22, cx + 1, 22, beakShadow)
    rect(cx - 3, 21, cx - 3, 22, beakShadow)
  }
  
  // Cheeks
  rect(cx - 9, 19, cx - 7, 21, '#FFB6C1')
  rect(cx + 7, 19, cx + 9, 21, '#FFB6C1')
  rect(cx - 8, 20, cx - 7, 20, '#FFC5CD')
  rect(cx + 7, 20, cx + 8, 20, '#FFC5CD')
  
  // Head accessories
  if (traits.head.type === 'crown') {
    rect(cx - 9, 6, cx + 9, 8, '#FFD700')
    rect(cx - 8, 4, cx - 6, 8, '#FFD700')
    rect(cx - 3, 2, cx - 1, 8, '#FFD700')
    rect(cx + 1, 2, cx + 3, 8, '#FFD700')
    rect(cx + 6, 4, cx + 8, 8, '#FFD700')
    // Crown jewels
    rect(cx - 4, 5, cx - 2, 6, '#FF0000')
    rect(cx + 2, 5, cx + 4, 6, '#FF0000')
  } else if (traits.head.type === 'tophat') {
    rect(cx - 10, 6, cx + 10, 9, '#1A1A1A')
    rect(cx - 9, 5, cx + 9, 7, '#2D2D2D')
    rect(cx - 4, 2, cx + 3, 6, '#1A1A1A')
    rect(cx - 11, 8, cx + 11, 9, '#8B0000')
    rect(cx - 2, 3, cx + 1, 4, '#C0C0C0')
  } else if (traits.head.type === 'beanie') {
    rect(cx - 10, 6, cx + 10, 9, '#D32F2F')
    rect(cx - 9, 4, cx + 9, 7, '#E53935')
    rect(cx - 8, 3, cx + 8, 5, '#EF5350')
    rect(cx - 3, 2, cx + 2, 4, '#FFCDD2')
    rect(cx - 2, 1, cx + 1, 3, '#FFFFFF')
  } else if (traits.head.type === 'bow') {
    rect(cx - 10, 7, cx - 7, 9, '#FF69B4')
    rect(cx + 7, 7, cx + 10, 9, '#FF69B4')
    rect(cx - 6, 7, cx + 6, 9, '#FF1493')
    rect(cx - 8, 6, cx - 6, 8, '#FFB6C1')
    rect(cx + 6, 6, cx + 8, 8, '#FFB6C1')
    rect(cx - 2, 8, cx + 1, 8, '#FF1493')
  } else if (traits.head.type === 'cap') {
    rect(cx - 10, 7, cx + 9, 9, '#1976D2')
    rect(cx - 9, 6, cx + 8, 8, '#2196F3')
    rect(cx + 8, 8, cx + 12, 10, '#1565C0')
    rect(cx + 10, 9, cx + 12, 10, '#0D47A1')
    rect(cx - 11, 8, cx - 9, 9, '#1565C0')
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 24, cx + 10, 27, '#388E3C')
    rect(cx - 9, 23, cx + 9, 25, '#4CAF50')
    rect(cx + 8, 24, cx + 11, 32, '#388E3C')
    rect(cx + 9, 25, cx + 10, 31, '#4CAF50')
    rect(cx - 2, 25, cx + 1, 26, '#2E7D32')
  }
  
  // Flippers - detailed pixel art (fixed to stay in bounds)
  // Left flipper
  rect(2, 26, 5, 32, body)
  rect(1, 27, 6, 31, body)
  rect(2, 28, 5, 30, bodyHighlight)
  rect(3, 29, 5, 29, bodyHighlight)
  rect(2, 30, 4, 31, bodyShadow)
  rect(1, 31, 3, 32, bodyShadow)
  // Flipper fingers
  rect(1, 30, 3, 33, body)
  rect(2, 31, 3, 32, bodyHighlight)
  rect(5, 31, 7, 33, body)
  rect(6, 32, 7, 33, bodyHighlight)
  
  // Right flipper
  rect(34, 26, 37, 32, body)
  rect(33, 27, 38, 31, body)
  rect(34, 28, 37, 30, bodyHighlight)
  rect(34, 29, 36, 29, bodyHighlight)
  rect(35, 30, 37, 31, bodyShadow)
  rect(36, 31, 38, 32, bodyShadow)
  // Flipper fingers
  rect(36, 30, 38, 33, body)
  rect(36, 31, 37, 32, bodyHighlight)
  rect(32, 31, 34, 33, body)
  rect(32, 32, 33, 33, bodyHighlight)
  
  // Feet - detailed (fixed to stay in bounds)
  // Left foot
  rect(10, 37, 14, 38, beak)
  rect(9, 38, 15, 38, beak)
  rect(11, 36, 13, 37, beakHighlight)
  rect(10, 38, 13, 38, beakShadow)
  // Toes
  rect(8, 38, 10, 39, beak)
  rect(9, 38, 10, 39, beakHighlight)
  rect(12, 38, 14, 39, beak)
  rect(13, 38, 14, 39, beakHighlight)
  
  // Right foot
  rect(25, 37, 29, 38, beak)
  rect(24, 38, 30, 38, beak)
  rect(26, 36, 28, 37, beakHighlight)
  rect(25, 38, 28, 38, beakShadow)
  // Toes
  rect(25, 38, 27, 39, beak)
  rect(26, 38, 27, 39, beakHighlight)
  rect(29, 38, 31, 39, beak)
  rect(24, 39, 25, 40, beakHighlight)
  rect(26, 39, 28, 40, beak)
  rect(27, 39, 28, 40, beakHighlight)
  rect(29, 39, 31, 39, beak)
  rect(30, 39, 31, 39, beakHighlight)
  
  // Ground shadow
  rect(8, 38, 31, 38, 'rgba(0,0,0,0.3)')
}

function App() {
  const [account, setAccount] = useState(null)
  const [traits, setTraits] = useState(null)
  const [status, setStatus] = useState('')
  const [ogMode, setOgMode] = useState(false)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [confetti, setConfetti] = useState([])
  const [hasGenerated, setHasGenerated] = useState(false)
  const [hasOgGenerated, setHasOgGenerated] = useState(false)
  const [idleMatrix, setIdleMatrix] = useState(() => 
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      chars: Array.from({ length: 25 }).map(() => Math.random() > 0.5 ? '1' : '0').join('')
    }))
  )
  const [savedPenguins, setSavedPenguins] = useState(() => {
    const saved = localStorage.getItem('savedPenguins')
    return saved ? JSON.parse(saved) : []
  })
  const [sharedGallery, setSharedGallery] = useState([])
  const [selectedPenguin, setSelectedPenguin] = useState(null)
  const [modalPenguin, setModalPenguin] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [galleryTab, setGalleryTab] = useState('generated')
  const [cooldown, setCooldown] = useState(0)
  const itemsPerPage = 20
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  
  useEffect(() => {
    localStorage.setItem('savedPenguins', JSON.stringify(savedPenguins))
  }, [savedPenguins])

  useEffect(() => {
    fetchSharedGallery().then(gallery => setSharedGallery(gallery))
  }, [])

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
        if (accounts[0]) setAccount(accounts[0])
      })
    }
  }, [])

  useEffect(() => {
    if (canvasRef.current && !ogMode && hasGenerated && traits) {
      drawAgent(traits, canvasRef.current)
    }
  }, [traits, ogMode, hasGenerated])

  const [mode, setMode] = useState('generate') // 'generate' or 'og'

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setIsGenerating(true)
    setIsRevealing(false)
    setConfetti([])
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = async () => {
        setOgMode(true)
        setHasOgGenerated(true)
        
        setTimeout(async () => {
          const extractedTraits = await convertToPenguinStyle(event.target.result, canvasRef.current)
            setTraits(extractedTraits)
            setUploadedImage(event.target.result)
            setIsGenerating(false)
            setIsRevealing(true)
            
            // Generate confetti
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C00', '#39FF14', '#FF1493']
            const newConfetti = Array.from({ length: 40 }, (_, i) => ({
              id: i,
              left: 2 + Math.random() * 96,
              color: colors[Math.floor(Math.random() * colors.length)],
              delay: Math.random() * 0.25,
              size: 6 + Math.random() * 8
            }))
            setConfetti(newConfetti)
            
            // Clear confetti after animation
            setTimeout(() => setConfetti([]), 1200)
            
            // Save penguin immediately with local image
            const newPenguin = {
              id: Date.now(),
              cid: null,
              image: canvasRef.current.toDataURL(),
              traits: extractedTraits,
              isOg: true,
              timestamp: Date.now()
            }
            setSavedPenguins([newPenguin, ...savedPenguins])
            
            // Upload to IPFS in background
            uploadToIPFS(canvasRef).then(ipfsData => {
              if (ipfsData) {
                const updatedPenguin = { ...newPenguin, cid: ipfsData.cid, image: ipfsData.url }
                setSavedPenguins(prev => prev.map(p => p.id === newPenguin.id ? updatedPenguin : p))
                saveToSharedGallery(updatedPenguin).then(() => fetchSharedGallery().then(setSharedGallery))
              }
            })
            
            // Save to shared gallery immediately too
            saveToSharedGallery(newPenguin).then(() => fetchSharedGallery().then(setSharedGallery))
        }, 200)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const clearOg = () => {
    setOgMode(false)
    setUploadedImage(null)
    setTraits(null)
    setHasOgGenerated(false)
    setHasGenerated(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    drawAgent({ 
      background: TRAITS.background[0],
      body: TRAITS.body[0], 
      belly: TRAITS.belly[0], 
      beak: TRAITS.beak[0], 
      eyes: TRAITS.eyes[0],
      head: TRAITS.head[0],
    }, canvasRef.current)
  }

  const connect = async () => {
    if (!window.ethereum) {
      setStatus('Install MetaMask')
      return
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(accounts[0])
      setStatus('Connected')
    } catch (e) {
      setStatus('Error: ' + e.message)
    }
  }

  const generate = async () => {
    if (cooldown > 0) return
    setIsGenerating(true)
    setIsRevealing(false)
    setConfetti([])
    setHasGenerated(true)
    setCooldown(10)
    
    setTimeout(() => {
      const t = {
        background: randomItem(TRAITS.background),
        body: randomItem(TRAITS.body),
        belly: randomItem(TRAITS.belly),
        beak: randomItem(TRAITS.beak),
        eyes: randomItem(TRAITS.eyes),
        head: randomItem(TRAITS.head),
      }
      setTraits(t)
      
      setTimeout(async () => {
        setOgMode(false)
        drawAgent(t, canvasRef.current)
        setIsGenerating(false)
        
        // Trigger reveal animation
        setIsRevealing(true)
        
        // Generate confetti from top
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C00', '#39FF14', '#FF1493']
        const newConfetti = Array.from({ length: 40 }, (_, i) => ({
          id: i,
          left: 2 + Math.random() * 96,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: Math.random() * 0.25,
          size: 6 + Math.random() * 8
        }))
        setConfetti(newConfetti)
        
        // Clear confetti after animation
        setTimeout(() => setConfetti([]), 1200)
        
        // Save penguin immediately with local image
        const newPenguin = {
          id: Date.now(),
          cid: null,
          image: canvasRef.current.toDataURL(),
          traits: t,
          isOg: false,
          timestamp: Date.now()
        }
        setSavedPenguins([newPenguin, ...savedPenguins])
        
        // Upload to IPFS in background
        uploadToIPFS(canvasRef).then(ipfsData => {
          if (ipfsData) {
            const updatedPenguin = { ...newPenguin, cid: ipfsData.cid, image: ipfsData.url }
            setSavedPenguins(prev => prev.map(p => p.id === newPenguin.id ? updatedPenguin : p))
            saveToSharedGallery(updatedPenguin).then(() => fetchSharedGallery().then(setSharedGallery))
          }
        })
        
        // Save to shared gallery immediately too
        saveToSharedGallery(newPenguin).then(() => fetchSharedGallery().then(setSharedGallery))
      }, 200)
    }, 1500)
  }

  const mint = async () => {
    if (!account) {
      setStatus('Connect wallet first')
      return
    }
    if (!traits) {
      setStatus('Generate first')
      return
    }
    try {
      setStatus('Minting...')
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = provider.getSigner()
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)
      const tx = await contract.mint({ value: 0 })
      setStatus('Waiting...')
      await tx.wait()
      setStatus('Minted!')
    } catch (e) {
      setStatus('Error: ' + (e.reason || e.message?.slice(0, 30)))
    }
  }

  const save = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = ogMode ? 'og-penguin.png' : 'penguin.png'
    link.href = canvasRef.current.toDataURL()
    link.click()
    setStatus('Downloaded!')
  }
  
  const loadPenguin = (penguin) => {
    setModalPenguin(penguin)
  }
  
  const closeModal = () => {
    setModalPenguin(null)
  }

  return (
    <div className="app">
      <header>
        <h1>8bit Penguins</h1>
        <p>Generate or transform into 8-bit penguins</p>
        <a href="https://x.com/8bitpenguins" target="_blank" rel="noopener noreferrer" className="x-btn">Follow us on X</a>
      </header>

      <main>
        <div className="preview">
          <div className="tabs">
            <button 
              className={`tab ${mode === 'generate' ? 'active' : ''}`}
              onClick={() => { setMode('generate'); setTraits(null); setHasGenerated(false); setHasOgGenerated(false); }}
            >
              Generate
            </button>
            <button 
              className={`tab ${mode === 'og' ? 'active' : ''}`}
              onClick={() => { setMode('og'); setTraits(null); setHasGenerated(false); setHasOgGenerated(false); }}
            >
              Transform PFP
            </button>
          </div>
          
          <div className={`canvas-wrap ${isGenerating ? 'generating' : ''} ${isRevealing ? 'reveal' : ''} ${!hasGenerated && !hasOgGenerated ? 'matrix-idle' : ''}`}>
            <canvas ref={canvasRef} style={{ opacity: (hasGenerated || hasOgGenerated) ? 1 : 0 }} />
            {(isGenerating || !hasGenerated && !hasOgGenerated) && (
              <div className="matrix-rain">
                {idleMatrix.map((col) => (
                  <div 
                    key={col.id} 
                    className="matrix-column"
                    data-chars={col.chars}
                    style={{ 
                      animationDuration: isGenerating ? `${0.3 + Math.random() * 0.4}s` : '0s',
                      animationDelay: isGenerating ? `${Math.random() * 0.3}s` : '0s'
                    }}
                  >
                    {col.chars}
                  </div>
                ))}
              </div>
            )}
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
          
{mode === 'og' && (
            <div className="og-section">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="og-upload"
              />
              <label htmlFor="og-upload" className="btn white">
                Upload Your PFP
              </label>
              <button className="btn" onClick={save}>Save</button>
            </div>
          )}

          <div className="btns">
            {mode === 'generate' && (
              <>
                <button className="btn" onClick={generate} disabled={isGenerating || cooldown > 0}>
                  {isGenerating ? 'Generating...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Generate'}
                </button>
                <button className="btn" onClick={save} disabled={!traits}>Save</button>
              </>
            )}
          </div>
          <p className="status">{status}</p>
        </div>

        <div className="traits">
          <h2>{ogMode ? 'Transform PFP' : 'Traits'}</h2>
          {traits ? (
            <ul>
              {!ogMode ? (
                <>
                  <li><span>Background</span><span>{traits.background.name}</span></li>
                  <li><span>Body</span><span>{traits.body.name}</span></li>
                  <li><span>Belly</span><span>{traits.belly.name}</span></li>
                  <li><span>Beak</span><span>{traits.beak.name}</span></li>
                  <li><span>Eyes</span><span>{traits.eyes.name}</span></li>
                  <li><span>Head</span><span>{traits.head.name}</span></li>
                </>
              ) : (
                <>
                  <li><span>Style</span><span>Custom OG</span></li>
                  <li><span>Badge</span><span>              Transform PFP</span></li>
                </>
              )}
            </ul>
          ) : <p className="empty">-</p>}
        </div>
        
        {(() => {
          const allPenguins = [...sharedGallery, ...savedPenguins]
          const generatedCount = allPenguins.filter(p => !p.isOg).length
          const transformedCount = allPenguins.filter(p => p.isOg).length
          const filteredPenguins = allPenguins.filter(p => galleryTab === 'generated' ? !p.isOg : p.isOg)
          const uniquePenguins = filteredPenguins.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx)
          
          return (
            <div className="gallery">
              <div className="gallery-tabs">
                <button 
                  className={`gallery-tab ${galleryTab === 'generated' ? 'active' : ''}`}
                  onClick={() => { setGalleryTab('generated'); setCurrentPage(1); }}
                >
                  Generated ({generatedCount})
                </button>
                <button 
                  className={`gallery-tab ${galleryTab === 'transformed' ? 'active' : ''}`}
                  onClick={() => { setGalleryTab('transformed'); setCurrentPage(1); }}
                >
                  Transformed ({transformedCount})
                </button>
              </div>
              <div className="gallery-grid">
                {uniquePenguins.length === 0 ? (
                  <p className="empty">No {galleryTab === 'generated' ? 'generated' : 'transformed'} penguins yet. Be the first to create one!</p>
                ) : (
                  uniquePenguins
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((penguin, idx) => (
                      <div 
                        key={penguin.id || idx} 
                        className="gallery-item"
                        onClick={() => loadPenguin(penguin)}
                      >
                        <img src={penguin.image} alt="Penguin" />
                      </div>
                    ))
                )}
              </div>
              {uniquePenguins.length > itemsPerPage && (
                <div className="pagination">
                  <button 
                    className="page-btn" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  <span className="page-info">
                    {currentPage} / {Math.max(1, Math.ceil(uniquePenguins.length / itemsPerPage))}
                  </span>
                  <button 
                    className="page-btn" 
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(uniquePenguins.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(uniquePenguins.length / itemsPerPage)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )
        })()}
        
        {modalPenguin && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={closeModal}>×</button>
              <img src={modalPenguin.image} alt="Penguin" className="modal-image" />
              <div className="modal-traits">
                <h3>{modalPenguin.isOg ? 'Transform PFP' : 'Traits'}</h3>
                {!modalPenguin.isOg ? (
                  <ul>
                    <li><span>Background</span><span>{modalPenguin.traits.background.name}</span></li>
                    <li><span>Body</span><span>{modalPenguin.traits.body.name}</span></li>
                    <li><span>Belly</span><span>{modalPenguin.traits.belly.name}</span></li>
                    <li><span>Beak</span><span>{modalPenguin.traits.beak.name}</span></li>
                    <li><span>Eyes</span><span>{modalPenguin.traits.eyes.name}</span></li>
                    <li><span>Head</span><span>{modalPenguin.traits.head.name}</span></li>
                  </ul>
                ) : (
                  <ul>
                    <li><span>Badge</span><span>Transform PFP</span></li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
