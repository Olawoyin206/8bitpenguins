const fs = require('fs');
const path = require('path');
const gl = require('gl');
const THREE = require('three');

const OUTPUT_THUMBNAILS = 'preview/thumbnails';
const METADATA_DIR = 'preview/metadata';

if (!fs.existsSync(OUTPUT_THUMBNAILS)) {
  fs.mkdirSync(OUTPUT_THUMBNAILS, { recursive: true });
}

function getVoxelPos(x, y, z, cx = 20) {
  const voxelSize = 0.55;
  return {
    x: (x - cx) * voxelSize * 0.5,
    y: (20 - y) * voxelSize * 0.5,
    z: (z - 1) * voxelSize * 0.4
  };
}

function createVoxelPenguin(traits, scene) {
  const cx = 20;
  const voxelSize = 0.55;
  const voxelScale = 0.15;
  
  const mat = (color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });
  
  const { RoundedBoxGeometry } = require('three/addons/geometries/RoundedBoxGeometry.js');
  
  const rect = (x1, y1, x2, y2, color, depth = 4, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const pos = getVoxelPos(x, y, z, cx);
        const geo = new RoundedBoxGeometry(voxelSize, voxelSize, depth * voxelScale, 2, 0.05);
        const mesh = new THREE.Mesh(geo, mat(color));
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    }
  };
  
  const rectFront = (x1, y1, x2, y2, color, depth = 4, z = 1) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const pos = getVoxelPos(x, y, z, cx);
        const geo = new RoundedBoxGeometry(voxelSize, voxelSize, depth * voxelScale, 2, 0.05);
        const mesh = new THREE.Mesh(geo, mat(color));
        mesh.position.set(pos.x, pos.y, pos.z + (depth * voxelScale * 0.5) + 0.08);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    }
  };
  
  const body = traits.body.base;
  const bodyHighlight = traits.body.highlight;
  const bodyShadow = traits.body.shadow;
  const belly = traits.belly.base;
  const bellyHighlight = traits.belly.highlight;
  const beak = traits.beak.base;
  const beakHighlight = traits.beak.highlight;
  const beakShadow = traits.beak.shadow;
  
  // Body
  rect(10, 25, 29, 38, body, 12);
  rect(9, 26, 30, 37, body, 12);
  rect(8, 27, 31, 36, body, 12);
  rect(8, 28, 31, 35, body, 12);
  rect(9, 29, 30, 34, body, 12);
  rect(10, 30, 29, 33, body, 12);
  rect(11, 31, 28, 32, body, 12);
  rect(12, 26, 27, 27, bodyHighlight, 12);
  rect(11, 28, 28, 28, bodyHighlight, 12);
  rect(12, 30, 27, 30, bodyHighlight, 12);
  rect(13, 32, 26, 32, bodyHighlight, 12);
  rect(10, 38, 29, 38, bodyShadow, 12);
  rect(9, 37, 30, 37, bodyShadow, 12);
  rect(8, 36, 31, 36, bodyShadow, 12);
  
  // Belly
  rectFront(12, 26, 27, 36, belly, 6);
  rectFront(11, 27, 28, 35, belly, 6);
  rectFront(11, 28, 28, 34, belly, 6);
  rectFront(12, 29, 27, 33, belly, 6);
  rectFront(13, 30, 26, 32, belly, 6);
  rectFront(14, 31, 25, 32, belly, 6);
  rectFront(15, 32, 24, 33, belly, 6);
  rectFront(14, 27, 25, 28, bellyHighlight, 6);
  rectFront(14, 29, 25, 30, bellyHighlight, 6);
  rectFront(15, 31, 24, 32, bellyHighlight, 6);
  
  // Head
  rect(10, 8, 29, 26, body, 20);
  rect(9, 9, 30, 25, body, 20);
  rect(8, 10, 31, 24, body, 20);
  rect(8, 11, 31, 23, body, 20);
  rect(9, 12, 30, 22, body, 20);
  rect(10, 13, 29, 21, body, 20);
  rect(11, 14, 28, 20, body, 20);
  rect(12, 15, 27, 19, body, 20);
  rect(13, 16, 26, 18, body, 20);
  rect(14, 17, 25, 18, body, 20);
  rect(12, 9, 27, 10, bodyHighlight, 20);
  rect(11, 11, 28, 12, bodyHighlight, 20);
  rect(12, 13, 27, 14, bodyHighlight, 20);
  rect(13, 15, 26, 16, bodyHighlight, 20);
  rect(14, 17, 25, 17, bodyHighlight, 20);
  rect(10, 26, 29, 26, bodyShadow, 20);
  rect(9, 25, 30, 25, bodyShadow, 20);
  rect(8, 24, 31, 24, bodyShadow, 20);
  
  // Face
  rectFront(12, 14, 27, 24, belly, 11);
  rectFront(11, 15, 28, 23, belly, 11);
  rectFront(12, 16, 27, 22, belly, 11);
  rectFront(13, 17, 26, 21, belly, 11);
  rectFront(14, 18, 25, 20, belly, 11);
  rectFront(15, 19, 24, 20, belly, 11);
  rectFront(14, 15, 25, 16, bellyHighlight, 11);
  rectFront(14, 17, 25, 18, bellyHighlight, 11);
  rectFront(15, 19, 24, 20, bellyHighlight, 11);
  
  const eyeY = 17;
  
  if (traits.eyes.type === 'round') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF', 12);
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF', 12);
    rectFront(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF', 12);
    rectFront(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#FFFFFF', 12);
  } else if (traits.eyes.type === 'happy') {
    rectFront(cx - 6, eyeY, cx - 2, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 2, eyeY, cx + 6, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A', 12);
  } else if (traits.eyes.type === 'sad') {
    rectFront(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 4, eyeY + 2, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 4, eyeY + 2, cx + 5, eyeY + 2, '#0A0A0A', 12);
  } else if (traits.eyes.type === 'angry') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 4, eyeY, cx - 3, eyeY, '#FF0000', 12);
    rectFront(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 4, eyeY, cx + 5, eyeY, '#FF0000', 12);
  } else if (traits.eyes.type === 'sleepy') {
    rectFront(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A', 12);
  } else if (traits.eyes.type === 'surprised') {
    rectFront(cx - 5, eyeY - 1, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 6, eyeY, cx - 2, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 5, eyeY - 1, cx - 4, eyeY - 1, '#FFFFFF', 12);
    rectFront(cx - 4, eyeY, cx - 3, eyeY, '#FFFFFF', 12);
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF', 12);
    rectFront(cx + 3, eyeY - 1, cx + 5, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 2, eyeY, cx + 6, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 4, eyeY - 1, cx + 5, eyeY - 1, '#FFFFFF', 12);
    rectFront(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF', 12);
    rectFront(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#FFFFFF', 12);
  } else if (traits.eyes.type === 'wink') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF', 12);
    rectFront(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF', 12);
    rectFront(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A', 12);
  } else if (traits.eyes.type === 'sideeye') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 6, eyeY + 1, cx - 4, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 3, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12);
    rectFront(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 4, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A', 12);
  } else if (traits.eyes.type === 'closed') {
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A', 12);
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A', 12);
  } else if (traits.eyes.type === 'sparkle') {
    rectFront(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF', 12);
    rectFront(cx - 3, eyeY + 2, cx - 3, eyeY + 2, '#FFFFFF', 12);
    rectFront(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A', 12);
    rectFront(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF', 12);
    rectFront(cx + 5, eyeY + 2, cx + 5, eyeY + 2, '#FFFFFF', 12);
  }
  
  if (traits.eyes.type !== 'sleepy' && traits.eyes.type !== 'closed' && traits.eyes.type !== 'angry') {
    rectFront(cx - 7, 14, cx - 3, 14, bodyShadow, 11);
    rectFront(cx + 3, 14, cx + 7, 14, bodyShadow, 11);
    rectFront(cx - 8, 13, cx - 4, 13, bodyShadow, 11);
    rectFront(cx + 4, 13, cx + 8, 13, bodyShadow, 11);
  }
  
  // Beak
  if (traits.beak.type === 'small') {
    rectFront(cx - 2, 21, cx + 1, 23, beak, 14);
    rectFront(cx - 1, 20, cx, 22, beak, 14);
    rectFront(cx - 1, 22, cx, 22, beakShadow, 14);
  } else if (traits.beak.type === 'large') {
    rectFront(cx - 4, 20, cx + 3, 24, beak, 14);
    rectFront(cx - 3, 19, cx + 2, 23, beak, 14);
    rectFront(cx - 2, 19, cx + 1, 20, beak, 14);
    rectFront(cx - 3, 24, cx + 2, 24, beakShadow, 14);
  } else if (traits.beak.type === 'wide') {
    rectFront(cx - 4, 21, cx + 3, 23, beak, 14);
    rectFront(cx - 3, 20, cx + 2, 24, beak, 14);
    rectFront(cx - 2, 20, cx + 1, 20, beak, 14);
    rectFront(cx - 2, 24, cx + 1, 24, beakShadow, 14);
  } else if (traits.beak.type === 'pointy') {
    rectFront(cx - 2, 21, cx + 1, 23, beak, 14);
    rectFront(cx - 1, 19, cx, 22, beak, 14);
    rectFront(cx, 18, cx, 20, beak, 14);
    rectFront(cx - 1, 23, cx, 23, beakShadow, 14);
  } else if (traits.beak.type === 'round') {
    rectFront(cx - 3, 21, cx + 2, 23, beak, 14);
    rectFront(cx - 2, 20, cx + 1, 24, beak, 14);
    rectFront(cx - 1, 20, cx, 20, beak, 14);
    rectFront(cx - 2, 24, cx + 1, 24, beakShadow, 14);
  } else if (traits.beak.type === 'puffy') {
    rectFront(cx - 4, 20, cx + 3, 23, beak, 14);
    rectFront(cx - 3, 19, cx + 2, 22, beakHighlight, 14);
    rectFront(cx - 2, 18, cx + 1, 20, beakHighlight, 14);
    rectFront(cx - 3, 23, cx + 2, 23, beakShadow, 14);
    rectFront(cx + 2, 22, cx + 3, 22, beakShadow, 14);
  } else {
    rectFront(cx - 3, 21, cx + 2, 23, beak, 14);
    rectFront(cx - 2, 20, cx + 1, 22, beak, 14);
    rectFront(cx - 1, 20, cx, 21, beak, 14);
    rectFront(cx - 2, 22, cx + 1, 22, beakShadow, 14);
    rectFront(cx - 3, 21, cx - 3, 22, beakShadow, 14);
  }
  
  // Cheeks
  rectFront(cx - 9, 19, cx - 7, 21, '#FFB6C1', 11);
  rectFront(cx + 7, 19, cx + 9, 21, '#FFB6C1', 11);
  rectFront(cx - 8, 20, cx - 7, 20, '#FFC5CD', 11);
  rectFront(cx + 7, 20, cx + 8, 20, '#FFC5CD', 11);
  
  // Head accessories
  if (traits.head.type === 'crown') {
    rect(cx - 9, 6, cx + 9, 8, '#FFD700', 20);
    rect(cx - 8, 4, cx - 6, 8, '#FFD700', 20);
    rect(cx - 3, 2, cx - 1, 8, '#FFD700', 20);
    rect(cx + 1, 2, cx + 3, 8, '#FFD700', 20);
    rect(cx + 6, 4, cx + 8, 8, '#FFD700', 20);
    rect(cx - 4, 5, cx - 2, 6, '#FF0000', 20);
    rect(cx + 2, 5, cx + 4, 6, '#FF0000', 20);
  } else if (traits.head.type === 'beanie') {
    rect(cx - 10, 6, cx + 10, 9, traits.head.color, 20);
    rect(cx - 9, 4, cx + 9, 7, traits.head.highlight, 20);
    rect(cx - 8, 3, cx + 8, 5, traits.head.highlight, 20);
    rect(cx - 3, 2, cx + 2, 4, traits.head.shadow, 20);
    rect(cx - 2, 1, cx + 1, 3, traits.head.shadow, 20);
  } else if (traits.head.type === 'cap') {
    rect(cx - 10, 7, cx + 9, 9, traits.head.color, 20);
    rect(cx - 9, 6, cx + 8, 8, traits.head.highlight, 20);
    rect(cx + 8, 8, cx + 12, 10, traits.head.shadow, 20);
    rect(cx + 10, 9, cx + 12, 10, traits.head.shadow, 20);
    rect(cx - 11, 8, cx - 9, 9, traits.head.shadow, 20);
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 25, cx + 10, 28, traits.head.color, 20);
    rect(cx - 9, 24, cx + 9, 26, traits.head.highlight, 20);
    rect(cx + 8, 25, cx + 11, 33, traits.head.color, 20);
    rect(cx + 9, 26, cx + 10, 32, traits.head.highlight, 20);
    rect(cx - 2, 26, cx + 1, 27, traits.head.shadow, 20);
  } else if (traits.head.type === 'halo') {
    rect(cx - 4, 3, cx + 3, 4, '#FFD700', 20);
    rect(cx - 5, 4, cx + 4, 5, '#FFD700', 20);
    rect(cx - 3, 2, cx + 2, 3, '#FFD700', 20);
  } else if (traits.head.type === 'headband') {
    rect(cx - 10, 6, cx + 10, 9, traits.head.color, 20);
    rect(cx - 9, 5, cx + 9, 7, traits.head.highlight, 20);
    rect(cx - 7, 5, cx - 5, 8, traits.head.highlight, 20);
    rect(cx - 1, 5, cx + 1, 8, traits.head.highlight, 20);
    rect(cx + 5, 5, cx + 7, 8, traits.head.highlight, 20);
  }
  
  // Flippers
  rect(2, 26, 5, 32, body, 4);
  rect(1, 27, 6, 31, body, 4);
  rect(2, 28, 5, 30, bodyHighlight, 4);
  rect(3, 29, 5, 29, bodyHighlight, 4);
  rect(2, 30, 4, 31, bodyShadow, 4);
  rect(1, 31, 3, 32, bodyShadow, 4);
  rect(1, 30, 3, 33, body, 4);
  rect(2, 31, 3, 32, bodyHighlight, 4);
  rect(5, 31, 7, 33, body, 4);
  rect(6, 32, 7, 33, bodyHighlight, 4);
  
  rect(34, 26, 37, 32, body, 4);
  rect(33, 27, 38, 31, body, 4);
  rect(34, 28, 37, 30, bodyHighlight, 4);
  rect(34, 29, 36, 29, bodyHighlight, 4);
  rect(35, 30, 37, 31, bodyShadow, 4);
  rect(36, 31, 38, 32, bodyShadow, 4);
  rect(36, 30, 38, 33, body, 4);
  rect(36, 31, 37, 32, bodyHighlight, 4);
  rect(32, 31, 34, 33, body, 4);
  rect(32, 32, 33, 33, bodyHighlight, 4);
  
  // Feet
  const footBase = traits.feet?.base || '#FF9F43';
  const footHighlight = traits.feet?.highlight || '#FFBE76';
  const footShadow = traits.feet?.shadow || '#E67E22';
  
  rect(10, 37, 15, 38, footBase, 14);
  rect(9, 38, 16, 38, footBase, 14);
  rect(11, 36, 13, 37, footHighlight, 14);
  rect(10, 38, 15, 38, footHighlight, 14);
  rect(10, 37, 15, 37, footShadow, 14);
  
  rect(25, 37, 30, 38, footBase, 14);
  rect(24, 38, 31, 38, footBase, 14);
  rect(26, 36, 28, 37, footHighlight, 14);
  rect(25, 38, 30, 38, footHighlight, 14);
  rect(25, 37, 30, 37, footShadow, 14);
}

function renderScene(traits, width, height) {
  const glContext = gl(width, height, {
    preserveDrawingBuffer: true,
    antialias: true
  });
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(traits.background.color);
  
  const aspect = 1;
  const frustumSize = 13;
  const camera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    1000
  );
  camera.position.set(8, 6, 12);
  camera.lookAt(0, 0, 0);
  
  const renderer = new THREE.WebGLRenderer({
    gl: glContext,
    antialias: true,
    alpha: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.4);
  scene.add(hemiLight);
  
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(5, 10, 15);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 60;
  keyLight.shadow.camera.left = -15;
  keyLight.shadow.camera.right = 15;
  keyLight.shadow.camera.top = 15;
  keyLight.shadow.camera.bottom = -15;
  keyLight.shadow.radius = 1;
  keyLight.shadow.bias = -0.001;
  scene.add(keyLight);
  
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
  fillLight.position.set(8, 8, 5);
  scene.add(fillLight);
  
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
  rimLight.position.set(0, 5, -15);
  scene.add(rimLight);
  
  createVoxelPenguin(traits, scene);
  
  const groundGeo = new THREE.PlaneGeometry(60, 60);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -4.5;
  ground.receiveShadow = true;
  scene.add(ground);
  
  renderer.render(scene, camera);
  
  const pixels = new Uint8Array(width * height * 4);
  glContext.readPixels(0, 0, width, height, glContext.RGBA, glContext.UNSIGNED_BYTE, pixels);
  
  return { pixels, width, height };
}

function pixelsToPng(pixels, width, height) {
  const { createCanvas, loadImage } = require('canvas');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  const imageData = ctx.createImageData(width, height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - y - 1) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = pixels[srcIdx];
      imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
      imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
      imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

console.log('=== Generating 3D Thumbnails (headless-gl) ===\n');

const files = fs.readdirSync(METADATA_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const id = file.replace('.json', '');
  const metadataPath = path.join(METADATA_DIR, file);
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  
  console.log(`Generating thumbnail for ${id}...`);
  
  try {
    const { pixels, width, height } = renderScene(metadata, 2048, 2048);
    const pngBuffer = pixelsToPng(pixels, width, height);
    
    const outputPath = path.join(OUTPUT_THUMBNAILS, `${id}.png`);
    fs.writeFileSync(outputPath, pngBuffer);
    
    console.log(`Generated ${id}.png - ${metadata.name} | ${metadata.body.name} | ${metadata.eyes.name} | ${metadata.head.name}`);
  } catch (err) {
    console.error(`Error generating ${id}:`, err.message);
  }
}

console.log('\n=== 3D Thumbnail Generation Complete ===');
