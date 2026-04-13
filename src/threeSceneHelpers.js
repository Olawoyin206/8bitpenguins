import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export function getSceneFog(color) {
  return new THREE.Fog(color, 28, 110)
}

function resolveBackgroundFx(traitsOrBackground) {
  const traits = traitsOrBackground?.background ? traitsOrBackground : null
  const background = traits?.background || traitsOrBackground
  const effectName = String(traits?.effect?.name || '').toLowerCase()
  const name = String(background?.name || '')
  if (effectName === 'snow') return 'snowflakes'
  if (effectName === 'stone' || effectName === 'dots') return 'softdots'
  if (background?.fx) return String(background.fx)
  if (/arctic|snow|ice|white/i.test(name)) return 'snowflakes'
  if (/royal blue|deep teal|golden glow/i.test(name)) return 'softdots'
  return ''
}

function resolveEffectPalette(traits) {
  const effectVariant = String(traits?.effect?.variant || 'White')
  if (effectVariant === 'Golden') {
    return {
      snowCore: '#FFE8AA',
      snowMid: '#FFD678',
      snowOuter: '#FFCB5A',
      snowFar: '#FFC450',
      dotCore: '#FFE296',
      dotMid: '#FFD06E',
      dotOuter: '#FFC250',
    }
  }
  if (effectVariant === 'Light') {
    return {
      snowCore: '#D7F6FF',
      snowMid: '#B4E6FF',
      snowOuter: '#96D8FF',
      snowFar: '#82CEFF',
      dotCore: '#CDECFF',
      dotMid: '#A5DCFF',
      dotOuter: '#8CD2FF',
    }
  }
  return {
    snowCore: '#FFFFFF',
    snowMid: '#FFFFFF',
    snowOuter: '#FFFFFF',
    snowFar: '#FFFFFF',
    dotCore: '#FFFFFF',
    dotMid: '#FFFFFF',
    dotOuter: '#FFFFFF',
  }
}

function mapFxPoint(x, y, index, depthScale = 1) {
  const xWorld = ((x - 20) / 20) * 9.8
  const yWorld = ((20 - y) / 20) * 5.9 + 3.2
  const zWorld = -5.2 - (((index * 37) % 11) * 0.24 * depthScale)
  return [xWorld, yWorld, zWorld]
}

function seededUnit(seed) {
  const value = Math.sin((seed * 127.1) + 311.7) * 43758.5453123
  return value - Math.floor(value)
}

function buildSpreadOffsets({
  count,
  seed,
  innerRadius,
  outerRadius,
  depthScale = 0.08,
  yScale = 0.86,
  angleJitter = 0.24,
}) {
  const offsets = []
  const baseAngle = seededUnit(seed) * Math.PI * 2

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / count
    const angle = baseAngle
      + (Math.PI * 2 * t)
      + ((seededUnit(seed + (i * 17)) - 0.5) * angleJitter)
    const radius = innerRadius
      + ((outerRadius - innerRadius) * (0.35 + (seededUnit(seed + (i * 31)) * 0.65)))
    const depth = -(depthScale * (0.25 + (seededUnit(seed + (i * 47)) * 0.75)))
    offsets.push([
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * yScale,
      depth,
    ])
  }

  return offsets
}

export function createGroundMesh(background, THREE) {
  const groundGeo = new THREE.PlaneGeometry(60, 60)
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.16 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = GROUND_LEVEL_Y
  ground.receiveShadow = true
  return ground
}

