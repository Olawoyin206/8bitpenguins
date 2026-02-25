import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import './App.css'

const TRAITS = {
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
  background: [
    { name: 'Soft Pink', color: '#FADBD8' },
    { name: 'Mint Green', color: '#D5F5E3' },
    { name: 'Peach', color: '#FAD7A0' },
    { name: 'Lavender', color: '#E8DAEF' },
    { name: 'Sky Blue', color: '#D4E6F1' },
    { name: 'Cream', color: '#FCF3CF' },
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
  const beakShadow = traits.beak.shadow
  
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
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF', 12)
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF', 12)
    rectFront(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF', 12)
    rectFront(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#FFFFFF', 12)
  } else if (traits.eyes.type === 'happy') {
    rectFront(cx - 6, eyeY, cx - 2, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY, cx + 6, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'sad') {
    rectFront(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 4, eyeY + 2, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY + 2, cx + 5, eyeY + 2, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'angry') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 4, eyeY, cx - 3, eyeY, '#FF0000', 12)
    rectFront(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY, cx + 5, eyeY, '#FF0000', 12)
  } else if (traits.eyes.type === 'sleepy') {
    rectFront(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'surprised') {
    rectFront(cx - 5, eyeY - 1, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 6, eyeY, cx - 2, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY - 1, cx - 4, eyeY - 1, '#FFFFFF', 12)
    rectFront(cx - 4, eyeY, cx - 3, eyeY, '#FFFFFF', 12)
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF', 12)
    rectFront(cx + 3, eyeY - 1, cx + 5, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY, cx + 6, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY - 1, cx + 5, eyeY - 1, '#FFFFFF', 12)
    rectFront(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF', 12)
    rectFront(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#FFFFFF', 12)
  } else if (traits.eyes.type === 'wink') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF', 12)
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF', 12)
    rectFront(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'sideeye') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 6, eyeY + 1, cx - 4, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 3, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'closed') {
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A', 12)
  } else if (traits.eyes.type === 'sparkle') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF', 12)
    rectFront(cx - 3, eyeY + 2, cx - 3, eyeY + 2, '#FFFFFF', 12)
    rectFront(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A', 12)
    rectFront(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF', 12)
    rectFront(cx + 5, eyeY + 2, cx + 5, eyeY + 2, '#FFFFFF', 12)
  }
  
  if (traits.eyes.type !== 'sleepy' && traits.eyes.type !== 'closed' && traits.eyes.type !== 'angry') {
    rectFront(cx - 7, 14, cx - 3, 14, bodyShadow, 11)
    rectFront(cx + 3, 14, cx + 7, 14, bodyShadow, 11)
    rectFront(cx - 8, 13, cx - 4, 13, bodyShadow, 11)
    rectFront(cx + 4, 13, cx + 8, 13, bodyShadow, 11)
  }
  
  // BEAK - front only
  if (traits.beak.type === 'small') {
    rectFront(cx - 2, 21, cx + 1, 23, beak, 14)
    rectFront(cx - 1, 20, cx, 22, beak, 14)
    rectFront(cx - 1, 22, cx, 22, beakShadow, 14)
  } else if (traits.beak.type === 'large') {
    rectFront(cx - 4, 20, cx + 3, 24, beak, 14)
    rectFront(cx - 3, 19, cx + 2, 23, beak, 14)
    rectFront(cx - 2, 19, cx + 1, 20, beak, 14)
    rectFront(cx - 3, 24, cx + 2, 24, beakShadow, 14)
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
  } else {
    rectFront(cx - 3, 21, cx + 2, 23, beak, 14)
    rectFront(cx - 2, 20, cx + 1, 22, beak, 14)
    rectFront(cx - 1, 20, cx, 21, beak, 14)
    rectFront(cx - 2, 22, cx + 1, 22, beakShadow, 14)
    rectFront(cx - 3, 21, cx - 3, 22, beakShadow, 14)
  }
  
  // CHEEKS - front only
  rectFront(cx - 9, 19, cx - 7, 21, '#FFB6C1', 11)
  rectFront(cx + 7, 19, cx + 9, 21, '#FFB6C1', 11)
  rectFront(cx - 8, 20, cx - 7, 20, '#FFC5CD', 11)
  rectFront(cx + 7, 20, cx + 8, 20, '#FFC5CD', 11)
  
  // HEAD ACCESSORIES - match head depth
  if (traits.head.type === 'crown') {
    rect(cx - 9, 6, cx + 9, 8, '#FFD700', 20)
    rect(cx - 8, 4, cx - 6, 8, '#FFD700', 20)
    rect(cx - 3, 2, cx - 1, 8, '#FFD700', 20)
    rect(cx + 1, 2, cx + 3, 8, '#FFD700', 20)
    rect(cx + 6, 4, cx + 8, 8, '#FFD700', 20)
    rect(cx - 4, 5, cx - 2, 6, '#FF0000', 20)
    rect(cx + 2, 5, cx + 4, 6, '#FF0000', 20)
  } else if (traits.head.type === 'tophat') {
    rect(cx - 10, 6, cx + 10, 9, '#1A1A1A', 20)
    rect(cx - 9, 5, cx + 9, 7, '#2D2D2D', 20)
    rect(cx - 4, 2, cx + 3, 6, '#1A1A1A', 20)
    rect(cx - 11, 8, cx + 11, 9, '#8B0000', 20)
    rect(cx - 2, 3, cx + 1, 4, '#C0C0C0', 20)
  } else if (traits.head.type === 'beanie') {
    rect(cx - 10, 6, cx + 10, 9, traits.head.color, 20)
    rect(cx - 9, 4, cx + 9, 7, traits.head.highlight, 20)
    rect(cx - 8, 3, cx + 8, 5, traits.head.highlight, 20)
    rect(cx - 3, 2, cx + 2, 4, traits.head.shadow, 20)
    rect(cx - 2, 1, cx + 1, 3, traits.head.shadow, 20)
  } else if (traits.head.type === 'bow') {
    rect(cx - 10, 7, cx - 7, 9, '#FF69B4', 20)
    rect(cx + 7, 7, cx + 10, 9, '#FF69B4', 20)
    rect(cx - 6, 7, cx + 6, 9, '#FF1493', 20)
    rect(cx - 8, 6, cx - 6, 8, '#FFB6C1', 20)
    rect(cx + 6, 6, cx + 8, 8, '#FFB6C1', 20)
    rect(cx - 2, 8, cx + 1, 8, '#FF1493', 20)
  } else if (traits.head.type === 'cap') {
    rect(cx - 10, 7, cx + 9, 9, traits.head.color, 20)
    rect(cx - 9, 6, cx + 8, 8, traits.head.highlight, 20)
    rect(cx + 8, 8, cx + 12, 10, traits.head.shadow, 20)
    rect(cx + 10, 9, cx + 12, 10, traits.head.shadow, 20)
    rect(cx - 11, 8, cx - 9, 9, traits.head.shadow, 20)
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 25, cx + 10, 28, traits.head.color, 20)
    rect(cx - 9, 24, cx + 9, 26, traits.head.highlight, 20)
    rect(cx + 8, 25, cx + 11, 33, traits.head.color, 20)
    rect(cx + 9, 26, cx + 10, 32, traits.head.highlight, 20)
    rect(cx - 2, 26, cx + 1, 27, traits.head.shadow, 20)
  } else if (traits.head.type === 'halo') {
    rect(cx - 4, 3, cx + 3, 4, '#FFD700', 20)
    rect(cx - 5, 4, cx + 4, 5, '#FFD700', 20)
    rect(cx - 3, 2, cx + 2, 3, '#FFD700', 20)
  } else if (traits.head.type === 'headband') {
    rect(cx - 10, 6, cx + 10, 9, traits.head.color, 20)
    rect(cx - 9, 5, cx + 9, 7, traits.head.highlight, 20)
    rect(cx - 7, 5, cx - 5, 8, traits.head.highlight, 20)
    rect(cx - 1, 5, cx + 1, 8, traits.head.highlight, 20)
    rect(cx + 5, 5, cx + 7, 8, traits.head.highlight, 20)
  }
  
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
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const frameRef = useRef(null)
  const penguinRef = useRef(null)
  const cameraRef = useRef(null)
  const isDragging = useRef(false)
  const lastMouseX = useRef(0)
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const canvasSize = isMobile ? 320 : 420
    const pixelRatio = isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5)
    const shadowMapSize = isMobile ? 1024 : 2048
    
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
    
    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true })
    renderer.setSize(canvasSize, canvasSize)
    renderer.setPixelRatio(pixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap
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
    
    // Key light - facing the penguin, shadow at back
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
    keyLight.shadow.radius = 1
    keyLight.shadow.bias = -0.001
    scene.add(keyLight)
    
    // Fill light - soften shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2)
    fillLight.position.set(8, 8, 5)
    scene.add(fillLight)
    
    // Rim light - add depth
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
    rimLight.position.set(0, 5, -15)
    scene.add(rimLight)
    
    // Add penguin pivot for rotation
    const penguinPivot = new THREE.Group()
    penguinPivot.position.set(0, 0.5, 0)
    const penguin = createVoxelPenguin(traits, THREE)
    penguinPivot.add(penguin)
    scene.add(penguinPivot)
    penguinRef.current = penguinPivot
    
    // Ground plane with shadow
    const groundGeo = new THREE.PlaneGeometry(60, 60)
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -4.5
    ground.receiveShadow = true
    scene.add(ground)
    
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()
    
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      renderer.domElement.removeEventListener('mousedown', onPointerDown)
      renderer.domElement.removeEventListener('mousemove', onPointerMove)
      renderer.domElement.removeEventListener('mouseup', onPointerUp)
      renderer.domElement.removeEventListener('mouseleave', onPointerUp)
      renderer.domElement.removeEventListener('touchstart', onPointerDown)
      renderer.domElement.removeEventListener('touchmove', onPointerMove)
      renderer.domElement.removeEventListener('touchend', onPointerUp)
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement)
      }
    }
  }, [traits])
  
  const generate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      const t = {
        body: randomItem(TRAITS.body),
        belly: randomItem(TRAITS.belly),
        beak: randomItem(TRAITS.beak),
        eyes: randomItem(TRAITS.eyes),
        head: randomItem(TRAITS.head),
        background: randomItem(TRAITS.background),
      }
      setTraits(t)
      
      if (sceneRef.current && penguinRef.current) {
        // Clear existing penguin children
        while(penguinRef.current.children.length > 0) {
          penguinRef.current.remove(penguinRef.current.children[0])
        }
        // Add new penguin to pivot
        const newPenguin = createVoxelPenguin(t, THREE)
        penguinRef.current.add(newPenguin)
        sceneRef.current.background = new THREE.Color(t.background.color)
        sceneRef.current.fog = new THREE.Fog(t.background.color, 15, 60)
      }
      
      setIsGenerating(false)
    }, 300)
  }
  
  const saveImage = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
    rendererRef.current.render(sceneRef.current, cameraRef.current)
    const link = document.createElement('a')
    link.download = '8bit-penguin.png'
    link.href = rendererRef.current.domElement.toDataURL('image/png')
    link.click()
  }
  
  return (
    <div className="app three-page">
      <header>
        <h1>8bit Penguins</h1>
        <p>3D Voxel Penguins</p>
        <div className="header-links">
          <a href="https://x.com/8bitpenguins" target="_blank" rel="noopener noreferrer" className="x-btn">Follow us on X</a>
        </div>
      </header>

      <main>
        <div className="three-generator">
          <div ref={containerRef} className="three-canvas" />
          
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
            >
              Save Image
            </button>
          </div>
        </div>
        
        <div className="traits">
          <ul>
            <li><span>Body</span><span>{traits.body.name}</span></li>
            <li><span>Belly</span><span>{traits.belly.name}</span></li>
            <li><span>Beak</span><span>{traits.beak.name}</span></li>
            <li><span>Eyes</span><span>{traits.eyes.name}</span></li>
            <li><span>Head</span><span>{traits.head.name}</span></li>
            <li><span>Background</span><span>{traits.background.name}</span></li>
          </ul>
        </div>
      </main>
    </div>
  )
}

export default ThreeGenerator
