const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUTPUT_THUMBNAILS = 'preview/thumbnails';
const METADATA_DIR = 'preview/metadata';

if (!fs.existsSync(OUTPUT_THUMBNAILS)) {
  fs.mkdirSync(OUTPUT_THUMBNAILS, { recursive: true });
}

const rect = (ctx, x1, y1, x2, y2, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
};

function render3DThumbnail(traits, canvas) {
  const ctx = canvas.getContext('2d');
  const scale = 46;
  canvas.width = 2048;
  canvas.height = 2048;
  
  const bgColor = traits.background.color;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(1024, 1500, 500, 150, 0, 0, Math.PI * 2);
  ctx.fill();
  
  const offsetX = 2;
  const offsetY = 1;
  const cx = 20;
  
  const set = (x, y, color) => {
    if (x >= 0 && x < 40 && y >= 0 && y < 40) {
      ctx.fillStyle = color;
      ctx.fillRect((x + offsetX) * scale, (y + offsetY) * scale, scale, scale);
      
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect((x + offsetX) * scale + scale - 4, (y + offsetY) * scale, 4, scale);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect((x + offsetX) * scale, (y + offsetY) * scale, 4, scale);
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
  const feet = traits.feet?.base || '#FF9F43';
  const feetHighlight = traits.feet?.highlight || '#FFBE76';
  const feetShadow = traits.feet?.shadow || '#E67E22';
  
  const bodyRect = (x1, y1, x2, y2, color) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) set(x, y, color);
    }
  };
  
  bodyRect(8, 25, 31, 38, body);
  bodyRect(7, 26, 32, 37, body);
  bodyRect(6, 27, 33, 36, body);
  bodyRect(6, 28, 33, 35, body);
  bodyRect(7, 29, 32, 34, body);
  bodyRect(8, 30, 31, 33, body);
  bodyRect(9, 31, 30, 32, body);
  bodyRect(10, 32, 29, 32, body);
  
  bodyRect(10, 26, 29, 27, bodyHighlight);
  bodyRect(9, 28, 30, 28, bodyHighlight);
  bodyRect(10, 30, 29, 30, bodyHighlight);
  bodyRect(11, 32, 28, 32, bodyHighlight);
  
  bodyRect(8, 38, 31, 38, bodyShadow);
  bodyRect(7, 37, 32, 37, bodyShadow);
  bodyRect(6, 36, 33, 36, bodyShadow);
  
  bodyRect(12, 27, 12, 27, bodyShadow);
  bodyRect(28, 27, 28, 27, bodyShadow);
  bodyRect(10, 29, 10, 29, bodyShadow);
  bodyRect(30, 29, 30, 29, bodyShadow);
  bodyRect(8, 31, 8, 31, bodyShadow);
  bodyRect(32, 31, 32, 31, bodyShadow);
  
  bodyRect(12, 28, 27, 38, belly);
  bodyRect(11, 29, 28, 37, belly);
  bodyRect(11, 30, 28, 36, belly);
  bodyRect(12, 31, 27, 35, belly);
  bodyRect(13, 32, 26, 34, belly);
  bodyRect(14, 33, 25, 34, belly);
  bodyRect(15, 34, 24, 35, belly);
  
  bodyRect(14, 29, 25, 30, bellyHighlight);
  bodyRect(14, 31, 25, 32, bellyHighlight);
  bodyRect(15, 33, 24, 34, bellyHighlight);
  
  bodyRect(15, 35, 15, 35, bellyHighlight);
  bodyRect(24, 35, 24, 35, bellyHighlight);
  bodyRect(16, 36, 16, 36, bellyHighlight);
  bodyRect(23, 36, 23, 36, bellyHighlight);
  
  bodyRect(10, 8, 29, 26, body);
  bodyRect(9, 9, 30, 25, body);
  bodyRect(8, 10, 31, 24, body);
  bodyRect(8, 11, 31, 23, body);
  bodyRect(9, 12, 30, 22, body);
  bodyRect(10, 13, 29, 21, body);
  bodyRect(11, 14, 28, 20, body);
  bodyRect(12, 15, 27, 19, body);
  bodyRect(13, 16, 26, 18, body);
  bodyRect(14, 17, 25, 18, body);
  
  bodyRect(12, 9, 27, 10, bodyHighlight);
  bodyRect(11, 11, 28, 12, bodyHighlight);
  bodyRect(12, 13, 27, 14, bodyHighlight);
  bodyRect(13, 15, 26, 16, bodyHighlight);
  bodyRect(14, 17, 25, 17, bodyHighlight);
  
  bodyRect(10, 26, 29, 26, bodyShadow);
  bodyRect(9, 25, 30, 25, bodyShadow);
  bodyRect(8, 24, 31, 24, bodyShadow);
  
  bodyRect(11, 10, 11, 10, bodyShadow);
  bodyRect(28, 10, 28, 10, bodyShadow);
  bodyRect(10, 12, 10, 12, bodyShadow);
  bodyRect(29, 12, 29, 12, bodyShadow);
  bodyRect(10, 14, 10, 14, bodyShadow);
  bodyRect(29, 14, 29, 14, bodyShadow);
  
  bodyRect(12, 14, 27, 24, belly);
  bodyRect(11, 15, 28, 23, belly);
  bodyRect(12, 16, 27, 22, belly);
  bodyRect(13, 17, 26, 21, belly);
  bodyRect(14, 18, 25, 20, belly);
  bodyRect(15, 19, 24, 20, belly);
  
  bodyRect(14, 15, 25, 16, bellyHighlight);
  bodyRect(14, 17, 25, 18, bellyHighlight);
  bodyRect(15, 19, 24, 20, bellyHighlight);
  
  const eyeY = 17;
  
  if (traits.eyes.type === 'round') {
    bodyRect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF');
    bodyRect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF');
    bodyRect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF');
    bodyRect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#FFFFFF');
  } else if (traits.eyes.type === 'happy') {
    bodyRect(cx - 6, eyeY, cx - 2, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 2, eyeY, cx + 6, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A');
  } else if (traits.eyes.type === 'sad') {
    bodyRect(cx - 5, eyeY, cx - 3, eyeY + 1, '#0A0A0A');
    bodyRect(cx - 6, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A');
    bodyRect(cx + 3, eyeY, cx + 5, eyeY + 1, '#0A0A0A');
    bodyRect(cx + 2, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A');
  } else if (traits.eyes.type === 'angry') {
    bodyRect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 4, eyeY, cx - 3, eyeY, '#FF0000');
    bodyRect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 4, eyeY, cx + 5, eyeY, '#FF0000');
  } else if (traits.eyes.type === 'sleepy') {
    bodyRect(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A');
  } else if (traits.eyes.type === 'surprised') {
    bodyRect(cx - 6, eyeY - 1, cx - 2, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 5, eyeY - 1, cx - 3, eyeY + 2, '#FFFFFF');
    bodyRect(cx - 5, eyeY, cx - 4, eyeY + 1, '#0A0A0A');
    bodyRect(cx + 2, eyeY - 1, cx + 6, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 3, eyeY - 1, cx + 5, eyeY + 2, '#FFFFFF');
    bodyRect(cx + 4, eyeY, cx + 5, eyeY + 1, '#0A0A0A');
  } else if (traits.eyes.type === 'wink') {
    bodyRect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF');
    bodyRect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF');
    bodyRect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A');
  } else if (traits.eyes.type === 'sideeye') {
    bodyRect(cx - 6, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 5, eyeY + 1, cx - 4, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 3, eyeY, cx + 6, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 4, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A');
  } else if (traits.eyes.type === 'closed') {
    bodyRect(cx - 6, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A');
    bodyRect(cx + 2, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A');
  } else if (traits.eyes.type === 'sparkle') {
    bodyRect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    bodyRect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF');
    bodyRect(cx - 3, eyeY + 2, cx - 3, eyeY + 2, '#FFFFFF');
    bodyRect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A');
    bodyRect(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF');
    bodyRect(cx + 5, eyeY + 2, cx + 5, eyeY + 2, '#FFFFFF');
  }
  
  if (traits.eyes.type !== 'sleepy' && traits.eyes.type !== 'closed' && traits.eyes.type !== 'angry') {
    bodyRect(cx - 7, 14, cx - 3, 14, bodyShadow);
    bodyRect(cx + 3, 14, cx + 7, 14, bodyShadow);
    bodyRect(cx - 8, 13, cx - 4, 13, bodyShadow);
    bodyRect(cx + 4, 13, cx + 8, 13, bodyShadow);
  }
  
  if (traits.beak.type === 'small') {
    bodyRect(cx - 2, 21, cx + 1, 23, beak);
    bodyRect(cx - 1, 20, cx, 22, beak);
    bodyRect(cx - 1, 22, cx, 22, beakShadow);
  } else if (traits.beak.type === 'large') {
    bodyRect(cx - 4, 20, cx + 3, 24, beak);
    bodyRect(cx - 3, 19, cx + 2, 23, beak);
    bodyRect(cx - 2, 19, cx + 1, 20, beak);
    bodyRect(cx - 3, 24, cx + 2, 24, beakShadow);
  } else if (traits.beak.type === 'wide') {
    bodyRect(cx - 4, 21, cx + 3, 23, beak);
    bodyRect(cx - 3, 20, cx + 2, 24, beak);
    bodyRect(cx - 2, 20, cx + 1, 20, beak);
    bodyRect(cx - 2, 24, cx + 1, 24, beakShadow);
  } else if (traits.beak.type === 'pointy') {
    bodyRect(cx - 2, 21, cx + 1, 23, beak);
    bodyRect(cx - 1, 19, cx, 22, beak);
    bodyRect(cx, 18, cx, 20, beak);
    bodyRect(cx - 1, 23, cx, 23, beakShadow);
  } else if (traits.beak.type === 'round') {
    bodyRect(cx - 3, 21, cx + 2, 23, beak);
    bodyRect(cx - 2, 20, cx + 1, 24, beak);
    bodyRect(cx - 1, 20, cx, 20, beak);
    bodyRect(cx - 2, 24, cx + 1, 24, beakShadow);
  } else if (traits.beak.type === 'puffy') {
    bodyRect(cx - 4, 20, cx + 3, 23, beak);
    bodyRect(cx - 3, 19, cx + 2, 22, beakHighlight);
    bodyRect(cx - 2, 18, cx + 1, 20, beakHighlight);
    bodyRect(cx - 3, 23, cx + 2, 23, beakShadow);
    bodyRect(cx + 2, 22, cx + 3, 22, beakShadow);
  } else {
    bodyRect(cx - 3, 21, cx + 2, 23, beak);
    bodyRect(cx - 2, 20, cx + 1, 22, beak);
    bodyRect(cx - 1, 20, cx, 21, beak);
    bodyRect(cx - 2, 22, cx + 1, 22, beakShadow);
    bodyRect(cx - 3, 21, cx - 3, 22, beakShadow);
  }
  
  const cheeksColor = traits.cheeks?.base || '#FFB6C1';
  const cheeksHighlightColor = traits.cheeks?.highlight || '#FFC5CD';
  bodyRect(cx - 9, 19, cx - 7, 21, cheeksColor);
  bodyRect(cx + 7, 19, cx + 9, 21, cheeksColor);
  bodyRect(cx - 8, 20, cx - 7, 20, cheeksHighlightColor);
  bodyRect(cx + 7, 20, cx + 8, 20, cheeksHighlightColor);
  
  if (traits.head.type === 'crown') {
    bodyRect(cx - 9, 6, cx + 9, 8, '#FFD700');
    bodyRect(cx - 8, 4, cx - 6, 8, '#FFD700');
    bodyRect(cx - 3, 2, cx - 1, 8, '#FFD700');
    bodyRect(cx + 1, 2, cx + 3, 8, '#FFD700');
    bodyRect(cx + 6, 4, cx + 8, 8, '#FFD700');
    bodyRect(cx - 4, 5, cx - 2, 6, '#FF0000');
    bodyRect(cx + 2, 5, cx + 4, 6, '#FF0000');
  } else if (traits.head.type === 'tophat') {
    bodyRect(cx - 10, 6, cx + 10, 9, '#1A1A1A');
    bodyRect(cx - 9, 5, cx + 9, 7, '#2D2D2D');
    bodyRect(cx - 4, 2, cx + 3, 6, '#1A1A1A');
    bodyRect(cx - 11, 8, cx + 11, 9, '#8B0000');
    bodyRect(cx - 2, 3, cx + 1, 4, '#C0C0C0');
  } else if (traits.head.type === 'beanie') {
    bodyRect(cx - 10, 6, cx + 10, 9, traits.head.color);
    bodyRect(cx - 9, 4, cx + 9, 7, traits.head.highlight);
    bodyRect(cx - 8, 3, cx + 8, 5, traits.head.highlight);
    bodyRect(cx - 3, 2, cx + 2, 4, traits.head.shadow);
    bodyRect(cx - 2, 1, cx + 1, 3, traits.head.shadow);
  } else if (traits.head.type === 'bow') {
    bodyRect(cx - 10, 7, cx - 7, 9, '#FF69B4');
    bodyRect(cx + 7, 7, cx + 10, 9, '#FF69B4');
    bodyRect(cx - 6, 7, cx + 6, 9, '#FF1493');
    bodyRect(cx - 8, 6, cx - 6, 8, '#FFB6C1');
    bodyRect(cx + 6, 6, cx + 8, 8, '#FFB6C1');
    bodyRect(cx - 2, 8, cx + 1, 8, '#FF1493');
  } else if (traits.head.type === 'cap') {
    bodyRect(cx - 10, 7, cx + 9, 9, traits.head.color);
    bodyRect(cx - 9, 6, cx + 8, 8, traits.head.highlight);
    bodyRect(cx + 8, 8, cx + 12, 10, traits.head.shadow);
    bodyRect(cx + 10, 9, cx + 12, 10, traits.head.shadow);
    bodyRect(cx - 11, 8, cx - 9, 9, traits.head.shadow);
  } else if (traits.head.type === 'scarf') {
    bodyRect(cx - 10, 25, cx + 10, 28, traits.head.color);
    bodyRect(cx - 9, 24, cx + 9, 26, traits.head.highlight);
    bodyRect(cx + 8, 25, cx + 11, 33, traits.head.color);
    bodyRect(cx + 9, 26, cx + 10, 32, traits.head.highlight);
    bodyRect(cx - 2, 26, cx + 1, 27, traits.head.shadow);
  } else if (traits.head.type === 'halo') {
    bodyRect(cx - 4, 3, cx + 3, 4, '#FFD700');
    bodyRect(cx - 5, 4, cx + 4, 5, '#FFD700');
    bodyRect(cx - 3, 2, cx + 2, 3, '#FFD700');
  } else if (traits.head.type === 'headband') {
    bodyRect(cx - 10, 6, cx + 10, 9, traits.head.color);
    bodyRect(cx - 9, 5, cx + 9, 7, traits.head.highlight);
    bodyRect(cx - 7, 5, cx - 5, 8, traits.head.highlight);
    bodyRect(cx - 1, 5, cx + 1, 8, traits.head.highlight);
    bodyRect(cx + 5, 5, cx + 7, 8, traits.head.highlight);
  }
  
  bodyRect(2, 26, 5, 32, body);
  bodyRect(1, 27, 6, 31, body);
  bodyRect(2, 28, 5, 30, bodyHighlight);
  bodyRect(3, 29, 5, 29, bodyHighlight);
  bodyRect(2, 30, 4, 31, bodyShadow);
  bodyRect(1, 31, 3, 32, bodyShadow);
  bodyRect(1, 30, 3, 33, body);
  bodyRect(2, 31, 3, 32, bodyHighlight);
  bodyRect(5, 31, 7, 33, body);
  bodyRect(6, 32, 7, 33, bodyHighlight);
  
  bodyRect(34, 26, 37, 32, body);
  bodyRect(33, 27, 38, 31, body);
  bodyRect(34, 28, 37, 30, bodyHighlight);
  bodyRect(34, 29, 36, 29, bodyHighlight);
  bodyRect(35, 30, 37, 31, bodyShadow);
  bodyRect(36, 31, 38, 32, bodyShadow);
  bodyRect(36, 30, 38, 33, body);
  bodyRect(36, 31, 37, 32, bodyHighlight);
  bodyRect(32, 31, 34, 33, body);
  bodyRect(32, 32, 33, 33, bodyHighlight);
  
  bodyRect(10, 37, 14, 38, feet);
  bodyRect(9, 38, 15, 38, feet);
  bodyRect(11, 36, 13, 37, feetHighlight);
  bodyRect(10, 38, 13, 38, feetShadow);
  bodyRect(8, 38, 10, 39, feet);
  bodyRect(9, 38, 10, 39, feetHighlight);
  bodyRect(12, 38, 14, 39, feet);
  bodyRect(13, 38, 14, 39, feetHighlight);
  
  bodyRect(25, 37, 29, 38, feet);
  bodyRect(24, 38, 30, 38, feet);
  bodyRect(26, 36, 28, 37, feetHighlight);
  bodyRect(25, 38, 28, 38, feetShadow);
  bodyRect(25, 38, 27, 39, feet);
  bodyRect(26, 38, 27, 39, feetHighlight);
  bodyRect(29, 39, 31, 39, feet);
  bodyRect(30, 39, 31, 39, feetHighlight);
}

console.log('=== Generating 3D Thumbnails (Pseudo-3D with depth effects) ===\n');

const files = fs.readdirSync(METADATA_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const id = file.replace('.json', '');
  const metadataPath = path.join(METADATA_DIR, file);
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  
  console.log(`Generating thumbnail for ${id}...`);
  
  const canvas = createCanvas(2048, 2048);
  render3DThumbnail(metadata, canvas);
  
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(OUTPUT_THUMBNAILS, `${id}.png`);
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`Generated ${id}.png - ${metadata.name} | ${metadata.body.name} | ${metadata.eyes.name} | ${metadata.head.name}`);
}

console.log('\n=== 3D Thumbnail Generation Complete ===');
