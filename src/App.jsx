import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { uploadToIPFS, saveToSharedGallery, fetchFreshGallery } from './ipfs'
import './App.css'

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
        beak: { name: 'Small', type: 'small', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
        eyes: { name: 'Round', type: 'round', color: '#0A0A0A' },
        head: { name: 'None', type: 'none', color: '#323232' },
        feet: { name: 'Default Orange', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
        cheeks: { name: 'Pink', base: '#FFB6C1', highlight: '#FFD1D7', shadow: '#FF91A4' },
      }
      
      ctx.fillStyle = bg.hex
      ctx.fillRect(0, 0, 400, 400)
      
      const scale = 9
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
      
      // Beak
      rect(cx - 2, 21, cx + 1, 23, '#FF9F43')
      rect(cx - 1, 20, cx, 22, '#FF9F43')
      rect(cx - 1, 22, cx, 22, '#E67E22')
      
      // Cheeks
      rect(cx - 9, 19, cx - 7, 21, '#FFB6C1')
      rect(cx + 7, 19, cx + 9, 21, '#FFB6C1')
      rect(cx - 8, 20, cx - 7, 20, '#FFC5CD')
      rect(cx + 7, 20, cx + 8, 20, '#FFC5CD')
      
      rect(2, 26, 5, 32, shirt.hex)
      rect(1, 27, 6, 31, shirt.hex)
      rect(2, 28, 5, 30, shirtHighlight.hex)
      rect(34, 26, 37, 32, shirt.hex)
      rect(33, 27, 38, 31, shirt.hex)
      rect(34, 28, 37, 30, shirtHighlight.hex)
      
      // Feet
      rect(10, 37, 14, 38, traits.feet.base)
      rect(9, 38, 15, 38, traits.feet.base)
      rect(11, 36, 13, 37, traits.feet.highlight)
      rect(10, 38, 13, 38, traits.feet.shadow)
      rect(8, 38, 10, 39, traits.feet.base)
      rect(9, 38, 10, 39, traits.feet.highlight)
      rect(12, 38, 14, 39, traits.feet.base)
      rect(13, 38, 14, 39, traits.feet.highlight)
      rect(25, 37, 29, 38, traits.feet.base)
      rect(24, 38, 30, 38, traits.feet.base)
      rect(26, 36, 28, 37, traits.feet.highlight)
      rect(25, 38, 28, 38, traits.feet.shadow)
      rect(25, 38, 27, 39, traits.feet.base)
      rect(26, 38, 27, 39, traits.feet.highlight)
      rect(29, 38, 31, 39, traits.feet.base)
      rect(24, 39, 25, 40, traits.feet.highlight)
      rect(26, 39, 28, 40, traits.feet.base)
      rect(27, 39, 28, 40, traits.feet.highlight)
      rect(29, 39, 31, 39, traits.feet.base)
      rect(30, 39, 31, 39, traits.feet.highlight)
      
      rect(8, 38, 31, 38, 'rgba(0,0,0,0.3)')
      
      resolve(traits)
    }
    img.src = imageSrc
  })
}

