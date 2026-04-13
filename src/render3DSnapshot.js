import * as THREE from 'three'
import {
  addPenguinSceneLights,
  createBackgroundFx as createThreeGeneratorBackgroundFx,
  createPenguinOrthoCamera,
  createVoxelPenguin as createThreeGeneratorPenguin,
  disposeObject3D,
  getSceneFog as getThreeGeneratorSceneFog,
} from './threeSceneHelpers.js'

const GROUND_LEVEL_Y = -4.85
const PENGUIN_PIVOT_Y = 0.5

function alignObjectToGround(object, groundY) {
  object.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(object)
  if (!Number.isFinite(bounds.min.y)) return
  object.position.y += groundY - bounds.min.y
}

export function render3DSnapshot(traits, options = {}) {
  if (!traits || !traits.background || !traits.body || !traits.beak) {
    console.error('Invalid traits:', traits)
    return null
  }
  const size = Math.max(64, Number(options.size || 400))
  const width = Math.max(64, Number(options.width || size))
  const height = Math.max(64, Number(options.height || size))
  const format = options.format || 'image/png'
  const quality = typeof options.quality === 'number' ? options.quality : 0.82
  const fast = Boolean(options.fast)
  const highQuality = Boolean(options.highQuality)

  const scene = new THREE.Scene()
  const aspect = width / height
  const camera = createPenguinOrthoCamera(THREE, aspect)
  const renderer = new THREE.WebGLRenderer({
    antialias: !fast || highQuality,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: highQuality ? 'high-performance' : 'default',
  })
  let penguinPivot = null
  let backgroundFx = null
  let ground = null

  try {
    scene.background = new THREE.Color(traits.background.color || '#87CEEB')
    scene.fog = getThreeGeneratorSceneFog(traits.background.color)

    renderer.setSize(width, height)
    renderer.setPixelRatio(1)
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace
    if ('toneMapping' in renderer) renderer.toneMapping = THREE.ACESFilmicToneMapping
    if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.06
    renderer.shadowMap.enabled = !fast || highQuality
    if (!fast || highQuality) renderer.shadowMap.type = highQuality ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap

    addPenguinSceneLights(scene, THREE, {
      profile: highQuality ? 'snapshot-hq' : 'snapshot-fast',
      shadowMapSize: highQuality ? 4096 : 1536,
    })

    penguinPivot = new THREE.Group()
    penguinPivot.position.set(0, PENGUIN_PIVOT_Y, 0)
    const penguin = createThreeGeneratorPenguin(traits, THREE)
    if (highQuality) penguin.scale.setScalar(0.92)
    alignObjectToGround(penguin, GROUND_LEVEL_Y - PENGUIN_PIVOT_Y)
    penguinPivot.add(penguin)
    scene.add(penguinPivot)

    const cameraForward = new THREE.Vector3()
    const cameraRight = new THREE.Vector3()
    const cameraUp = new THREE.Vector3()
    camera.getWorldDirection(cameraForward)
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize()

    backgroundFx = createThreeGeneratorBackgroundFx(traits, THREE, {
      particlesOnly: true,
      screenAligned: {
        right: cameraRight,
        up: cameraUp,
        forward: cameraForward,
      },
    })
    scene.add(backgroundFx)

    if (!fast || highQuality) {
      const groundGeo = new THREE.PlaneGeometry(60, 60)
      const groundMat = new THREE.ShadowMaterial({ opacity: highQuality ? 0.16 : 0.35 })
      ground = new THREE.Mesh(groundGeo, groundMat)
      ground.rotation.x = -Math.PI / 2
      ground.position.y = highQuality ? GROUND_LEVEL_Y : -5
      ground.receiveShadow = true
      scene.add(ground)
    }

    renderer.render(scene, camera)
    return renderer.domElement.toDataURL(format, quality)
  } finally {
    if (backgroundFx) {
      scene.remove(backgroundFx)
      disposeObject3D(backgroundFx)
    }
    if (ground) {
      scene.remove(ground)
      disposeObject3D(ground)
    }
    if (penguinPivot) {
      scene.remove(penguinPivot)
      disposeObject3D(penguinPivot)
    }
    renderer.renderLists?.dispose?.()
    renderer.dispose()
  }
}
