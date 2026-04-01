const GRID_SIZE = 80
const EFFECT_VARIANTS = [
  { name: 'White', weight: 5 },
  { name: 'Light', weight: 3 },
  { name: 'Golden', weight: 1 },
]

export function convertToPenguinStyle(imageSrc, canvas, strength = 'high') {
  return new Promise((resolve) => {
    const styleProfile = strength === 'low'
      ? { tune: 28, sep: 30, bgPick: 35, bgTolerance: 48 }
      : strength === 'medium'
        ? { tune: 38, sep: 36, bgPick: 42, bgTolerance: 60 }
        : { tune: 50, sep: 42, bgPick: 50, bgTolerance: 72 }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
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

      const dominantColor = (colors, fallback = { r: 93, g: 173, b: 226, hex: '#5DADE2' }, step = 24) => {
        if (!colors.length) return fallback
        const buckets = new Map()
        for (const color of colors) {
          const key = [
            Math.round(color.r / step),
            Math.round(color.g / step),
            Math.round(color.b / step),
          ].join(':')
          const bucket = buckets.get(key)
          if (bucket) bucket.push(color)
          else buckets.set(key, [color])
        }

        let bestBucket = null
        for (const bucket of buckets.values()) {
          if (!bestBucket || bucket.length > bestBucket.length) bestBucket = bucket
        }

        return avgColor(bestBucket || colors)
      }

      const clusterColors = (colors, tolerance = 28) => {
        const clusters = []
        for (const color of colors) {
          let bestCluster = null
          let bestDistance = Number.POSITIVE_INFINITY
          for (const cluster of clusters) {
            const distance = diff(color, cluster.color)
            if (distance < bestDistance) {
              bestDistance = distance
              bestCluster = cluster
            }
          }
          if (!bestCluster || bestDistance > tolerance) {
            clusters.push({ colors: [color], color, count: 1 })
            continue
          }
          bestCluster.colors.push(color)
          bestCluster.count += 1
          bestCluster.color = avgColor(bestCluster.colors)
        }
        return clusters
      }

      const saturation = (color) => Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b)

      const pickClusterColor = (colors, fallback, scoreCluster, tolerance = 28) => {
        if (!colors.length) return fallback
        const clusters = clusterColors(colors, tolerance)
        let bestCluster = null
        let bestScore = Number.NEGATIVE_INFINITY
        for (const cluster of clusters) {
          const score = scoreCluster(cluster)
          if (score > bestScore) {
            bestScore = score
            bestCluster = cluster
          }
        }
        return bestCluster?.color || fallback
      }

      const adj = (c, a) => ({
        r: Math.min(255, Math.max(0, c.r + a)),
        g: Math.min(255, Math.max(0, c.g + a)),
        b: Math.min(255, Math.max(0, c.b + a)),
        hex: `#${Math.min(255, Math.max(0, c.r + a)).toString(16).padStart(2,'0')}${Math.min(255, Math.max(0, c.g + a)).toString(16).padStart(2,'0')}${Math.min(255, Math.max(0, c.b + a)).toString(16).padStart(2,'0')}`
      })

      const diff = (c1, c2) => Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
      const brightness = (c) => c.r + c.g + c.b

      const edgePixels = []
      for (let x = 0; x < 40; x += 1) {
        edgePixels.push(getPixel(x, 0), getPixel(x, 39))
      }
      for (let y = 1; y < 39; y += 1) {
        edgePixels.push(getPixel(0, y), getPixel(39, y))
      }
      const cornerPixels = [
        ...getRegionColors(0, 0, 7, 7),
        ...getRegionColors(32, 0, 39, 7),
        ...getRegionColors(0, 32, 7, 39),
        ...getRegionColors(32, 32, 39, 39),
      ]
      const bgSeedPool = [
        ...edgePixels.filter((pixel) => !isTransparent(pixel)),
        ...cornerPixels.filter((pixel) => !isTransparent(pixel)),
        ...cornerPixels.filter((pixel) => !isTransparent(pixel)),
      ]

      let bg = dominantColor(bgSeedPool)
      const backgroundMask = new Uint8Array(40 * 40)
      const queue = []
      const pushBackground = (x, y) => {
        if (x < 0 || x >= 40 || y < 0 || y >= 40) return
        const index = y * 40 + x
        if (backgroundMask[index]) return
        const pixel = getPixel(x, y)
        if (!isTransparent(pixel) && diff(pixel, bg) > styleProfile.bgTolerance) return
        backgroundMask[index] = 1
        queue.push([x, y])
      }

      for (let x = 0; x < 40; x += 1) {
        pushBackground(x, 0)
        pushBackground(x, 39)
      }
      for (let y = 1; y < 39; y += 1) {
        pushBackground(0, y)
        pushBackground(39, y)
      }

      while (queue.length > 0) {
        const [x, y] = queue.shift()
        pushBackground(x - 1, y)
        pushBackground(x + 1, y)
        pushBackground(x, y - 1)
        pushBackground(x, y + 1)
      }

      const subjectPixels = []
      const subjectMask = new Uint8Array(40 * 40)
      let minX = 39
      let minY = 39
      let maxX = 0
      let maxY = 0

      for (let y = 0; y < 40; y += 1) {
        for (let x = 0; x < 40; x += 1) {
          const pixel = getPixel(x, y)
          if (isTransparent(pixel)) continue
          if (backgroundMask[y * 40 + x]) continue
          if (diff(pixel, bg) <= Math.max(16, styleProfile.bgPick - 12)) continue
          subjectPixels.push({ ...pixel, x, y })
          subjectMask[y * 40 + x] = 1
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }

      if (subjectPixels.length > 0) {
        const visited = new Uint8Array(40 * 40)
        let largestComponent = []
        for (const pixel of subjectPixels) {
          const startIndex = pixel.y * 40 + pixel.x
          if (visited[startIndex] || !subjectMask[startIndex]) continue
          const queuePixels = [[pixel.x, pixel.y]]
          const component = []
          visited[startIndex] = 1
          while (queuePixels.length > 0) {
            const [x, y] = queuePixels.shift()
            const currentIndex = y * 40 + x
            if (!subjectMask[currentIndex]) continue
            component.push({ ...getPixel(x, y), x, y })
            const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
            for (const [nx, ny] of neighbors) {
              if (nx < 0 || nx >= 40 || ny < 0 || ny >= 40) continue
              const neighborIndex = ny * 40 + nx
              if (visited[neighborIndex] || !subjectMask[neighborIndex]) continue
              visited[neighborIndex] = 1
              queuePixels.push([nx, ny])
            }
          }
          if (component.length > largestComponent.length) largestComponent = component
        }

        if (largestComponent.length >= 20) {
          subjectPixels.length = 0
          subjectPixels.push(...largestComponent)
          minX = 39
          minY = 39
          maxX = 0
          maxY = 0
          for (const pixel of subjectPixels) {
            if (pixel.x < minX) minX = pixel.x
            if (pixel.y < minY) minY = pixel.y
            if (pixel.x > maxX) maxX = pixel.x
            if (pixel.y > maxY) maxY = pixel.y
          }
        }
      }

      const fallbackSubject = subjectPixels.length === 0
        ? getRegionColors(6, 6, 33, 39).map((pixel, index) => ({
            ...pixel,
            x: 6 + (index % 28),
            y: 6 + Math.floor(index / 28),
          }))
        : []

      if (fallbackSubject.length > 0) {
        minX = 6
        minY = 6
        maxX = 33
        maxY = 39
        subjectPixels.push(...fallbackSubject)
      }

      const subjectWidth = Math.max(1, maxX - minX + 1)
      const subjectHeight = Math.max(1, maxY - minY + 1)
      const collectRelativeRegion = (xStartRatio, yStartRatio, xEndRatio, yEndRatio) => {
        const xStart = minX + Math.floor(subjectWidth * xStartRatio)
        const yStart = minY + Math.floor(subjectHeight * yStartRatio)
        const xEnd = minX + Math.floor(subjectWidth * xEndRatio)
        const yEnd = minY + Math.floor(subjectHeight * yEndRatio)
        return subjectPixels.filter((pixel) =>
          pixel.x >= xStart &&
          pixel.x <= xEnd &&
          pixel.y >= yStart &&
          pixel.y <= yEnd
        )
      }

      const faceColors = collectRelativeRegion(0.22, 0.12, 0.78, 0.52)
      const shirtColors = collectRelativeRegion(0.14, 0.5, 0.86, 0.98)
      const lowerBodyColors = collectRelativeRegion(0.18, 0.58, 0.82, 1)
      const centerColors = collectRelativeRegion(0.28, 0.28, 0.72, 0.88)

      const refinedBg = bgSeedPool.filter((pixel) => diff(pixel, bg) <= styleProfile.bgTolerance)
      if (refinedBg.length) bg = dominantColor(refinedBg, bg)

      let face = pickClusterColor(
        faceColors,
        dominantColor(faceColors, dominantColor(centerColors, avgColor(subjectPixels))),
        (cluster) => (
          cluster.count * 14 +
          Math.min(diff(cluster.color, bg), 180) * 0.18 +
          brightness(cluster.color) * 0.04
        ),
        24
      )

      let shirt = pickClusterColor(
        [...shirtColors, ...lowerBodyColors],
        dominantColor(shirtColors, dominantColor(lowerBodyColors, avgColor(subjectPixels))),
        (cluster) => {
          const bgDistance = diff(cluster.color, bg)
          const faceDistance = diff(cluster.color, face)
          const darkerThanFace = Math.max(0, brightness(face) - brightness(cluster.color))
          return (
            cluster.count * 15 +
            Math.min(bgDistance, 220) * 0.22 +
            Math.min(faceDistance, 220) * 0.18 +
            darkerThanFace * 0.05 +
            saturation(cluster.color) * 0.04
          )
        },
        26
      )

      if (diff(bg, shirt) < (55 + styleProfile.sep)) {
        const shirtAlternates = lowerBodyColors
          .filter((pixel) => diff(pixel, bg) > (styleProfile.bgPick + 10))
          .filter((pixel) => diff(pixel, face) > 14)
        if (shirtAlternates.length) {
          shirt = pickClusterColor(
            shirtAlternates,
            shirt,
            (cluster) => (
              cluster.count * 14 +
              Math.min(diff(cluster.color, bg), 220) * 0.22 +
              Math.min(diff(cluster.color, face), 220) * 0.18 +
              saturation(cluster.color) * 0.05
            ),
            24
          )
        }
      }

      if (diff(face, shirt) < (30 + styleProfile.sep)) {
        shirt = adj(face, brightness(face) > brightness(shirt) ? -styleProfile.tune : styleProfile.tune)
      }

      const faceHighlight = adj(face, Math.round(styleProfile.tune * 0.75))
      const faceShadow = adj(face, -Math.round(styleProfile.tune * 0.75))
      const shirtHighlight = adj(shirt, styleProfile.tune)
      const shirtShadow = adj(shirt, -styleProfile.tune)

      const traits = {
        background: { name: 'Custom', color: bg.hex },
        body: { name: 'Custom', base: shirt.hex, highlight: shirtHighlight.hex, shadow: shirtShadow.hex },
        belly: { name: 'Custom', base: face.hex, highlight: faceHighlight.hex, shadow: faceShadow.hex },
        beak: { name: 'Small', type: 'small', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
        eyes: { name: 'Round', type: 'round', color: '#0A0A0A' },
        head: { name: 'None', type: 'none', color: '#323232' },
        feet: { name: 'Default Orange', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
        cheeks: { name: 'Pink', base: '#FFB6C1', highlight: '#FFD1D7', shadow: '#FF91A4' },
        effect: { name: 'None' },
        name: randomItem(TRAITS.name),
      }

      resolve(traits)
    }
    img.src = imageSrc
  })
}

export const TRAITS = {
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
    { name: 'Default Orange', type: 'default', base: '#FFB347', highlight: '#FFD089', shadow: '#F08A24', weight: 50 },
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

export function randomItem(arr) {
  const total = arr.reduce((s, i) => s + i.weight, 0)
  let r = Math.random() * total
  for (const item of arr) {
    r -= item.weight
    if (r <= 0) return item
  }
  return arr[0]
}

export function drawAgent(traits, canvas, outputSize = 400, options = {}) {
  if (!canvas) return
  const outlined = Boolean(options?.outline)
  const innerOutlineEnabled = options?.innerOutline ?? outlined
  const outerOutlineEnabled = options?.outerOutline ?? outlined
  const GRID_SIZE = 40
  const offsetX = Number.isFinite(options?.offsetX) ? Number(options.offsetX) : 2
  const offsetY = Number.isFinite(options?.offsetY) ? Number(options.offsetY) : 1
  const LOGICAL_SIZE = Number.isFinite(options?.logicalSize)
    ? Math.max(GRID_SIZE, Number(options.logicalSize))
    : Math.max(GRID_SIZE + offsetX * 2, GRID_SIZE + offsetY * 2, 44)
  const backgroundCanvas = document.createElement('canvas')
  backgroundCanvas.width = LOGICAL_SIZE
  backgroundCanvas.height = LOGICAL_SIZE
  const workingCanvas = document.createElement('canvas')
  workingCanvas.width = LOGICAL_SIZE
  workingCanvas.height = LOGICAL_SIZE
  const shapeCanvas = document.createElement('canvas')
  shapeCanvas.width = LOGICAL_SIZE
  shapeCanvas.height = LOGICAL_SIZE
  const featureCanvas = document.createElement('canvas')
  featureCanvas.width = LOGICAL_SIZE
  featureCanvas.height = LOGICAL_SIZE
  const bgCtx = backgroundCanvas.getContext('2d')
  const ctx = workingCanvas.getContext('2d')
  const shapeCtx = shapeCanvas.getContext('2d')
  const featureCtx = featureCanvas.getContext('2d')
  const scale = 1
  let trackShape = false
  let trackFeature = false
  
  bgCtx.fillStyle = traits.background.color
  bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height)
  
  const set = (x, y, color) => {
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      const px = (x + offsetX) * scale
      const py = (y + offsetY) * scale
      ctx.fillStyle = color
      ctx.fillRect(px, py, scale, scale)
      if (trackShape) {
        shapeCtx.fillStyle = '#ffffff'
        shapeCtx.fillRect(px, py, scale, scale)
      }
      if (trackFeature) {
        featureCtx.fillStyle = '#ffffff'
        featureCtx.fillRect(px, py, scale, scale)
      }
    }
  }
  const bgSet = (x, y, color) => {
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      const px = (x + offsetX) * scale
      const py = (y + offsetY) * scale
      bgCtx.fillStyle = color
      bgCtx.fillRect(px, py, scale, scale)
    }
  }
  const rect = (x1, y1, x2, y2, color) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) set(x, y, color)
    }
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
  const drawOutputOutline = (
    targetCtx,
    maskCanvas,
    targetSize,
    color = 'auto',
    width = 2,
    placement = 'outer'
  ) => {
    const scaledMaskCanvas = document.createElement('canvas')
    scaledMaskCanvas.width = targetSize
    scaledMaskCanvas.height = targetSize
    const scaledMaskCtx = scaledMaskCanvas.getContext('2d')
    scaledMaskCtx.imageSmoothingEnabled = false
    scaledMaskCtx.drawImage(maskCanvas, 0, 0, targetSize, targetSize)

    const mask = scaledMaskCtx.getImageData(0, 0, targetSize, targetSize).data
    const hasMask = (x, y) => {
      if (x < 0 || x >= targetSize || y < 0 || y >= targetSize) return false
      return mask[(y * targetSize + x) * 4 + 3] > 0
    }
    const snapshot = color === 'auto'
      ? targetCtx.getImageData(0, 0, targetSize, targetSize).data
      : null
    const readPixel = (x, y) => {
      if (!snapshot || x < 0 || x >= targetSize || y < 0 || y >= targetSize) return null
      const index = (y * targetSize + x) * 4
      const alpha = snapshot[index + 3]
      if (alpha === 0) return null
      return {
        r: snapshot[index],
        g: snapshot[index + 1],
        b: snapshot[index + 2],
      }
    }
    const deepenPixel = (pixel, factor = 0.9) => {
      if (!pixel) return '#050505'
      const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
      return `#${toHex(pixel.r * factor)}${toHex(pixel.g * factor)}${toHex(pixel.b * factor)}`
    }
    const pickOutlineColor = (x, y) => {
      if (color !== 'auto') return color
      const neighborOffsets = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]
      for (const [dx, dy] of neighborOffsets) {
        const nx = x + dx
        const ny = y + dy
        if (!hasMask(nx, ny)) continue
        const sample = readPixel(nx, ny)
        if (sample) return deepenPixel(sample)
      }
      return '#050505'
    }

    for (let y = 0; y < targetSize; y += 1) {
      for (let x = 0; x < targetSize; x += 1) {
        const isMaskPixel = hasMask(x, y)
        if (placement === 'outer' && isMaskPixel) continue
        if (placement === 'inner' && !isMaskPixel) continue
        let touchesEdge = false
        for (let offset = 1; offset <= width; offset += 1) {
          const hit =
            placement === 'outer'
              ? hasMask(x - offset, y) ||
                hasMask(x + offset, y) ||
                hasMask(x, y - offset) ||
                hasMask(x, y + offset)
              : !hasMask(x - offset, y) ||
                !hasMask(x + offset, y) ||
                !hasMask(x, y - offset) ||
                !hasMask(x, y + offset)
          if (hit) {
            touchesEdge = true
            break
          }
        }
        if (touchesEdge) {
          targetCtx.fillStyle = pickOutlineColor(x, y)
          targetCtx.fillRect(x, y, 1, 1)
        }
      }
    }
  }
  const drawSpriteInnerOutline = (maskCanvas, color = 'auto') => {
    const mask = maskCanvas.getContext('2d').getImageData(0, 0, LOGICAL_SIZE, LOGICAL_SIZE).data
    const sprite = ctx.getImageData(0, 0, LOGICAL_SIZE, LOGICAL_SIZE).data
    const hasMask = (x, y) => {
      if (x < 0 || x >= LOGICAL_SIZE || y < 0 || y >= LOGICAL_SIZE) return false
      return mask[(y * LOGICAL_SIZE + x) * 4 + 3] > 0
    }
    const readPixel = (x, y) => {
      if (x < 0 || x >= LOGICAL_SIZE || y < 0 || y >= LOGICAL_SIZE) return null
      const index = (y * LOGICAL_SIZE + x) * 4
      const alpha = sprite[index + 3]
      if (alpha === 0) return null
      return {
        r: sprite[index],
        g: sprite[index + 1],
        b: sprite[index + 2],
      }
    }
    const deepenPixel = (pixel, factor = 0.9) => {
      if (!pixel) return '#050505'
      const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
      return `#${toHex(pixel.r * factor)}${toHex(pixel.g * factor)}${toHex(pixel.b * factor)}`
    }
    for (let y = 0; y < LOGICAL_SIZE; y += 1) {
      for (let x = 0; x < LOGICAL_SIZE; x += 1) {
        if (!hasMask(x, y)) continue
        const touchesOutside =
          !hasMask(x - 1, y) ||
          !hasMask(x + 1, y) ||
          !hasMask(x, y - 1) ||
          !hasMask(x, y + 1)
        if (touchesOutside) {
          ctx.fillStyle = color === 'auto' ? deepenPixel(readPixel(x, y)) : color
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  }
  const getMaskBounds = (maskCanvas) => {
    const maskCtx = maskCanvas.getContext('2d')
    const mask = maskCtx.getImageData(0, 0, LOGICAL_SIZE, LOGICAL_SIZE).data
    let minX = LOGICAL_SIZE
    let minY = LOGICAL_SIZE
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < LOGICAL_SIZE; y += 1) {
      for (let x = 0; x < LOGICAL_SIZE; x += 1) {
        if (mask[(y * LOGICAL_SIZE + x) * 4 + 3] === 0) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }

    if (maxX === -1 || maxY === -1) {
      return { x: 0, y: 0, width: LOGICAL_SIZE, height: LOGICAL_SIZE }
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    }
  }
  const mergeMasks = (...maskCanvases) => {
    const mergedCanvas = document.createElement('canvas')
    mergedCanvas.width = LOGICAL_SIZE
    mergedCanvas.height = LOGICAL_SIZE
    const mergedCtx = mergedCanvas.getContext('2d')
    mergedCtx.imageSmoothingEnabled = false
    for (const maskCanvas of maskCanvases) {
      if (!maskCanvas) continue
      mergedCtx.drawImage(maskCanvas, 0, 0)
    }
    return mergedCanvas
  }
  const cloneMask = (maskCanvas) => {
    const clonedCanvas = document.createElement('canvas')
    clonedCanvas.width = LOGICAL_SIZE
    clonedCanvas.height = LOGICAL_SIZE
    const clonedCtx = clonedCanvas.getContext('2d')
    clonedCtx.imageSmoothingEnabled = false
    clonedCtx.drawImage(maskCanvas, 0, 0)
    return clonedCanvas
  }
  const dilateMask = (maskCanvas, iterations = 1) => {
    let currentCanvas = cloneMask(maskCanvas)
    for (let step = 0; step < iterations; step += 1) {
      const sourceCtx = currentCanvas.getContext('2d')
      const source = sourceCtx.getImageData(0, 0, LOGICAL_SIZE, LOGICAL_SIZE).data
      const nextCanvas = document.createElement('canvas')
      nextCanvas.width = LOGICAL_SIZE
      nextCanvas.height = LOGICAL_SIZE
      const nextCtx = nextCanvas.getContext('2d')
      const nextImage = nextCtx.createImageData(LOGICAL_SIZE, LOGICAL_SIZE)
      const setFilled = (x, y) => {
        if (x < 0 || x >= LOGICAL_SIZE || y < 0 || y >= LOGICAL_SIZE) return
        const index = (y * LOGICAL_SIZE + x) * 4
        nextImage.data[index] = 255
        nextImage.data[index + 1] = 255
        nextImage.data[index + 2] = 255
        nextImage.data[index + 3] = 255
      }
      for (let y = 0; y < LOGICAL_SIZE; y += 1) {
        for (let x = 0; x < LOGICAL_SIZE; x += 1) {
          const index = (y * LOGICAL_SIZE + x) * 4 + 3
          if (source[index] === 0) continue
          setFilled(x, y)
          setFilled(x - 1, y)
          setFilled(x + 1, y)
          setFilled(x, y - 1)
          setFilled(x, y + 1)
        }
      }
      nextCtx.putImageData(nextImage, 0, 0)
      currentCanvas = nextCanvas
    }
    return currentCanvas
  }
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
  trackShape = true
  
  const body = traits.body.base
  const bodyHighlight = traits.body.highlight
  const bodyShadow = traits.body.shadow
  const belly = traits.belly.base
  const bellyHighlight = traits.belly.highlight
  const beak = traits.beak.base
  const beakHighlight = traits.beak.highlight
  const beakShadow = traits.beak.shadow
  const feet = traits.feet?.base || '#FFB347'
  const feetHighlight = traits.feet?.highlight || '#FFD089'
  const feetShadow = traits.feet?.shadow || '#F08A24'
  
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
  
  trackFeature = true
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
  trackFeature = false
  
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

  trackFeature = true
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
    default: { highlight: 0.28, shadow: 0.22, spec: 0.4, mid: 0.28, deep: 0.12, fold: 0.12 }
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
    rect(cx - 2, 8, cx + 5, 8, headDeep)
    rect(cx - 1, 7, cx + 3, 7, headHighlight)
    rect(cx + 8, 8, cx + 12, 11, headShadow)
    rect(cx + 9, 9, cx + 12, 10, headColor)
    rect(cx + 10, 10, cx + 11, 11, headDeep)
    rect(cx - 12, 8, cx - 8, 9, headShadow)
    rect(cx - 11, 9, cx - 10, 10, headDeep)
    rect(cx + 9, 11, cx + 11, 11, '#111111')
    rect(cx - 8, 9, cx + 3, 9, headDeep)
    rect(cx - 7, 6, cx - 6, 7, headSpec)
    rect(cx + 4, 6, cx + 5, 7, headMid)
    rect(cx + 8, 10, cx + 10, 11, '#121212')
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
    rect(cx - 4, 6, cx - 3, 8, headHighlight)
    rect(cx, 6, cx + 1, 8, headHighlight)
    rect(cx + 4, 6, cx + 5, 8, headHighlight)
    rect(cx + 8, 6, cx + 9, 8, headHighlight)
    rect(cx - 2, 5, cx + 1, 6, headSpec)
    rect(cx + 2, 7, cx + 3, 8, headDeep)
    rect(cx - 6, 8, cx - 6, 9, headDeep)
    rect(cx + 6, 8, cx + 6, 9, headDeep)
    rect(cx - 10, 9, cx - 10, 9, headDeep)
    rect(cx + 9, 9, cx + 10, 9, headDeep)
    rect(cx - 1, 9, cx, 9, headDeep)
    rect(cx + 9, 7, cx + 9, 8, headDeep)
    rect(cx - 11, 7, cx - 11, 8, headDeep)
    rect(cx - 3, 10, cx + 2, 10, 'rgba(0,0,0,0.16)')
  }

  if (traits.head.type !== 'none' && traits.head.type !== 'scarf') {
    rect(cx - 8, 10, cx + 8, 10, 'rgba(0,0,0,0.12)')
  }

  trackFeature = false

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
  
  trackFeature = true
  rect(10, 36, 14, 37, feet)
  rect(9, 37, 15, 37, feet)
  rect(11, 35, 13, 36, feetHighlight)
  rect(11, 37, 14, 37, feetShadow)
  rect(12, 37, 14, 38, feet)
  rect(12, 37, 13, 38, feetHighlight)
  rect(8, 37, 10, 38, feet)
  rect(9, 38, 10, 38, feetHighlight)

  rect(25, 36, 29, 37, feet)
  rect(24, 37, 30, 37, feet)
  rect(26, 35, 28, 36, feetHighlight)
  rect(25, 37, 28, 37, feetShadow)
  rect(25, 37, 27, 38, feet)
  rect(26, 37, 27, 38, feetHighlight)
  rect(29, 37, 31, 38, feet)
  rect(29, 38, 30, 38, feetHighlight)

  trackFeature = false
  if (innerOutlineEnabled) {
    const combinedOutlineMask = mergeMasks(
      shapeCanvas,
      featureCanvas,
      traits.head?.type === 'scarf' ? dilateMask(shapeCanvas, 1) : null
    )
    drawSpriteInnerOutline(combinedOutlineMask)
  }

  trackShape = false
  rect(7, 39, 32, 39, 'rgba(0,0,0,0.08)')
  rect(9, 39, 30, 39, 'rgba(0,0,0,0.14)')
  rect(11, 39, 28, 39, 'rgba(0,0,0,0.20)')
  rect(14, 39, 25, 39, 'rgba(0,0,0,0.12)')

  const size = Math.max(256, Number(outputSize) || 400)
  const outCtx = canvas.getContext('2d')
  canvas.width = size
  canvas.height = size
  outCtx.imageSmoothingEnabled = false
  outCtx.clearRect(0, 0, size, size)
  outCtx.drawImage(backgroundCanvas, 0, 0, size, size)
  const spriteScale = Number.isFinite(options?.spriteScale) ? Number(options.spriteScale) : 0.9
  const spriteSize = Math.floor(size * spriteScale)
  const spriteOffset = Math.floor((size - spriteSize) / 2)
  const centerToContent = Boolean(options?.centerToContent)
  const centerXToLogicalAxis = Boolean(options?.centerXToLogicalAxis)
  let outlineMaskCanvas = shapeCanvas
  if (centerToContent) {
    const bounds = getMaskBounds(shapeCanvas)
    const boundsAspect = bounds.width / Math.max(1, bounds.height)
    let drawWidth = spriteSize
    let drawHeight = spriteSize

    if (boundsAspect > 1) {
      drawHeight = Math.max(1, Math.round(spriteSize / boundsAspect))
    } else if (boundsAspect < 1) {
      drawWidth = Math.max(1, Math.round(spriteSize * boundsAspect))
    }

    const logicalCenterX = (LOGICAL_SIZE - 1) / 2
    const boundsCenterX = bounds.x + (bounds.width - 1) / 2
    const normalizedCenterX = centerXToLogicalAxis ? logicalCenterX : boundsCenterX
    const cropCenterRatioX = normalizedCenterX / Math.max(1, LOGICAL_SIZE - 1)
    const drawCenterX = cropCenterRatioX * drawWidth
    const drawX = Math.round(size / 2 - drawCenterX)
    const drawY = Math.floor((size - drawHeight) / 2)
    outCtx.drawImage(
      workingCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    )

    if (outerOutlineEnabled) {
      outlineMaskCanvas = document.createElement('canvas')
      outlineMaskCanvas.width = LOGICAL_SIZE
      outlineMaskCanvas.height = LOGICAL_SIZE
      const centeredMaskCtx = outlineMaskCanvas.getContext('2d')
      centeredMaskCtx.imageSmoothingEnabled = false
      const logicalAspect = bounds.width / Math.max(1, bounds.height)
      let maskDrawWidth = LOGICAL_SIZE
      let maskDrawHeight = LOGICAL_SIZE
      if (logicalAspect > 1) {
        maskDrawHeight = Math.max(1, Math.round(LOGICAL_SIZE / logicalAspect))
      } else if (logicalAspect < 1) {
        maskDrawWidth = Math.max(1, Math.round(LOGICAL_SIZE * logicalAspect))
      }
      const maskCenterX = centerXToLogicalAxis ? logicalCenterX : boundsCenterX
      const maskCenterRatioX = maskCenterX / Math.max(1, LOGICAL_SIZE - 1)
      const maskDrawX = Math.round(LOGICAL_SIZE / 2 - maskCenterRatioX * maskDrawWidth)
      const maskDrawY = Math.floor((LOGICAL_SIZE - maskDrawHeight) / 2)
      centeredMaskCtx.drawImage(
        shapeCanvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        maskDrawX,
        maskDrawY,
        maskDrawWidth,
        maskDrawHeight
      )
    }
  } else {
    outCtx.drawImage(workingCanvas, spriteOffset, spriteOffset, spriteSize, spriteSize)
  }
  if (outerOutlineEnabled) {
    drawOutputOutline(outCtx, outlineMaskCanvas, size)
  }

  if (options?.watermark !== false) {
    // Keep branding visible without overpowering the generated artwork.
    outCtx.save()
    outCtx.translate(canvas.width / 2, canvas.height / 2)
    outCtx.rotate((-28 * Math.PI) / 180)
    outCtx.textAlign = 'center'
    outCtx.textBaseline = 'middle'
    outCtx.font = `700 ${Math.floor(size * 0.06)}px "Press Start 2P", "JetBrains Mono", monospace`
    outCtx.fillStyle = 'rgba(255,255,255,0.16)'
    outCtx.shadowColor = 'rgba(0,0,0,0.10)'
    outCtx.shadowBlur = Math.max(1, Math.floor(size * 0.002))
    outCtx.shadowOffsetX = 0
    outCtx.shadowOffsetY = Math.max(1, Math.floor(size * 0.001))
    outCtx.fillText('8bitPenguins', 0, 0)
    outCtx.restore()
  }
}

export function generateRandomPenguinTraits() {
  const t = {
    background: randomItem(TRAITS.background),
    body: randomItem(TRAITS.body),
    belly: randomItem(TRAITS.belly),
    beak: randomItem(TRAITS.beak),
    eyes: randomItem(TRAITS.eyes),
    head: randomItem(TRAITS.head),
    effect: { name: 'None' },
    feet: { name: 'Default Orange', base: '#FFB347', highlight: '#FFD089', shadow: '#F08A24' },
    name: randomItem(TRAITS.name),
  }

  const pickEffectVariant = () => randomItem(EFFECT_VARIANTS).name
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null
  }
  const diff = (c1, c2) => {
    if (!c1 || !c2) return 999
    return Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b)
  }
  const contrast = (a, b) => diff(hexToRgb(a), hexToRgb(b))
  const rerollWithLimit = (item, pool, colorGetter, target, minDiff = 80, maxAttempts = 100) => {
    let next = item
    for (let i = 0; i < maxAttempts && contrast(colorGetter(next), target) < minDiff; i++) {
      next = randomItem(pool)
    }
    return next
  }

  const bgColor = t.background.color
  if (t.background.fx === 'snowflakes') t.effect = { name: 'Snow', variant: pickEffectVariant() }
  if (t.background.fx === 'softdots') t.effect = { name: 'Stone', variant: pickEffectVariant() }
  t.body = rerollWithLimit(t.body, TRAITS.body, (x) => x.base, bgColor)
  const bodyBase = t.body.base
  t.belly = rerollWithLimit(t.belly, TRAITS.belly, (x) => x.base, bodyBase)
  t.belly = rerollWithLimit(t.belly, TRAITS.belly, (x) => x.base, bgColor)

  const coloredHeadPool = TRAITS.head.filter((h) => h.color && h.type !== 'none' && h.type !== 'crown' && h.type !== 'halo')
  const hasHeadAccessory = t.head.type !== 'none' && t.head.type !== 'crown' && t.head.type !== 'halo'
  if (hasHeadAccessory && t.head.color && coloredHeadPool.length) {
    t.head = rerollWithLimit(t.head, coloredHeadPool, (x) => x.color, bodyBase)
  }

  return t
}

export function renderPenguin4k(traits, options = {}) {
  const canvas = document.createElement('canvas')
  drawAgent(traits, canvas, 4096, options)
  return canvas
}

export function copyCanvasToPreview(sourceCanvas, targetCanvas) {
  if (!sourceCanvas || !targetCanvas) return
  const ctx = targetCanvas.getContext('2d')
  targetCanvas.width = 400
  targetCanvas.height = 400
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
  ctx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height)
}