export function createBackgroundFx(traitsOrBackground, THREE, options = {}) {
  const group = new THREE.Group()
  const traits = traitsOrBackground?.background ? traitsOrBackground : { background: traitsOrBackground, effect: null }
  const background = traits.background || traitsOrBackground
  const fx = resolveBackgroundFx(traits)
  const palette = resolveEffectPalette(traits)
  const particlesOnly = Boolean(options.particlesOnly)
  const screenAligned = options.screenAligned || null
  group.position.z = screenAligned ? 0 : -4.9

  const setFxPosition = (object, x, y, z) => {
    if (!screenAligned) {
      object.position.set(x, y, z)
      return
    }

    const right = screenAligned.right
    const up = screenAligned.up
    const forward = screenAligned.forward
    const depth = -z

    object.position.set(
      (right.x * x) + (up.x * y) + (forward.x * depth),
      (right.y * x) + (up.y * y) + (forward.y * depth),
      (right.z * x) + (up.z * y) + (forward.z * depth)
    )
  }

  const addMistPlane = (color, opacity, width = 22, height = 16, y = 3.8, z = -10) => {
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    setFxPosition(mist, 0, y, z)
    group.add(mist)
  }

  const createCrystalMaterial = (color, emissive) => new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.18,
    metalness: 0.02,
    transparent: true,
    opacity: 0.95,
    transmission: 0.18,
    thickness: 0.4,
    clearcoat: 0.26,
    clearcoatRoughness: 0.12,
    emissive,
    emissiveIntensity: 0.18,
  })

  const createStoneMaterial = (color, emissive) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0.04,
    emissive,
    emissiveIntensity: 0.05,
  })

  const addOffsetFx = (builder, baseX, baseY, baseZ, offsets, scale, indexSeed = 0) => {
    offsets.forEach(([dx, dy, dz = 0], offsetIndex) => {
      builder(
        baseX + dx,
        baseY + dy,
        baseZ + dz,
        scale,
        indexSeed + offsetIndex + 1
      )
    })
  }

  const addSnowCrystal = (x, y, z, size, index) => {
    const crystal = new THREE.Group()
    const coreMat = createCrystalMaterial(palette.snowCore, palette.snowMid)
    const armMat = createCrystalMaterial(palette.snowMid, palette.snowOuter)
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.3, 0), coreMat)
    core.castShadow = false
    core.receiveShadow = false
    crystal.add(core)

    const armOffsets = [
      { rotationZ: 0 },
      { rotationZ: Math.PI / 3 },
      { rotationZ: -Math.PI / 3 },
    ]
    armOffsets.forEach(({ rotationZ }) => {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.045, size * 0.045, size * 1.02, 6),
        armMat.clone()
      )
      arm.rotation.z = rotationZ
      arm.castShadow = false
      arm.receiveShadow = false
      crystal.add(arm)
    })

    const tipPositions = [
      [size * 0.5, 0, 0],
      [-size * 0.5, 0, 0],
      [0, size * 0.5, 0],
      [0, -size * 0.5, 0],
    ]
    tipPositions.forEach(([dx, dy, dz], tipIndex) => {
      const tip = new THREE.Mesh(
        new THREE.OctahedronGeometry(size * 0.09, 0),
        createCrystalMaterial(palette.snowFar, palette.snowOuter)
      )
      tip.position.set(dx, dy, dz)
      tip.rotation.set(0.2 * tipIndex, 0.35 * tipIndex, 0.15 * tipIndex)
      crystal.add(tip)
    })

    setFxPosition(crystal, x, y, z)
    crystal.rotation.set(0.28 + index * 0.07, 0.22 + index * 0.11, index * 0.41)
    group.add(crystal)
  }

  const addStonePebble = (x, y, z, size, index) => {
    const pebble = new THREE.Group()
    const coreMat = createStoneMaterial(palette.dotCore, palette.dotMid)
    const accentMat = createStoneMaterial(palette.dotMid, palette.dotOuter)
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(size * 0.32, 0), coreMat)
    core.scale.set(1 + ((index % 3) * 0.18), 0.84 + ((index % 2) * 0.14), 0.9 + ((index % 4) * 0.08))
    core.castShadow = false
    core.receiveShadow = false
    pebble.add(core)

    const chip = new THREE.Mesh(new THREE.IcosahedronGeometry(size * 0.15, 0), accentMat)
    chip.position.set(size * 0.2, size * 0.06, size * 0.1)
    chip.scale.set(1.1, 0.76, 0.9)
    chip.castShadow = false
    chip.receiveShadow = false
    pebble.add(chip)

    setFxPosition(pebble, x, y, z)
    pebble.rotation.set(index * 0.17, 0.42 + index * 0.09, index * 0.26)
    group.add(pebble)
  }

  if (fx === 'snowflakes') {
    if (!particlesOnly) {
      addMistPlane('#f4f9ff', 0.28, 18, 13, 2.6, -5.8)
      addMistPlane('#dcecff', 0.16, 15, 9, 3.3, -5.1)
    }
    const flakes = [[3, 4], [10, 7], [32, 5], [36, 10], [6, 33], [14, 35], [29, 32], [35, 27], [2, 20], [38, 22]]
    flakes.forEach(([x, y], index) => {
      const [xWorld, yWorld, zWorld] = mapFxPoint(x, y, index)
      addSnowCrystal(xWorld, yWorld, zWorld, 0.94, index)
      addOffsetFx(addSnowCrystal, xWorld, yWorld, zWorld - 0.06, buildSpreadOffsets({
        count: 8,
        seed: (index + 1) * 101,
        innerRadius: 0.48,
        outerRadius: 0.72,
        depthScale: 0.06,
        yScale: 0.9,
      }), 0.24, index * 20)
      addOffsetFx(addSnowCrystal, xWorld, yWorld, zWorld - 0.12, buildSpreadOffsets({
        count: 4,
        seed: (index + 1) * 211,
        innerRadius: 0.92,
        outerRadius: 1.14,
        depthScale: 0.1,
        yScale: 0.96,
        angleJitter: 0.18,
      }), 0.2, index * 40)
    })
  }

  if (fx === 'softdots') {
    if (!particlesOnly) {
      addMistPlane('#ffffff', 0.1, 18, 12, 2.4, -5.4)
    }
    const dots = [[4, 5], [8, 11], [13, 4], [18, 8], [25, 4], [30, 9], [35, 6], [6, 29], [12, 34], [20, 36], [28, 33], [34, 29]]
    dots.forEach(([x, y], index) => {
      const [xWorld, yWorld, zWorld] = mapFxPoint(x, y, index, 0.8)
      addStonePebble(xWorld, yWorld, zWorld, 1.04, index)
      addOffsetFx(addStonePebble, xWorld, yWorld, zWorld - 0.04, buildSpreadOffsets({
        count: 8,
        seed: (index + 1) * 149,
        innerRadius: 0.42,
        outerRadius: 0.7,
        depthScale: 0.07,
        yScale: 0.88,
      }), 0.22, index * 16)
    })
  }

  if (!particlesOnly && !fx && background?.fx === 'snowflakes') {
    addMistPlane('#f4f9ff', 0.18, 25, 18, 4.2, -11.5)
  }

  if (!particlesOnly && !fx && background?.fx === 'softdots') {
    addMistPlane('#ffffff', 0.06, 22, 15, 3.4, -10.5)
  }

  return group
}