const TRAITS = {
  background: [
    { name: 'Light Blue', color: '#ADD8E6', weight: 15 },
    { name: 'Sky Blue', color: '#87CEEB', weight: 15 },
    { name: 'Lavender', color: '#E6E6FA', weight: 12 },
    { name: 'Baby Pink', color: '#FFB6C1', weight: 12 },
    { name: 'Cream', color: '#FFFDD0', weight: 12 },
    { name: 'Peach', color: '#FFDAB9', weight: 12 },
    { name: 'Teal', color: '#008080', weight: 10 },
    { name: 'Ice Blue', color: '#F0F8FF', weight: 10 },
    { name: 'Arctic White', color: '#F0FFFF', weight: 8 },
    { name: 'Gold', color: '#FFD700', weight: 3 },
    { name: 'Rainbow', color: 'rainbow', weight: 1 },
  ],
  body: [
    { name: 'Classic', base: '#2C3E50', highlight: '#34495E', shadow: '#1A252F', weight: 15 },
    { name: 'Baby Blue', base: '#74B9FF', highlight: '#A3D1FF', shadow: '#0984E3', weight: 12 },
    { name: 'Navy Blue', base: '#1A252F', highlight: '#2C3E50', shadow: '#0D1318', weight: 10 },
    { name: 'Ice Blue', base: '#81ECEC', highlight: '#A9F5F5', shadow: '#00CEC9', weight: 10 },
    { name: 'Grey', base: '#95A5A6', highlight: '#BDC3C7', shadow: '#7F8C8D', weight: 10 },
    { name: 'Dark Grey', base: '#636E72', highlight: '#839192', shadow: '#2D3436', weight: 10 },
    { name: 'Cream', base: '#F5F0E1', highlight: '#FFFAF2', shadow: '#E8DFD0', weight: 10 },
    { name: 'Pink', base: '#E91E63', highlight: '#EC407A', shadow: '#C2185B', weight: 10 },
    { name: 'Sky Blue', base: '#5DADE2', highlight: '#85C1E9', shadow: '#3498DB', weight: 10 },
    { name: 'Ocean Blue', base: '#3498DB', highlight: '#5DADE2', shadow: '#2471A3', weight: 8 },
    { name: 'Cobalt', base: '#2E86AB', highlight: '#54A0FF', shadow: '#1F618D', weight: 8 },
    { name: 'Purple', base: '#8E44AD', highlight: '#A569BD', shadow: '#6C3483', weight: 8 },
    { name: 'Green', base: '#27AE60', highlight: '#58D68D', shadow: '#1E8449', weight: 8 },
    { name: 'Coral', base: '#E74C3C', highlight: '#EC7063', shadow: '#C0392B', weight: 8 },
    { name: 'Yellow', base: '#F39C12', highlight: '#F7DC6F', shadow: '#D68910', weight: 6 },
    { name: 'Zombie Green', base: '#6AB04C', highlight: '#78E08F', shadow: '#489918', weight: 5 },
    { name: 'Skeleton White', base: '#F8F9F9', highlight: '#FFFFFF', shadow: '#DFE4E5', weight: 5 },
    { name: 'Gold', base: '#F9CA24', highlight: '#F8EFBA', shadow: '#F39C12', weight: 3 },
    { name: 'Rainbow', base: 'rainbow', highlight: 'rainbow', shadow: 'rainbow', weight: 1 },
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
    { name: 'Cap Blue', type: 'cap', color: '#1976D2', highlight: '#2196F3', shadow: '#1565C0', weight: 6 },
    { name: 'Cap Red', type: 'cap', color: '#C62828', highlight: '#E53935', shadow: '#B71C1C', weight: 6 },
    { name: 'Cap Black', type: 'cap', color: '#212121', highlight: '#424242', shadow: '#000000', weight: 6 },
    { name: 'Cap Green', type: 'cap', color: '#2E7D32', highlight: '#43A047', shadow: '#1B5E20', weight: 6 },
    { name: 'Beanie Red', type: 'beanie', color: '#D32F2F', highlight: '#E53935', shadow: '#B71C1C', weight: 6 },
    { name: 'Beanie Blue', type: 'beanie', color: '#1565C0', highlight: '#1976D2', shadow: '#0D47A1', weight: 6 },
    { name: 'Beanie Green', type: 'beanie', color: '#2E7D32', highlight: '#43A047', shadow: '#1B5E20', weight: 6 },
    { name: 'Beanie Purple', type: 'beanie', color: '#7B1FA2', highlight: '#9C27B0', shadow: '#4A148C', weight: 6 },
    { name: 'Scarf Green', type: 'scarf', color: '#388E3C', highlight: '#4CAF50', shadow: '#2E7D32', weight: 5 },
    { name: 'Scarf Red', type: 'scarf', color: '#C62828', highlight: '#E53935', shadow: '#B71C1C', weight: 5 },
    { name: 'Scarf Blue', type: 'scarf', color: '#1565C0', highlight: '#1976D2', shadow: '#0D47A1', weight: 5 },
    { name: 'Scarf Purple', type: 'scarf', color: '#7B1FA2', highlight: '#9C27B0', shadow: '#4A148C', weight: 5 },
    { name: 'Headband Red', type: 'headband', color: '#C62828', highlight: '#E53935', weight: 5 },
    { name: 'Headband Blue', type: 'headband', color: '#1565C0', highlight: '#1976D2', weight: 5 },
    { name: 'Headband Green', type: 'headband', color: '#2E7D32', highlight: '#43A047', weight: 5 },
    { name: 'Headband Purple', type: 'headband', color: '#7B1FA2', highlight: '#9C27B0', weight: 5 },
    { name: 'Crown', type: 'crown', weight: 10 },
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
  const scale = 9
  canvas.width = 400
  canvas.height = 400
  
  // Handle rainbow background
  if (traits.background.color === 'rainbow') {
    const rainbowColors = ['#FF6B6B', '#FF9F43', '#F9CA24', '#6AB04C', '#48DBFB', '#9B59B6']
    for (let y = 0; y < 40; y++) {
      ctx.fillStyle = rainbowColors[y % rainbowColors.length]
      ctx.fillRect(0, y * scale, canvas.width, scale)
    }
  } else {
    ctx.fillStyle = traits.background.color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  
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
  
  const rainbowColors = ['#FF6B6B', '#FF9F43', '#F9CA24', '#6AB04C', '#48DBFB', '#9B59B6', '#FF6B9D']
  const getRainbow = (x, y) => rainbowColors[((x + y) % 7)]
  
  const getColor = (color, x = 20, y = 30) => {
    if (color === 'rainbow') return getRainbow(x, y)
    return color
  }
  
  const body = getColor(traits.body.base)
  const bodyHighlight = getColor(traits.body.highlight)
  const bodyShadow = getColor(traits.body.shadow)
  const belly = traits.belly.base
  const bellyHighlight = traits.belly.highlight
  const beak = traits.beak.base
  const beakHighlight = traits.beak.highlight
  const beakShadow = traits.beak.shadow
  const feet = traits.feet?.base || '#FF9F43'
  const feetHighlight = traits.feet?.highlight || '#FFBE76'
  const feetShadow = traits.feet?.shadow || '#E67E22'
  
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
  } else if (traits.eyes.type === 'angry') {
    // Angry eyes - furrowed brows
    rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A')
    rect(cx - 4, eyeY, cx - 3, eyeY, '#FF0000')
    rect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A')
    rect(cx + 4, eyeY, cx + 5, eyeY, '#FF0000')
    // Angry eyebrows
    rect(cx - 6, eyeY - 2, cx - 3, eyeY - 2, '#0A0A0A')
    rect(cx + 3, eyeY - 2, cx + 6, eyeY - 2, '#0A0A0A')
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
  } else if (traits.eyes.type === 'sad') {
    // Sad eyes - droopy
    rect(cx - 5, eyeY, cx - 3, eyeY + 1, '#0A0A0A')
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx + 3, eyeY, cx + 5, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A')
    // Sad eyebrows
    rect(cx - 6, eyeY - 2, cx - 3, eyeY - 2, bodyShadow)
    rect(cx + 3, eyeY - 2, cx + 6, eyeY - 2, bodyShadow)
  } else if (traits.eyes.type === 'surprised') {
    // Surprised eyes - wide open
    rect(cx - 6, eyeY - 1, cx - 2, eyeY + 2, '#0A0A0A')
    rect(cx - 5, eyeY - 1, cx - 3, eyeY + 2, '#FFFFFF')
    rect(cx - 5, eyeY, cx - 4, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY - 1, cx + 6, eyeY + 2, '#0A0A0A')
    rect(cx + 3, eyeY - 1, cx + 5, eyeY + 2, '#FFFFFF')
    rect(cx + 4, eyeY, cx + 5, eyeY + 1, '#0A0A0A')
  } else if (traits.eyes.type === 'sideeye') {
    // Side-eye - looking sideways
    rect(cx - 6, eyeY, cx - 3, eyeY + 2, '#0A0A0A')
    rect(cx - 5, eyeY + 1, cx - 4, eyeY + 2, '#0A0A0A')
    rect(cx + 3, eyeY, cx + 6, eyeY + 2, '#0A0A0A')
    rect(cx + 4, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A')
  } else if (traits.eyes.type === 'closed') {
    // Closed eyes - straight line
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A')
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A')
  }
  
  // Eyebrows
  if (traits.eyes.type !== 'sleepy' && traits.eyes.type !== 'closed' && traits.eyes.type !== 'angry') {
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
  } else if (traits.beak.type === 'puffy') {
    rect(cx - 4, 20, cx + 3, 23, beak)
    rect(cx - 3, 19, cx + 2, 22, beakHighlight)
    rect(cx - 2, 18, cx + 1, 20, beakHighlight)
    rect(cx - 3, 23, cx + 2, 23, beakShadow)
    rect(cx + 2, 22, cx + 3, 22, beakShadow)
  } else {
    // Default small
    rect(cx - 3, 21, cx + 2, 23, beak)
    rect(cx - 2, 20, cx + 1, 22, beak)
    rect(cx - 1, 20, cx, 21, beak)
    rect(cx - 2, 22, cx + 1, 22, beakShadow)
    rect(cx - 3, 21, cx - 3, 22, beakShadow)
  }
  
  // Cheeks
  const cheeksColor = traits.cheeks?.base || '#FFB6C1'
  const cheeksHighlightColor = traits.cheeks?.highlight || '#FFC5CD'
  rect(cx - 9, 19, cx - 7, 21, cheeksColor)
  rect(cx + 7, 19, cx + 9, 21, cheeksColor)
  rect(cx - 8, 20, cx - 7, 20, cheeksHighlightColor)
  rect(cx + 7, 20, cx + 8, 20, cheeksHighlightColor)
  
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
    rect(cx - 10, 6, cx + 10, 9, traits.head.color)
    rect(cx - 9, 4, cx + 9, 7, traits.head.highlight)
    rect(cx - 8, 3, cx + 8, 5, traits.head.highlight)
    rect(cx - 3, 2, cx + 2, 4, traits.head.shadow)
    rect(cx - 2, 1, cx + 1, 3, traits.head.shadow)
  } else if (traits.head.type === 'bow') {
    rect(cx - 10, 7, cx - 7, 9, '#FF69B4')
    rect(cx + 7, 7, cx + 10, 9, '#FF69B4')
    rect(cx - 6, 7, cx + 6, 9, '#FF1493')
    rect(cx - 8, 6, cx - 6, 8, '#FFB6C1')
    rect(cx + 6, 6, cx + 8, 8, '#FFB6C1')
    rect(cx - 2, 8, cx + 1, 8, '#FF1493')
  } else if (traits.head.type === 'cap') {
    rect(cx - 10, 7, cx + 9, 9, traits.head.color)
    rect(cx - 9, 6, cx + 8, 8, traits.head.highlight)
    rect(cx + 8, 8, cx + 12, 10, traits.head.shadow)
    rect(cx + 10, 9, cx + 12, 10, traits.head.shadow)
    rect(cx - 11, 8, cx - 9, 9, traits.head.shadow)
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 25, cx + 10, 28, traits.head.color)
    rect(cx - 9, 24, cx + 9, 26, traits.head.highlight)
    rect(cx + 8, 25, cx + 11, 33, traits.head.color)
    rect(cx + 9, 26, cx + 10, 32, traits.head.highlight)
    rect(cx - 2, 26, cx + 1, 27, traits.head.shadow)
  } else if (traits.head.type === 'halo') {
    rect(cx - 4, 3, cx + 3, 4, '#FFD700')
    rect(cx - 5, 4, cx + 4, 5, '#FFD700')
    rect(cx - 3, 2, cx + 2, 3, '#FFD700')
  } else if (traits.head.type === 'headband') {
    rect(cx - 10, 6, cx + 10, 9, traits.head.color)
    rect(cx - 9, 5, cx + 9, 7, traits.head.highlight)
    rect(cx - 7, 5, cx - 5, 8, traits.head.highlight)
    rect(cx - 1, 5, cx + 1, 8, traits.head.highlight)
    rect(cx + 5, 5, cx + 7, 8, traits.head.highlight)
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
  rect(10, 37, 14, 38, feet)
  rect(9, 38, 15, 38, feet)
  rect(11, 36, 13, 37, feetHighlight)
  rect(10, 38, 13, 38, feetShadow)
  // Toes
  rect(8, 38, 10, 39, feet)
  rect(9, 38, 10, 39, feetHighlight)
  rect(12, 38, 14, 39, feet)
  rect(13, 38, 14, 39, feetHighlight)
  
  // Right foot
  rect(25, 37, 29, 38, feet)
  rect(24, 38, 30, 38, feet)
  rect(26, 36, 28, 37, feetHighlight)
  rect(25, 38, 28, 38, feetShadow)
  // Toes
  rect(25, 38, 27, 39, feet)
  rect(26, 38, 27, 39, feetHighlight)
  rect(29, 38, 31, 39, feet)
  rect(24, 39, 25, 40, feetHighlight)
  rect(26, 39, 28, 40, feet)
  rect(27, 39, 28, 40, feetHighlight)
  rect(29, 39, 31, 39, feet)
  rect(30, 39, 31, 39, feetHighlight)
  
  // Ground shadow
  rect(8, 38, 31, 38, 'rgba(0,0,0,0.3)')
}

function App() {
  const [traits, setTraits] = useState(null)
  const [status, setStatus] = useState('')
  const [ogMode, setOgMode] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [confetti, setConfetti] = useState([])
  const [hasGenerated, setHasGenerated] = useState(false)
  const [hasOgGenerated, setHasOgGenerated] = useState(false)
  const [, setUploadedImage] = useState(null)
  const [idleMatrix] = useState(() => 
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      chars: Array.from({ length: 25 }).map(() => Math.random() > 0.5 ? '1' : '0').join('')
    }))
  )
  const [savedPenguins, setSavedPenguins] = useState(() => {
    const saved = localStorage.getItem('savedPenguins')
    return saved ? JSON.parse(saved) : []
  })
  
  // Load cached gallery immediately, then refresh in background
  const [sharedGallery, setSharedGallery] = useState(() => {
    const cached = localStorage.getItem('cachedGallery')
    return cached ? JSON.parse(cached) : []
  })
  
  const [modalPenguin, setModalPenguin] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [galleryTab, setGalleryTab] = useState('generated')
  const [cooldown, setCooldown] = useState(0)
  const [uploadCooldown, setUploadCooldown] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(null)
  const itemsPerPage = 20
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  
  useEffect(() => {
    localStorage.setItem('savedPenguins', JSON.stringify(savedPenguins))
  }, [savedPenguins])

  useEffect(() => {
    if (sharedGallery.length > 0) {
      localStorage.setItem('cachedGallery', JSON.stringify(sharedGallery))
    }
  }, [sharedGallery])

  // Fetch on page load and when user generates/transforms
  useEffect(() => {
    fetchFreshGallery().then(gallery => {
      setSharedGallery(gallery)
      setLastRefresh(new Date())
    })
  }, [])

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  useEffect(() => {
    if (uploadCooldown > 0) {
      const timer = setTimeout(() => setUploadCooldown(uploadCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [uploadCooldown])

  useEffect(() => {
    if (canvasRef.current && !ogMode && hasGenerated && traits) {
      drawAgent(traits, canvasRef.current)
    }
  }, [traits, ogMode, hasGenerated])

  const [mode, setMode] = useState('generate') // 'generate' or 'og'

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || uploadCooldown > 0) return
    
    setIsGenerating(true)
    setIsRevealing(false)
    setConfetti([])
    setUploadCooldown(10)
    
    // Refresh gallery to see latest from other users
    fetchFreshGallery().then(gallery => setSharedGallery(gallery))
    
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
            setSavedPenguins(prev => [newPenguin, ...prev])
            setSharedGallery(prev => [newPenguin, ...prev])
            
            // Upload to IPFS first, then save to shared gallery
            uploadToIPFS(canvasRef).then(ipfsData => {
              if (ipfsData) {
                const updatedPenguin = { ...newPenguin, cid: ipfsData.cid, image: ipfsData.url }
                setSavedPenguins(prev => prev.map(p => p.id === newPenguin.id ? updatedPenguin : p))
                setSharedGallery(prev => prev.map(p => p.id === newPenguin.id ? updatedPenguin : p))
                saveToSharedGallery(updatedPenguin)
              } else {
                saveToSharedGallery(newPenguin)
              }
              
              // Fetch latest gallery and update timestamp
              fetchFreshGallery().then(gallery => {
                setSharedGallery(gallery)
                setLastRefresh(new Date())
              })
            })
        }, 200)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
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
        feet: { name: 'Default Orange', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
        name: randomItem(TRAITS.name),
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
        setSavedPenguins(prev => [newPenguin, ...prev])
        setSharedGallery(prev => [newPenguin, ...prev])
        
        // Upload to IPFS first, then save to shared gallery
        uploadToIPFS(canvasRef).then(ipfsData => {
          if (ipfsData) {
            const updatedPenguin = { ...newPenguin, cid: ipfsData.cid, image: ipfsData.url }
            setSavedPenguins(prev => prev.map(p => p.id === newPenguin.id ? updatedPenguin : p))
            setSharedGallery(prev => prev.map(p => p.id === newPenguin.id ? updatedPenguin : p))
            saveToSharedGallery(updatedPenguin)
          } else {
            saveToSharedGallery(newPenguin)
          }
          
          // Fetch latest gallery and update timestamp
          fetchFreshGallery().then(gallery => {
            setSharedGallery(gallery)
            setLastRefresh(new Date())
          })
        })
      }, 200)
    }, 1500)
  }

  const save = () => {
    if (!canvasRef.current || !traits) return
    
    const highResCanvas = document.createElement('canvas')
    highResCanvas.width = 4096
    highResCanvas.height = 4096
    const ctx = highResCanvas.getContext('2d')
    ctx.imageSmoothingEnabled = false
    
    ctx.drawImage(canvasRef.current, 0, 0, 4096, 4096)
    
    const link = document.createElement('a')
    link.download = 'penguin-4k.png'
    link.href = highResCanvas.toDataURL('image/png')
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
        <div className="header-links">
          <a href="https://x.com/8bitpenguins" target="_blank" rel="noopener noreferrer" className="x-btn">Follow us on X</a>
        </div>
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
              <label htmlFor="og-upload" className={`btn white ${uploadCooldown > 0 ? 'disabled' : ''}`}>
                {uploadCooldown > 0 ? `Wait ${uploadCooldown}s` : 'Upload Your PFP'}
              </label>
              <button className="btn" onClick={save} disabled={!traits}>Save</button>
            </div>
          )}

          <div className="btns">
            {mode === 'generate' && (
              <>
                <button className="btn white" onClick={generate} disabled={isGenerating || cooldown > 0}>
                  {isGenerating ? 'Generating...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Generate'}
                </button>
                <button className="btn" onClick={save} disabled={!traits}>Save</button>
              </>
            )}
          </div>
          {lastRefresh && (
            <p className="last-refresh">
              Gallery refreshed: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
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
                  <li><span>Name</span><span>{traits.name?.name}</span></li>
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
          // First, deduplicate by ID (savedPenguins take precedence)
          const allById = new Map()
          
          // Add shared gallery first
          sharedGallery.forEach(p => {
            if (!allById.has(p.id)) {
              allById.set(p.id, p)
            }
          })
          
          // Add saved penguins (will overwrite if duplicate ID)
          savedPenguins.forEach(p => {
            allById.set(p.id, p)
          })
          
          // Convert to array
          const allUnique = Array.from(allById.values())
          
          // Sort by timestamp (latest first)
          const sortedPenguins = allUnique.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          
          // Filter by tab
          const filteredPenguins = sortedPenguins.filter(p => galleryTab === 'generated' ? !p.isOg : p.isOg)
          
          const generatedCount = sortedPenguins.filter(p => !p.isOg).length
          const transformedCount = sortedPenguins.filter(p => p.isOg).length
          
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
                {filteredPenguins.length === 0 ? (
                  <p className="empty">No {galleryTab === 'generated' ? 'generated' : 'transformed'} penguins yet. Be the first to create one!</p>
                ) : (
                  filteredPenguins
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
              {filteredPenguins.length > itemsPerPage && (
                <div className="pagination">
                  <button 
                    className="page-btn" 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </button>
                  <span className="page-info">
                    {currentPage} / {Math.max(1, Math.ceil(filteredPenguins.length / itemsPerPage))}
                  </span>
                  <button 
                    className="page-btn" 
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPenguins.length / itemsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredPenguins.length / itemsPerPage)}
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
                    <li><span>Name</span><span>{modalPenguin.traits.name?.name}</span></li>
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
