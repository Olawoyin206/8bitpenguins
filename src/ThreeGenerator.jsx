import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import './App.css'

const TRAITS = {
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

function createVoxelPenguin(traits, THREE) {
  const group = new THREE.Group()
  
  const body = traits.body.base
  const bodyHighlight = traits.body.highlight
  const bodyShadow = traits.body.shadow
  const belly = traits.belly.base
  const bellyHighlight = traits.belly.highlight
  const beak = traits.beak.base
  const beakHighlight = traits.beak.highlight
  const beakShadow = traits.beak.shadow
  
  const cx = 20
  const voxelSize = 0.55
  const voxelScale = 0.15
  let accessoryMode = false
  const materialCache = new Map()
  const geometryCache = new Map()
  
  const mat = (color) => {
    if (!materialCache.has(color)) {
      materialCache.set(
        color,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.9,
          metalness: 0.0,
          flatShading: true,
        })
      )
    }
    return materialCache.get(color)
  }

  const geo = (depth) => {
    if (!geometryCache.has(depth)) {
      geometryCache.set(depth, new RoundedBoxGeometry(voxelSize, voxelSize, depth * voxelScale, 1, 0.05))
    }
    return geometryCache.get(depth)
  }
  
  const voxel = (x, y, z, color, depth = 4, frontOffset = false, zNudge = 0, castsShadow = true) => {
    const mesh = new THREE.Mesh(geo(depth), mat(color))
    mesh.position.set(
      (x - cx) * voxelSize * 0.5, 
      (20 - y) * voxelSize * 0.5, 
      (z - 1) * voxelSize * 0.4 + (frontOffset ? (depth * voxelScale * 0.5) + 0.22 : 0) + zNudge
    )
    mesh.castShadow = castsShadow
    mesh.receiveShadow = false
    return mesh
  }

  const rect = (x1, y1, x2, y2, color, depth = 4, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        group.add(voxel(x, y, z, color, depth, false, accessoryMode ? 0.2 : 0, !accessoryMode))
      }
    }
  }

  const rectFront = (x1, y1, x2, y2, color, depth = 4, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        group.add(voxel(x, y, z, color, depth, true, accessoryMode ? 0.2 : 0, !accessoryMode))
      }
    }
  }
  
  // BODY - thick on both sides
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
  
  // BELLY - front only, reduced depth
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
  
  rectFront(15, 33, 15, 33, bellyHighlight, 6)
  rectFront(24, 33, 24, 33, bellyHighlight, 6)
  rectFront(16, 34, 16, 34, bellyHighlight, 6)
  rectFront(23, 34, 23, 34, bellyHighlight, 6)
  
  // HEAD - thick like body
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
  
  // FACE - front only
  rectFront(12, 14, 27, 24, belly, 11)
  rectFront(11, 15, 28, 23, belly, 11)
  rectFront(12, 16, 27, 22, belly, 11)
  rectFront(13, 17, 26, 21, belly, 11)
  rectFront(14, 18, 25, 20, belly, 11)
  rectFront(15, 19, 24, 20, belly, 11)
  
  rectFront(14, 15, 25, 16, bellyHighlight, 11)
  rectFront(14, 17, 25, 18, bellyHighlight, 11)
  rectFront(15, 19, 24, 20, bellyHighlight, 11)
  
  // EYES - front only
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
  
  // Eyebrows - all penguins have eyebrows (darker than body)
  rectFront(cx - 7, 14, cx - 3, 14, bodyShadow, 11, 1.1)
  rectFront(cx + 3, 14, cx + 7, 14, bodyShadow, 11, 1.1)
  rectFront(cx - 8, 13, cx - 4, 13, bodyShadow, 11, 1.1)
  rectFront(cx + 4, 13, cx + 8, 13, bodyShadow, 11, 1.1)
  
  // BEAK - front only
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
  
  // CHEEKS - front only
  rectFront(cx - 9, 19, cx - 7, 21, '#FFB6C1', 11, 1.1)
  rectFront(cx + 7, 19, cx + 9, 21, '#FFB6C1', 11, 1.1)
  rectFront(cx - 8, 20, cx - 7, 20, '#FFC5CD', 11, 1.1)
  rectFront(cx + 7, 20, cx + 8, 20, '#FFC5CD', 11, 1.1)
  
  // HEAD ACCESSORIES
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
  accessoryMode = true
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
  accessoryMode = false
  
  // FLIPPERS - reduced depth
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
  
  // FEET - symmetric webbed penguin feet (fixed orange color)
  const footBase = '#FF9F43'
  const footHighlight = '#FFBE76'
  const footShadow = '#E67E22'
  
  // Left foot - webbed with 3 distinct toes
  // Main foot pad
  rect(10, 37, 15, 38, footBase, 14)
  rect(9, 38, 16, 38, footBase, 14)
  rect(11, 36, 13, 37, footHighlight, 14)
  rect(10, 38, 15, 38, footHighlight, 14)
  rect(10, 37, 15, 37, footShadow, 14)
  
  // Toes - positioned forward with gaps
  // Toe 1 (left)
  rect(7, 38, 9, 39, footBase, 14)
  rect(7, 38, 9, 38, footHighlight, 14)
  rect(7, 39, 9, 39, footShadow, 14)
  rect(7, 38, 8, 38, footHighlight, 14)
  // Toe 2 (center)
  rect(11, 38, 13, 39, footBase, 14)
  rect(11, 38, 13, 38, footHighlight, 14)
  rect(11, 39, 13, 39, footShadow, 14)
  rect(12, 38, 12, 38, footHighlight, 14)
  // Toe 3 (right)
  rect(15, 38, 17, 39, footBase, 14)
  rect(15, 38, 17, 38, footHighlight, 14)
  rect(15, 39, 17, 39, footShadow, 14)
  rect(16, 38, 16, 38, footHighlight, 14)
  
  // Right foot - mirror of left foot
  // Main foot pad
  rect(25, 37, 30, 38, footBase, 14)
  rect(24, 38, 31, 38, footBase, 14)
  rect(26, 36, 28, 37, footHighlight, 14)
  rect(25, 38, 30, 38, footHighlight, 14)
  rect(25, 37, 30, 37, footShadow, 14)
  
  // Toes - positioned forward with gaps
  // Toe 1 (left)
  rect(23, 38, 25, 39, footBase, 14)
  rect(23, 38, 25, 38, footHighlight, 14)
  rect(23, 39, 25, 39, footShadow, 14)
  rect(23, 38, 24, 38, footHighlight, 14)
  // Toe 2 (center)
  rect(27, 38, 29, 39, footBase, 14)
  rect(27, 38, 29, 38, footHighlight, 14)
  rect(27, 39, 29, 39, footShadow, 14)
  rect(28, 38, 28, 38, footHighlight, 14)
  // Toe 3 (right)
  rect(31, 38, 33, 39, footBase, 14)
  rect(31, 38, 33, 38, footHighlight, 14)
  rect(31, 39, 33, 39, footShadow, 14)
  rect(32, 38, 32, 38, footHighlight, 14)
  
  return group
}
 