function disposeMaterial(material) {
  if (!material) return
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial)
    return
  }
  material.dispose?.()
}

export function disposeObject3D(object) {
  if (!object) return
  object.traverse((child) => {
    child.geometry?.dispose?.()
    disposeMaterial(child.material)
  })
}

export function updatePenguinOrthoCamera(camera, aspect = 1) {
  camera.left = (-ORTHO_FRUSTUM_SIZE * aspect) / 2
  camera.right = (ORTHO_FRUSTUM_SIZE * aspect) / 2
  camera.top = ORTHO_FRUSTUM_SIZE / 2
  camera.bottom = -ORTHO_FRUSTUM_SIZE / 2
  camera.near = 0.1
  camera.far = 1000
  camera.updateProjectionMatrix()
}

export function createPenguinOrthoCamera(THREE, aspect = 1) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
  updatePenguinOrthoCamera(camera, aspect)
  camera.position.set(-8, 6, 12)
  camera.lookAt(0, 0, 0)
  return camera
}

export function addPenguinSceneLights(scene, THREE, options = {}) {
  const profile = options.profile || 'preview'
  const highQuality = profile === 'preview' || profile === 'snapshot-hq'
  const enableShadows = profile !== 'snapshot-fast'
  const shadowMapSize = enableShadows
    ? Number(options.shadowMapSize || (profile === 'snapshot-hq' ? 4096 : 1536))
    : 0

  const ambient = new THREE.AmbientLight(0xffffff, highQuality ? 0.4 : 0.8)
  scene.add(ambient)

  const hemiLight = new THREE.HemisphereLight(
    0xf8fbff,
    highQuality ? 0x26323d : 0x5c6470,
    highQuality ? 0.68 : 0.4
  )
  scene.add(hemiLight)

  const keyLight = new THREE.DirectionalLight(0xfff3d6, highQuality ? 1.45 : 1.35)
  keyLight.position.set(-6.5, 10.5, 15)
  if (enableShadows) {
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = shadowMapSize
    keyLight.shadow.mapSize.height = shadowMapSize
    keyLight.shadow.camera.near = 1
    keyLight.shadow.camera.far = 60
    keyLight.shadow.camera.left = -15
    keyLight.shadow.camera.right = 15
    keyLight.shadow.camera.top = 15
    keyLight.shadow.camera.bottom = -15
    keyLight.shadow.radius = highQuality ? 2 : 1.6
    keyLight.shadow.bias = highQuality ? -0.00006 : -0.001
    keyLight.shadow.normalBias = highQuality ? 0.01 : 0
  }
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xd7ebff, highQuality ? 0.32 : 0.28)
  fillLight.position.set(8.5, 7.5, 8.5)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xd5e6ff, 0.5)
  rimLight.position.set(6, 6.5, -14)
  scene.add(rimLight)

  if (highQuality) {
    const topLight = new THREE.SpotLight(0xffffff, 0.28, 36, Math.PI / 5.5, 0.4, 1.1)
    topLight.position.set(-1, 14.5, 7)
    topLight.target.position.set(0, 0.5, 0)
    scene.add(topLight)
    scene.add(topLight.target)
  }
}

