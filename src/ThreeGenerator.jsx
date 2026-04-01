import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import SiteNav from './SiteNav.jsx'
import {
  addPenguinSceneLights,
  alignObjectToGround,
  configureRenderer,
  createBackgroundFx,
  createGroundMesh,
  createPenguinOrthoCamera,
  createVoxelPenguin,
  disposeObject3D,
  getSceneFog,
  GROUND_LEVEL_Y,
  ORTHO_FRUSTUM_SIZE,
  PENGUIN_PIVOT_Y,
  PENGUIN_RENDER_SCALE,
  updatePenguinOrthoCamera,
} from './threeSceneHelpers.js'
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

function slugifyFilePart(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildExportFileName({ fromTokenId, traits, extension }) {
  const fileParts = ['8bit-penguin']
  if (fromTokenId) fileParts.push(String(fromTokenId))
  const headTrait = slugifyFilePart(traits.head?.name)
  if (headTrait) fileParts.push(headTrait)
  return `${fileParts.join('-')}.${extension}`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function decodeDataUri(dataUri) {
  const [, base64 = ''] = dataUri.split(',', 2)
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
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
  const backgroundFxRef = useRef(null)
  const groundRef = useRef(null)
  const isDragging = useRef(false)
  const lastMouseX = useRef(0)
  
  useEffect(() => {
    if (!hasGenerated) return
    const container = containerRef.current
    if (!container) return
    setSceneReady(false)
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 2 : 2.5)
    const shadowMapSize = isMobile ? 2048 : 4096
    const getCanvasSize = () => {
      const width = Math.max(container.clientWidth || 420, 320)
      const height = Math.max(container.clientHeight || width, 320)
      const size = Math.min(width, height)
      return { width: size, height: size }
    }
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(traits.background.color)
    scene.fog = getSceneFog(traits.background.color)
    sceneRef.current = scene
    
    // Camera - orthographic preview framing
    const aspect = 1
    const camera = createPenguinOrthoCamera(THREE, aspect)
    cameraRef.current = camera
    
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    const initialSize = getCanvasSize()
    renderer.setSize(initialSize.width, initialSize.height, false)
    configureRenderer(renderer, pixelRatio)
    renderer.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap
    renderer.sortObjects = true
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
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
    
    addPenguinSceneLights(scene, THREE, {
      profile: 'preview',
      shadowMapSize,
    })
    
    // Add penguin pivot for rotation; model is added in traits effect
    const penguinPivot = new THREE.Group()
    penguinPivot.position.set(0, PENGUIN_PIVOT_Y, 0)
    scene.add(penguinPivot)
    penguinRef.current = penguinPivot
    
    const ground = createGroundMesh(traits.background, THREE)
    scene.add(ground)
    groundRef.current = ground

    const backgroundFx = createBackgroundFx(traits.background, THREE)
    scene.add(backgroundFx)
    backgroundFxRef.current = backgroundFx

    const handleResize = () => {
      const nextSize = getCanvasSize()
      renderer.setSize(nextSize.width, nextSize.height, false)
      const frustumAspect = nextSize.width / nextSize.height
      updatePenguinOrthoCamera(camera, frustumAspect)
      renderer.render(scene, camera)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    
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
      window.removeEventListener('resize', handleResize)
      if (controlsRef.current) controlsRef.current.dispose()
      if (backgroundFxRef.current) {
        disposeObject3D(backgroundFxRef.current)
      }
      if (groundRef.current) {
        disposeObject3D(groundRef.current)
      }
      while (penguinRef.current?.children?.length > 0) {
        const child = penguinRef.current.children[0]
        penguinRef.current.remove(child)
        disposeObject3D(child)
      }
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement)
      }
      renderer.dispose()
    }
  }, [hasGenerated, traits.background])

  useEffect(() => {
    if (!hasGenerated || !sceneRef.current || !penguinRef.current) return
    while (penguinRef.current.children.length > 0) {
      const child = penguinRef.current.children[0]
      penguinRef.current.remove(child)
      disposeObject3D(child)
    }
    const newPenguin = createVoxelPenguin(traits, THREE)
    newPenguin.scale.setScalar(PENGUIN_RENDER_SCALE)
    alignObjectToGround(newPenguin, GROUND_LEVEL_Y - PENGUIN_PIVOT_Y)
    penguinRef.current.add(newPenguin)
    sceneRef.current.background = new THREE.Color(traits.background.color)
    sceneRef.current.fog = getSceneFog(traits.background.color)

    if (groundRef.current) {
      sceneRef.current.remove(groundRef.current)
      groundRef.current.geometry?.dispose?.()
      groundRef.current.material?.dispose?.()
    }
    const nextGround = createGroundMesh(traits.background, THREE)
    sceneRef.current.add(nextGround)
    groundRef.current = nextGround

    if (backgroundFxRef.current) {
      sceneRef.current.remove(backgroundFxRef.current)
      disposeObject3D(backgroundFxRef.current)
    }
    const nextBackgroundFx = createBackgroundFx(traits.background, THREE)
    sceneRef.current.add(nextBackgroundFx)
    backgroundFxRef.current = nextBackgroundFx

    requestAnimationFrame(() => setIsGenerating(false))
  }, [traits, hasGenerated])

  useEffect(() => {
    if (sceneReady && isGenerating) setIsGenerating(false)
  }, [sceneReady, isGenerating])
  
  const generate = () => {
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
  }
  
  const saveImage = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
    
    const exportSize = 4096
    const saveRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    saveRenderer.setSize(exportSize, exportSize, false)
    configureRenderer(saveRenderer, 1)
    saveRenderer.shadowMap.type = THREE.PCFSoftShadowMap
    saveRenderer.sortObjects = true

    const exportCamera = cameraRef.current.clone()
    if (exportCamera.isOrthographicCamera) {
      exportCamera.left = -ORTHO_FRUSTUM_SIZE / 2
      exportCamera.right = ORTHO_FRUSTUM_SIZE / 2
      exportCamera.top = ORTHO_FRUSTUM_SIZE / 2
      exportCamera.bottom = -ORTHO_FRUSTUM_SIZE / 2
    }
    exportCamera.updateProjectionMatrix()
    saveRenderer.render(sceneRef.current, exportCamera)
    
    const link = document.createElement('a')
    link.download = '8bit-penguin.png'
    link.href = saveRenderer.domElement.toDataURL('image/png')
    link.click()
    
    saveRenderer.dispose()
  }

  const saveGlb = () => {
    const penguinModel = penguinRef.current?.children?.[0]
    if (!penguinModel) return

    const exportRoot = penguinModel.clone(true)
    exportRoot.updateMatrixWorld(true)

    const exporter = new GLTFExporter()
    exporter.parse(
      exportRoot,
      (result) => {
        if (!(result instanceof ArrayBuffer)) return

        const blob = new Blob([result], { type: 'model/gltf-binary' })
        downloadBlob(blob, buildExportFileName({ fromTokenId, traits, extension: 'glb' }))
      },
      (error) => {
        console.error('GLB export failed', error)
      },
      { binary: true, onlyVisible: true }
    )
  }

  const saveGltf = () => {
    const penguinModel = penguinRef.current?.children?.[0]
    if (!penguinModel) return

    const exportRoot = penguinModel.clone(true)
    exportRoot.updateMatrixWorld(true)

    const exporter = new GLTFExporter()
    exporter.parse(
      exportRoot,
      (result) => {
        if (result instanceof ArrayBuffer) return

        const gltf = structuredClone(result)
        const gltfFileName = buildExportFileName({ fromTokenId, traits, extension: 'gltf' })
        const binFileName = buildExportFileName({ fromTokenId, traits, extension: 'bin' })
        const bufferUri = gltf.buffers?.[0]?.uri

        if (typeof bufferUri === 'string' && bufferUri.startsWith('data:')) {
          const bytes = decodeDataUri(bufferUri)
          gltf.buffers[0].uri = binFileName
          downloadBlob(new Blob([bytes], { type: 'application/octet-stream' }), binFileName)
        }

        const blob = new Blob([JSON.stringify(gltf, null, 2)], { type: 'model/gltf+json' })
        downloadBlob(blob, gltfFileName)
      },
      (error) => {
        console.error('GLTF export failed', error)
      },
      { binary: false, onlyVisible: true }
    )
  }

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
      <SiteNav label={fromTokenId ? `3D #${fromTokenId}${fromName ? ` · ${fromName}` : ''}` : '3D Voxel'} />

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
              aria-busy={isGenerating}
            >
              {isGenerating ? 'Generating' : 'Generate 3D'}
            </button>
            <button 
              className="btn white" 
              onClick={saveImage}
              disabled={!hasGenerated}
            >
              Save Image
            </button>
            <button
              className="btn white"
              onClick={saveGlb}
              disabled={!hasGenerated}
            >
              Save GLB
            </button>
            <button
              className="btn white"
              onClick={saveGltf}
              disabled={!hasGenerated}
            >
              Save glTF
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