function ThreeGenerator() {
  const location = useLocation()
  const prefillTraits = location.state?.prefillTraits
  const fromTokenId = location.state?.fromTokenId
  const fromName = location.state?.fromName
  const containerRef = useRef(null)
  const [traits, setTraits] = useState({
    body: { name: 'Classic', base: '#2C3E50', highlight: '#34495E', shadow: '#1A252F' },
    belly: { name: 'Cream', base: '#FDF5E6', highlight: '#FFFAF0', shadow: '#F5E6D3' },
    beak: { name: 'Small', type: 'small', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    eyes: { name: 'Normal', type: 'round' },
    head: { name: 'None', type: 'none' },
    background: { name: 'Sky Blue', color: '#D4E6F1' },
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [idleMatrix] = useState(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      chars: Array.from({ length: 25 }).map(() => (Math.random() > 0.5 ? '1' : '0')).join(''),
    }))
  )
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const frameRef = useRef(null)
  const penguinRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const generateTimeoutRef = useRef(null)
  const isDragging = useRef(false)
  const lastMouseX = useRef(0)
  
  useEffect(() => {
    if (!hasGenerated) return
    const container = containerRef.current
    if (!container) return
    setSceneReady(false)
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const canvasSize = isMobile ? 320 : 420
    const pixelRatio = isMobile ? 1 : Math.min(window.devicePixelRatio, 1.75)
    const shadowMapSize = isMobile ? 1024 : 1536
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(traits.background.color)
    scene.fog = new THREE.Fog(traits.background.color, 15, 60)
    sceneRef.current = scene
    
    // Camera - orthographic view
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
    cameraRef.current = camera
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(canvasSize, canvasSize)
    renderer.setPixelRatio(pixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer
    
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enableZoom = true
    controls.minDistance = 8
    controls.maxDistance = 35
    controls.enablePan = false
    controls.enableRotate = true
    controls.autoRotate = false
    controls.target.set(0, 0, 0)
    controls.update()
    controlsRef.current = controls
    
    // Mouse/touch drag to rotate penguin
    const onPointerDown = (e) => {
      isDragging.current = true
      lastMouseX.current = e.clientX || e.touches?.[0]?.clientX || 0
    }
    
    const onPointerMove = (e) => {
      if (isDragging.current && penguinRef.current) {
        const clientX = e.clientX || e.touches?.[0]?.clientX || 0
        const delta = clientX - lastMouseX.current
        penguinRef.current.rotation.y += delta * 0.01
        lastMouseX.current = clientX
      }
    }
    
    const onPointerUp = () => {
      isDragging.current = false
    }
    
    renderer.domElement.addEventListener('mousedown', onPointerDown)
    renderer.domElement.addEventListener('mousemove', onPointerMove)
    renderer.domElement.addEventListener('mouseup', onPointerUp)
    renderer.domElement.addEventListener('mouseleave', onPointerUp)
    renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true })
    renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: true })
    renderer.domElement.addEventListener('touchend', onPointerUp)
    
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambient)
    
    // Hemisphere light for better ambient
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.4)
    scene.add(hemiLight)
    
    // Key light - with shadow
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(5, 10, 15)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = shadowMapSize
    keyLight.shadow.mapSize.height = shadowMapSize
    keyLight.shadow.camera.near = 1
    keyLight.shadow.camera.far = 60
    keyLight.shadow.camera.left = -15
    keyLight.shadow.camera.right = 15
    keyLight.shadow.camera.top = 15
    keyLight.shadow.camera.bottom = -15
    keyLight.shadow.radius = 1.5
    keyLight.shadow.bias = -0.0005
    keyLight.shadow.normalBias = 0.04
    scene.add(keyLight)
    
    // Fill light - soften shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2)
    fillLight.position.set(8, 8, 5)
    scene.add(fillLight)
    
    // Rim light - add depth
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
    rimLight.position.set(0, 5, -15)
    scene.add(rimLight)
    
    // Add penguin pivot for rotation; model is added in traits effect
    const penguinPivot = new THREE.Group()
    penguinPivot.position.set(0, 0.5, 0)
    scene.add(penguinPivot)
    penguinRef.current = penguinPivot
    
    // Ground plane receives dynamic shadow
    const groundGeo = new THREE.PlaneGeometry(60, 60)
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -5
    ground.receiveShadow = true
    scene.add(ground)
    
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()
    setSceneReady(true)
    
    return () => {
      setSceneReady(false)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      renderer.domElement.removeEventListener('mousedown', onPointerDown)
      renderer.domElement.removeEventListener('mousemove', onPointerMove)
      renderer.domElement.removeEventListener('mouseup', onPointerUp)
      renderer.domElement.removeEventListener('mouseleave', onPointerUp)
      renderer.domElement.removeEventListener('touchstart', onPointerDown)
      renderer.domElement.removeEventListener('touchmove', onPointerMove)
      renderer.domElement.removeEventListener('touchend', onPointerUp)
      if (controlsRef.current) controlsRef.current.dispose()
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement)
      }
    }
  }, [hasGenerated])

  useEffect(() => {
    if (!hasGenerated || !sceneRef.current || !penguinRef.current) return
    while (penguinRef.current.children.length > 0) {
      penguinRef.current.remove(penguinRef.current.children[0])
    }
    const newPenguin = createVoxelPenguin(traits, THREE)
    penguinRef.current.add(newPenguin)
    sceneRef.current.background = new THREE.Color(traits.background.color)
    sceneRef.current.fog = new THREE.Fog(traits.background.color, 15, 60)
    requestAnimationFrame(() => setIsGenerating(false))
  }, [traits, hasGenerated])

  useEffect(() => {
    if (sceneReady && isGenerating) setIsGenerating(false)
  }, [sceneReady, isGenerating])
  
  const generate = () => {
    if (generateTimeoutRef.current) {
      clearTimeout(generateTimeoutRef.current)
      generateTimeoutRef.current = null
    }
    setIsGenerating(true)
    const t = {
      body: randomItem(TRAITS.body),
      belly: randomItem(TRAITS.belly),
      beak: randomItem(TRAITS.beak),
      eyes: randomItem(TRAITS.eyes),
      head: randomItem(TRAITS.head),
      background: randomItem(TRAITS.background),
    }
    
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null
    }
    const diff = (c1, c2) => Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
    
    let bgColor = t.background.color
    let bodyBase = t.body.base
    
    while (diff(hexToRgb(bgColor), hexToRgb(bodyBase)) < 80) {
      t.body = randomItem(TRAITS.body)
      bodyBase = t.body.base
    }
    
    while (diff(hexToRgb(t.belly.base), hexToRgb(bodyBase)) < 80) {
      t.belly = randomItem(TRAITS.belly)
    }
    
    while (diff(hexToRgb(bgColor), hexToRgb(t.belly.base)) < 80) {
      t.belly = randomItem(TRAITS.belly)
    }
    
    const hasHeadAccessory = t.head.type !== 'none' && t.head.type !== 'crown' && t.head.type !== 'halo'
    if (hasHeadAccessory && t.head.color) {
      while (diff(hexToRgb(t.head.color), hexToRgb(bodyBase)) < 80) {
        t.head = randomItem(TRAITS.head)
      }
    }
    
    setTraits(t)
    if (!hasGenerated) setHasGenerated(true)
    generateTimeoutRef.current = setTimeout(() => {
      setIsGenerating(false)
      generateTimeoutRef.current = null
    }, 1500)
  }
  
  const saveImage = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
    
    // Create high-res renderer for saving (4K quality)
    const saveRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    saveRenderer.setSize(4096, 4096)
    saveRenderer.setPixelRatio(1)
    saveRenderer.shadowMap.enabled = true
    saveRenderer.shadowMap.type = THREE.PCFSoftShadowMap
    saveRenderer.render(sceneRef.current, cameraRef.current)
    
    const link = document.createElement('a')
    link.download = '8bit-penguin.png'
    link.href = saveRenderer.domElement.toDataURL('image/png')
    link.click()
    
    saveRenderer.dispose()
  }

  useEffect(() => {
    return () => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!prefillTraits) return
    setTraits(prefillTraits)
    setHasGenerated(true)
    setIsGenerating(false)
  }, [prefillTraits])

  const showTraits = hasGenerated && !isGenerating
  const traitName = (key) => (showTraits ? traits[key]?.name || '' : '')
  
  return (
    <div className="app three-page">
      <header>
        <h1>8bit Penguins</h1>
        <p>{fromTokenId ? `3D Evolution for #${fromTokenId}${fromName ? ` - ${fromName}` : ''}` : '3D Voxel Penguins'}</p>
        <div className="header-links">
          <a href="https://x.com/8bitpenguins" target="_blank" rel="noopener noreferrer" className="x-btn">Follow us on X</a>
        </div>
      </header>

      <main>
        <div className="three-generator">
          <div
            ref={containerRef}
            className={`three-canvas ${isGenerating ? 'generating' : ''} ${!hasGenerated ? 'matrix-idle' : ''}`}
          >
            {(isGenerating || !hasGenerated) && (
              <div className="matrix-rain">
                {idleMatrix.map((col) => (
                  <div
                    key={col.id}
                    className="matrix-column"
                    data-chars={col.chars}
                    style={{
                      animationDuration: isGenerating ? `${0.3 + Math.random() * 0.4}s` : '0s',
                      animationDelay: isGenerating ? `${Math.random() * 0.3}s` : '0s',
                    }}
                  >
                    {col.chars}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="three-controls">
            <button 
              className="btn white" 
              onClick={generate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate 3D'}
            </button>
            <button 
              className="btn white" 
              onClick={saveImage}
              disabled={!hasGenerated}
            >
              Save Image
            </button>
          </div>
        </div>
        
        <div className="traits">
          <ul>
            <li><span>Body</span><span>{traitName('body')}</span></li>
            <li><span>Belly</span><span>{traitName('belly')}</span></li>
            <li><span>Beak</span><span>{traitName('beak')}</span></li>
            <li><span>Eyes</span><span>{traitName('eyes')}</span></li>
            <li><span>Head</span><span>{traitName('head')}</span></li>
            <li><span>Background</span><span>{traitName('background')}</span></li>
          </ul>
        </div>
      </main>
    </div>
  )
}

export default ThreeGenerator