export function configureRenderer(renderer, pixelRatio) {
  renderer.setPixelRatio(pixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.06
  renderer.useLegacyLights = false
  renderer.shadowMap.enabled = true
}

export const ORTHO_FRUSTUM_SIZE = 13
export const PENGUIN_RENDER_SCALE = 0.92
export const GROUND_LEVEL_Y = -4.85
export const PENGUIN_PIVOT_Y = 0.5
export const VOXEL_CORNER_RADIUS = 0.08
export const VOXEL_CORNER_SEGMENTS = 4
export const VOXEL_GEOMETRY_SCALE = 0.84

export function alignObjectToGround(object, groundY) {
  object.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(object)
  if (!Number.isFinite(bounds.min.y)) return
  object.position.y += groundY - bounds.min.y
}

export function createVoxelPenguin(traits, THREE) {
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
  const voxelWidth = voxelSize * VOXEL_GEOMETRY_SCALE
  const voxelHeight = voxelSize * VOXEL_GEOMETRY_SCALE
  let accessoryMode = false
  let accessoryMaterialType = 'default'
  const materialCache = new Map()
  const geometryCache = new Map()
  const voxelMap = new Map()
  
  const getMaterialProfile = (variant) => {
    if (variant === 'crown' || variant === 'halo') {
      return {
        roughness: 0.24,
        metalness: 0.58,
        emissiveIntensity: 0.01,
        clearcoat: 0.42,
        clearcoatRoughness: 0.18,
        sheen: 0.02,
        sheenRoughness: 0.5,
        reflectivity: 0.5,
      }
    }

    if (variant === 'beanie' || variant === 'scarf') {
      return {
        roughness: 0.82,
        metalness: 0.02,
        emissiveIntensity: 0.008,
        clearcoat: 0.04,
        clearcoatRoughness: 0.9,
        sheen: 0.22,
        sheenRoughness: 0.86,
        reflectivity: 0.08,
      }
    }

    if (variant === 'cap' || variant === 'headband' || variant === 'tophat' || variant === 'bow') {
      return {
        roughness: 0.5,
        metalness: 0.08,
        emissiveIntensity: 0.012,
        clearcoat: 0.18,
        clearcoatRoughness: 0.3,
        sheen: 0.06,
        sheenRoughness: 0.62,
        reflectivity: 0.24,
      }
    }

    return {
      roughness: 0.42,
      metalness: 0.04,
      emissiveIntensity: 0.015,
      clearcoat: 0.22,
      clearcoatRoughness: 0.34,
      sheen: 0.08,
      sheenRoughness: 0.6,
      reflectivity: 0.28,
    }
  }

  const mat = (color, variant = 'body') => {
    const cacheKey = `${variant}:${color}`
    if (!materialCache.has(cacheKey)) {
      const profile = getMaterialProfile(variant)
      materialCache.set(
        cacheKey,
        new THREE.MeshPhysicalMaterial({
          color,
          roughness: profile.roughness,
          metalness: profile.metalness,
          flatShading: false,
          emissive: color,
          emissiveIntensity: profile.emissiveIntensity,
          clearcoat: profile.clearcoat,
          clearcoatRoughness: profile.clearcoatRoughness,
          iridescence: 0,
          sheen: profile.sheen,
          sheenRoughness: profile.sheenRoughness,
          reflectivity: profile.reflectivity,
        })
      )
    }
    return materialCache.get(cacheKey)
  }

  const geo = (depth) => {
    if (!geometryCache.has(depth)) {
      geometryCache.set(
        depth,
        new RoundedBoxGeometry(
          voxelWidth,
          voxelHeight,
          depth * voxelScale * VOXEL_GEOMETRY_SCALE,
          VOXEL_CORNER_SEGMENTS,
          Math.min(VOXEL_CORNER_RADIUS, voxelWidth * 0.18)
        )
      )
    }
    return geometryCache.get(depth)
  }

  const voxel = (x, y, z, color, depth = 4, frontOffset = false, zNudge = 0, castsShadow = true, materialVariant = 'body') => {
    const mesh = new THREE.Mesh(geo(depth), mat(color, materialVariant))
    mesh.position.set(
      (x - cx) * voxelSize * 0.5, 
      (20 - y) * voxelSize * 0.5, 
      (z - 1) * voxelSize * 0.4 + (frontOffset ? (depth * voxelScale * 0.5) + 0.22 : 0) + zNudge
    )
    mesh.castShadow = castsShadow
    mesh.receiveShadow = false
    return mesh
  }

  const voxelKey = (x, y, z, depth, frontOffset, zNudge) =>
    `${x}:${y}:${z}:${depth}:${frontOffset ? 1 : 0}:${zNudge.toFixed(3)}`

  const placeVoxel = (x, y, z, color, depth = 4, frontOffset = false, zNudge = 0, castsShadow = true, materialVariant = 'body') => {
    const key = voxelKey(x, y, z, depth, frontOffset, zNudge)
    const existing = voxelMap.get(key)
    if (existing) {
      group.remove(existing)
    }

    const mesh = voxel(x, y, z, color, depth, frontOffset, zNudge, castsShadow, materialVariant)
    voxelMap.set(key, mesh)
    group.add(mesh)
  }

  const rect = (x1, y1, x2, y2, color, depth = 4, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        placeVoxel(x, y, z, color, depth, false, accessoryMode ? 0.08 : 0, !accessoryMode, accessoryMode ? accessoryMaterialType : 'body')
      }
    }
  }

  const rectFront = (x1, y1, x2, y2, color, depth = 4, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        placeVoxel(x, y, z, color, depth, true, accessoryMode ? 0.08 : 0, !accessoryMode, accessoryMode ? accessoryMaterialType : 'body')
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
  accessoryMaterialType = headType
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
    rect(cx - 2, 8, cx + 5, 8, headDeep, 20)
    rect(cx - 1, 7, cx + 3, 7, headHighlight, 20)
    rect(cx + 8, 8, cx + 12, 11, headShadow, 20)
    rect(cx + 9, 9, cx + 12, 10, headColor, 20)
    rect(cx + 10, 10, cx + 11, 11, headDeep, 20)
    rect(cx - 12, 8, cx - 8, 9, headShadow, 20)
    rect(cx - 11, 9, cx - 10, 10, headDeep, 20)
    rect(cx + 9, 11, cx + 11, 11, '#111111', 20)
    rect(cx - 8, 9, cx + 3, 9, headDeep, 20)
    rect(cx - 7, 6, cx - 6, 7, headSpec, 20)
    rect(cx + 4, 6, cx + 5, 7, headMid, 20)
    rect(cx + 8, 10, cx + 10, 11, '#121212', 20)
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 25, cx + 10, 28, headColor, 20)
    rect(cx - 9, 24, cx + 9, 26, headHighlight, 20)
    rect(cx + 8, 25, cx + 11, 33, traits.head.color, 20)
    rect(cx + 9, 26, cx + 10, 32, headHighlight, 20)
    rect(cx - 3, 26, cx + 2, 27, clothFold, 20)
    rect(cx - 2, 27, cx + 1, 28, headShadow, 20)
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
    rect(cx + 2, 7, cx + 3, 8, headDeep, 20)
    rect(cx - 6, 8, cx - 6, 9, headDeep, 20)
    rect(cx + 6, 8, cx + 6, 9, headDeep, 20)
    rect(cx - 10, 9, cx - 10, 9, headDeep, 20)
    rect(cx + 9, 9, cx + 10, 9, headDeep, 20)
    rect(cx - 1, 9, cx, 9, headDeep, 20)
    rect(cx + 9, 7, cx + 9, 8, headDeep, 20)
    rect(cx - 11, 7, cx - 11, 8, headDeep, 20)
  }
  accessoryMode = false
  accessoryMaterialType = 'default'
  
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

  // LEGS + FEET
  const footBase = traits.feet?.base || '#FF9F43'
  const footHighlight = traits.feet?.highlight || '#FFBE76'
  const footShadow = traits.feet?.shadow || '#E67E22'
  const legFrontNudge = 0.18
  const legFrontDepth = 18

  const footRect = (x1, y1, x2, y2, color, depth = legFrontDepth, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        placeVoxel(x, y, z, color, depth, false, legFrontNudge, true)
      }
    }
  }
  
  // Left foot
  footRect(11, 37, 14, 38, footBase, 14)
  footRect(10, 38, 15, 38, footBase, 14)
  footRect(12, 36, 13, 37, footHighlight, 14)
  footRect(11, 38, 14, 38, footHighlight, 14)
  footRect(11, 37, 14, 37, footShadow, 14)
  footRect(9, 38, 10, 39, footBase, 14)
  footRect(9, 38, 10, 38, footHighlight, 14)
  footRect(9, 39, 10, 39, footShadow, 14)
  footRect(12, 38, 13, 39, footBase, 14)
  footRect(12, 38, 13, 38, footHighlight, 14)
  footRect(12, 39, 13, 39, footShadow, 14)
  footRect(15, 38, 16, 39, footBase, 14)
  footRect(15, 38, 16, 38, footHighlight, 14)
  footRect(15, 39, 16, 39, footShadow, 14)
  
  // Right foot
  footRect(26, 37, 29, 38, footBase, 14)
  footRect(25, 38, 30, 38, footBase, 14)
  footRect(27, 36, 28, 37, footHighlight, 14)
  footRect(26, 38, 29, 38, footHighlight, 14)
  footRect(26, 37, 29, 37, footShadow, 14)
  footRect(24, 38, 25, 39, footBase, 14)
  footRect(24, 38, 25, 38, footHighlight, 14)
  footRect(24, 39, 25, 39, footShadow, 14)
  footRect(27, 38, 28, 39, footBase, 14)
  footRect(27, 38, 28, 38, footHighlight, 14)
  footRect(27, 39, 28, 39, footShadow, 14)
  footRect(30, 38, 31, 39, footBase, 14)
  footRect(30, 38, 31, 38, footHighlight, 14)
  footRect(30, 39, 31, 39, footShadow, 14)
  
  return group
}
