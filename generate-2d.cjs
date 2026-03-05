const fs = require('fs');
const { createCanvas } = require('canvas');

const OUTPUT_2D = 'preview/2d';
const OUTPUT_METADATA = 'preview/metadata';

[OUTPUT_2D, OUTPUT_METADATA].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
    { name: 'Scarf Blue', type: 'scarf', color: '#1565C0', highlight: '#1976F2', shadow: '#0D47A1', weight: 5 },
    { name: 'Scarf Purple', type: 'scarf', color: '#7B1FA2', highlight: '#9C27B0', shadow: '#4A148C', weight: 5 },
    { name: 'Headband Red', type: 'headband', color: '#C62828', highlight: '#E53935', weight: 5 },
    { name: 'Headband Blue', type: 'headband', color: '#1565C0', highlight: '#1976F2', weight: 5 },
    { name: 'Headband Green', type: 'headband', color: '#2E7D32', highlight: '#43A047', weight: 5 },
    { name: 'Headband Purple', type: 'headband', color: '#7B1FA2', highlight: '#9C27B0', weight: 5 },
    { name: 'Crown', type: 'crown', weight: 10 },
    { name: 'Halo', type: 'halo', weight: 8 },
  ],
  feet: [
    { name: 'Default Orange', type: 'default', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22', weight: 100 },
  ],
  cheeks: [
    { name: 'Pink', base: '#FFB6C1', highlight: '#FFC5CD', weight: 100 },
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
};

function randomItem(arr) {
  const total = arr.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of arr) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return arr[0];
}

function generateTraits() {
  return {
    background: randomItem(TRAITS.background),
    body: randomItem(TRAITS.body),
    belly: randomItem(TRAITS.belly),
    beak: randomItem(TRAITS.beak),
    eyes: randomItem(TRAITS.eyes),
    head: randomItem(TRAITS.head),
    feet: TRAITS.feet[0],
    cheeks: TRAITS.cheeks[0],
    name: randomItem(TRAITS.name),
  };
}

function drawAgent(traits, canvas) {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const scale = 46;
  canvas.width = 2048;
  canvas.height = 2048;
  
  if (traits.background.color === 'rainbow') {
    const rainbowColors = ['#FF6B6B', '#FF9F43', '#F9CA24', '#6AB04C', '#48DBFB', '#9B59B6'];
    for (let y = 0; y < 40; y++) {
      ctx.fillStyle = rainbowColors[y % rainbowColors.length];
      ctx.fillRect(0, y * scale, canvas.width, scale);
    }
  } else {
    ctx.fillStyle = traits.background.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  const offsetX = 2;
  const offsetY = 1;
  
  const set = (x, y, color) => {
    if (x >= 0 && x < 40 && y >= 0 && y < 40) {
      ctx.fillStyle = color;
      ctx.fillRect((x + offsetX) * scale, (y + offsetY) * scale, scale, scale);
    }
  };

  const rect = (x1, y1, x2, y2, color) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) set(x, y, color);
    }
  };
  
  const rainbowColors = ['#FF6B6B', '#FF9F43', '#F9CA24', '#6AB04C', '#48DBFB', '#9B59B6', '#FF6B9D'];
  const getRainbow = (x, y) => rainbowColors[((x + y) % 7)];
  
  const getColor = (color, x = 20, y = 30) => {
    if (color === 'rainbow') return getRainbow(x, y);
    return color;
  };

  const body = getColor(traits.body.base);
  const bodyHighlight = getColor(traits.body.highlight);
  const bodyShadow = getColor(traits.body.shadow);
  const belly = traits.belly.base;
  const bellyHighlight = traits.belly.highlight;
  const beak = traits.beak.base;
  const beakHighlight = traits.beak.highlight;
  const beakShadow = traits.beak.shadow;
  const feet = traits.feet?.base || '#FF9F43';
  const feetHighlight = traits.feet?.highlight || '#FFBE76';
  const feetShadow = traits.feet?.shadow || '#E67E22';
  
  const cx = 20;
  
  // Body - detailed pixel art
  rect(8, 25, 31, 38, body);
  rect(7, 26, 32, 37, body);
  rect(6, 27, 33, 36, body);
  rect(6, 28, 33, 35, body);
  rect(7, 29, 32, 34, body);
  rect(8, 30, 31, 33, body);
  rect(9, 31, 30, 32, body);
  rect(10, 32, 29, 32, body);
  
  rect(10, 26, 29, 27, bodyHighlight);
  rect(9, 28, 30, 28, bodyHighlight);
  rect(10, 30, 29, 30, bodyHighlight);
  rect(11, 32, 28, 32, bodyHighlight);
  
  rect(8, 38, 31, 38, bodyShadow);
  rect(7, 37, 32, 37, bodyShadow);
  rect(6, 36, 33, 36, bodyShadow);
  
  rect(12, 27, 12, 27, bodyShadow);
  rect(28, 27, 28, 27, bodyShadow);
  rect(10, 29, 10, 29, bodyShadow);
  rect(30, 29, 30, 29, bodyShadow);
  rect(8, 31, 8, 31, bodyShadow);
  rect(32, 31, 32, 31, bodyShadow);
  
  // Belly
  rect(12, 28, 27, 38, belly);
  rect(11, 29, 28, 37, belly);
  rect(11, 30, 28, 36, belly);
  rect(12, 31, 27, 35, belly);
  rect(13, 32, 26, 34, belly);
  rect(14, 33, 25, 34, belly);
  rect(15, 34, 24, 35, belly);
  
  rect(14, 29, 25, 30, bellyHighlight);
  rect(14, 31, 25, 32, bellyHighlight);
  rect(15, 33, 24, 34, bellyHighlight);
  
  rect(15, 35, 15, 35, bellyHighlight);
  rect(24, 35, 24, 35, bellyHighlight);
  rect(16, 36, 16, 36, bellyHighlight);
  rect(23, 36, 23, 36, bellyHighlight);
  
  // Head
  rect(10, 8, 29, 26, body);
  rect(9, 9, 30, 25, body);
  rect(8, 10, 31, 24, body);
  rect(8, 11, 31, 23, body);
  rect(9, 12, 30, 22, body);
  rect(10, 13, 29, 21, body);
  rect(11, 14, 28, 20, body);
  rect(12, 15, 27, 19, body);
  rect(13, 16, 26, 18, body);
  rect(14, 17, 25, 18, body);
  
  rect(12, 9, 27, 10, bodyHighlight);
  rect(11, 11, 28, 12, bodyHighlight);
  rect(12, 13, 27, 14, bodyHighlight);
  rect(13, 15, 26, 16, bodyHighlight);
  rect(14, 17, 25, 17, bodyHighlight);
  
  rect(10, 26, 29, 26, bodyShadow);
  rect(9, 25, 30, 25, bodyShadow);
  rect(8, 24, 31, 24, bodyShadow);
  
  rect(11, 10, 11, 10, bodyShadow);
  rect(28, 10, 28, 10, bodyShadow);
  rect(10, 12, 10, 12, bodyShadow);
  rect(29, 12, 29, 12, bodyShadow);
  rect(10, 14, 10, 14, bodyShadow);
  rect(29, 14, 29, 14, bodyShadow);
  
  // Face
  rect(12, 14, 27, 24, belly);
  rect(11, 15, 28, 23, belly);
  rect(12, 16, 27, 22, belly);
  rect(13, 17, 26, 21, belly);
  rect(14, 18, 25, 20, belly);
  rect(15, 19, 24, 20, belly);
  
  rect(14, 15, 25, 16, bellyHighlight);
  rect(14, 17, 25, 18, bellyHighlight);
  rect(15, 19, 24, 20, bellyHighlight);
  
  // Eyes
  const eyeY = 17;
  
  if (traits.eyes.type === 'round') {
    rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    rect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF');
    rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF');
    rect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A');
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A');
    rect(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF');
    rect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, '#FFFFFF');
  } else if (traits.eyes.type === 'angry') {
    rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    rect(cx - 4, eyeY, cx - 3, eyeY, '#FF0000');
    rect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A');
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A');
    rect(cx + 4, eyeY, cx + 5, eyeY, '#FF0000');
    rect(cx - 6, eyeY - 2, cx - 3, eyeY - 2, '#0A0A0A');
    rect(cx + 3, eyeY - 2, cx + 6, eyeY - 2, '#0A0A0A');
  } else if (traits.eyes.type === 'sleepy') {
    rect(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A');
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    rect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A');
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A');
  } else if (traits.eyes.type === 'sparkle') {
    rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    rect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF');
    rect(cx - 3, eyeY + 2, cx - 3, eyeY + 2, '#FFFFFF');
    rect(cx + 3, eyeY, cx + 5, eyeY + 2, '#0A0A0A');
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 2, '#0A0A0A');
    rect(cx + 4, eyeY, cx + 5, eyeY, '#FFFFFF');
    rect(cx + 5, eyeY + 2, cx + 5, eyeY + 2, '#FFFFFF');
  } else if (traits.eyes.type === 'happy') {
    rect(cx - 6, eyeY, cx - 2, eyeY + 2, '#0A0A0A');
    rect(cx - 5, eyeY + 1, cx - 3, eyeY + 2, '#0A0A0A');
    rect(cx + 2, eyeY, cx + 6, eyeY + 2, '#0A0A0A');
    rect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A');
  } else if (traits.eyes.type === 'wink') {
    rect(cx - 5, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 2, '#0A0A0A');
    rect(cx - 5, eyeY, cx - 4, eyeY, '#FFFFFF');
    rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, '#FFFFFF');
    rect(cx + 3, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A');
  } else if (traits.eyes.type === 'sad') {
    rect(cx - 5, eyeY, cx - 3, eyeY + 1, '#0A0A0A');
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A');
    rect(cx + 3, eyeY, cx + 5, eyeY + 1, '#0A0A0A');
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A');
    rect(cx - 6, eyeY - 2, cx - 3, eyeY - 2, bodyShadow);
    rect(cx + 3, eyeY - 2, cx + 6, eyeY - 2, bodyShadow);
  } else if (traits.eyes.type === 'surprised') {
    rect(cx - 6, eyeY - 1, cx - 2, eyeY + 2, '#0A0A0A');
    rect(cx - 5, eyeY - 1, cx - 3, eyeY + 2, '#FFFFFF');
    rect(cx - 5, eyeY, cx - 4, eyeY + 1, '#0A0A0A');
    rect(cx + 2, eyeY - 1, cx + 6, eyeY + 2, '#0A0A0A');
    rect(cx + 3, eyeY - 1, cx + 5, eyeY + 2, '#FFFFFF');
    rect(cx + 4, eyeY, cx + 5, eyeY + 1, '#0A0A0A');
  } else if (traits.eyes.type === 'sideeye') {
    rect(cx - 6, eyeY, cx - 3, eyeY + 2, '#0A0A0A');
    rect(cx - 5, eyeY + 1, cx - 4, eyeY + 2, '#0A0A0A');
    rect(cx + 3, eyeY, cx + 6, eyeY + 2, '#0A0A0A');
    rect(cx + 4, eyeY + 1, cx + 5, eyeY + 2, '#0A0A0A');
  } else if (traits.eyes.type === 'closed') {
    rect(cx - 6, eyeY + 1, cx - 2, eyeY + 1, '#0A0A0A');
    rect(cx + 2, eyeY + 1, cx + 6, eyeY + 1, '#0A0A0A');
  }
  
  // Eyebrows
  if (traits.eyes.type !== 'sleepy' && traits.eyes.type !== 'closed' && traits.eyes.type !== 'angry') {
    rect(cx - 7, 14, cx - 3, 14, bodyShadow);
    rect(cx + 3, 14, cx + 7, 14, bodyShadow);
    rect(cx - 8, 13, cx - 4, 13, bodyShadow);
    rect(cx + 4, 13, cx + 8, 13, bodyShadow);
  }
  
  // Beak
  if (traits.beak.type === 'small') {
    rect(cx - 2, 21, cx + 1, 23, beak);
    rect(cx - 1, 20, cx, 22, beak);
    rect(cx - 1, 22, cx, 22, beakShadow);
  } else if (traits.beak.type === 'large') {
    rect(cx - 4, 20, cx + 3, 24, beak);
    rect(cx - 3, 19, cx + 2, 23, beak);
    rect(cx - 2, 19, cx + 1, 20, beak);
    rect(cx - 3, 24, cx + 2, 24, beakShadow);
  } else if (traits.beak.type === 'wide') {
    rect(cx - 4, 21, cx + 3, 23, beak);
    rect(cx - 3, 20, cx + 2, 24, beak);
    rect(cx - 2, 20, cx + 1, 20, beak);
    rect(cx - 2, 24, cx + 1, 24, beakShadow);
  } else if (traits.beak.type === 'pointy') {
    rect(cx - 2, 21, cx + 1, 23, beak);
    rect(cx - 1, 19, cx, 22, beak);
    rect(cx, 18, cx, 20, beak);
    rect(cx - 1, 23, cx, 23, beakShadow);
  } else if (traits.beak.type === 'round') {
    rect(cx - 3, 21, cx + 2, 23, beak);
    rect(cx - 2, 20, cx + 1, 24, beak);
    rect(cx - 1, 20, cx, 20, beak);
    rect(cx - 2, 24, cx + 1, 24, beakShadow);
  } else if (traits.beak.type === 'puffy') {
    rect(cx - 4, 20, cx + 3, 23, beak);
    rect(cx - 3, 19, cx + 2, 22, beakHighlight);
    rect(cx - 2, 18, cx + 1, 20, beakHighlight);
    rect(cx - 3, 23, cx + 2, 23, beakShadow);
    rect(cx + 2, 22, cx + 3, 22, beakShadow);
  } else {
    rect(cx - 3, 21, cx + 2, 23, beak);
    rect(cx - 2, 20, cx + 1, 22, beak);
    rect(cx - 1, 20, cx, 21, beak);
    rect(cx - 2, 22, cx + 1, 22, beakShadow);
    rect(cx - 3, 21, cx - 3, 22, beakShadow);
  }
  
  // Cheeks
  const cheeksColor = traits.cheeks?.base || '#FFB6C1';
  const cheeksHighlightColor = traits.cheeks?.highlight || '#FFC5CD';
  rect(cx - 9, 19, cx - 7, 21, cheeksColor);
  rect(cx + 7, 19, cx + 9, 21, cheeksColor);
  rect(cx - 8, 20, cx - 7, 20, cheeksHighlightColor);
  rect(cx + 7, 20, cx + 8, 20, cheeksHighlightColor);
  
  // Head accessories
  if (traits.head.type === 'crown') {
    rect(cx - 9, 6, cx + 9, 8, '#FFD700');
    rect(cx - 8, 4, cx - 6, 8, '#FFD700');
    rect(cx - 3, 2, cx - 1, 8, '#FFD700');
    rect(cx + 1, 2, cx + 3, 8, '#FFD700');
    rect(cx + 6, 4, cx + 8, 8, '#FFD700');
    rect(cx - 4, 5, cx - 2, 6, '#FF0000');
    rect(cx + 2, 5, cx + 4, 6, '#FF0000');
  } else if (traits.head.type === 'tophat') {
    rect(cx - 10, 6, cx + 10, 9, '#1A1A1A');
    rect(cx - 9, 5, cx + 9, 7, '#2D2D2D');
    rect(cx - 4, 2, cx + 3, 6, '#1A1A1A');
    rect(cx - 11, 8, cx + 11, 9, '#8B0000');
    rect(cx - 2, 3, cx + 1, 4, '#C0C0C0');
  } else if (traits.head.type === 'beanie') {
    rect(cx - 10, 6, cx + 10, 9, traits.head.color);
    rect(cx - 9, 4, cx + 9, 7, traits.head.highlight);
    rect(cx - 8, 3, cx + 8, 5, traits.head.highlight);
    rect(cx - 3, 2, cx + 2, 4, traits.head.shadow);
    rect(cx - 2, 1, cx + 1, 3, traits.head.shadow);
  } else if (traits.head.type === 'bow') {
    rect(cx - 10, 7, cx - 7, 9, '#FF69B4');
    rect(cx + 7, 7, cx + 10, 9, '#FF69B4');
    rect(cx - 6, 7, cx + 6, 9, '#FF1493');
    rect(cx - 8, 6, cx - 6, 8, '#FFB6C1');
    rect(cx + 6, 6, cx + 8, 8, '#FFB6C1');
    rect(cx - 2, 8, cx + 1, 8, '#FF1493');
  } else if (traits.head.type === 'cap') {
    rect(cx - 10, 7, cx + 9, 9, traits.head.color);
    rect(cx - 9, 6, cx + 8, 8, traits.head.highlight);
    rect(cx + 8, 8, cx + 12, 10, traits.head.shadow);
    rect(cx + 10, 9, cx + 12, 10, traits.head.shadow);
    rect(cx - 11, 8, cx - 9, 9, traits.head.shadow);
  } else if (traits.head.type === 'scarf') {
    rect(cx - 10, 25, cx + 10, 28, traits.head.color);
    rect(cx - 9, 24, cx + 9, 26, traits.head.highlight);
    rect(cx + 8, 25, cx + 11, 33, traits.head.color);
    rect(cx + 9, 26, cx + 10, 32, traits.head.highlight);
    rect(cx - 2, 26, cx + 1, 27, traits.head.shadow);
  } else if (traits.head.type === 'halo') {
    rect(cx - 4, 3, cx + 3, 4, '#FFD700');
    rect(cx - 5, 4, cx + 4, 5, '#FFD700');
    rect(cx - 3, 2, cx + 2, 3, '#FFD700');
  } else if (traits.head.type === 'headband') {
    rect(cx - 10, 6, cx + 10, 9, traits.head.color);
    rect(cx - 9, 5, cx + 9, 7, traits.head.highlight);
    rect(cx - 7, 5, cx - 5, 8, traits.head.highlight);
    rect(cx - 1, 5, cx + 1, 8, traits.head.highlight);
    rect(cx + 5, 5, cx + 7, 8, traits.head.highlight);
  }
  
  // Flippers - detailed pixel art
  rect(2, 26, 5, 32, body);
  rect(1, 27, 6, 31, body);
  rect(2, 28, 5, 30, bodyHighlight);
  rect(3, 29, 5, 29, bodyHighlight);
  rect(2, 30, 4, 31, bodyShadow);
  rect(1, 31, 3, 32, bodyShadow);
  rect(1, 30, 3, 33, body);
  rect(2, 31, 3, 32, bodyHighlight);
  rect(5, 31, 7, 33, body);
  rect(6, 32, 7, 33, bodyHighlight);
  
  rect(34, 26, 37, 32, body);
  rect(33, 27, 38, 31, body);
  rect(34, 28, 37, 30, bodyHighlight);
  rect(34, 29, 36, 29, bodyHighlight);
  rect(35, 30, 37, 31, bodyShadow);
  rect(36, 31, 38, 32, bodyShadow);
  rect(36, 30, 38, 33, body);
  rect(36, 31, 37, 32, bodyHighlight);
  rect(32, 31, 34, 33, body);
  rect(32, 32, 33, 33, bodyHighlight);
  
  // Feet
  rect(10, 37, 14, 38, feet);
  rect(9, 38, 15, 38, feet);
  rect(11, 36, 13, 37, feetHighlight);
  rect(10, 38, 13, 38, feetShadow);
  rect(8, 38, 10, 39, feet);
  rect(9, 38, 10, 39, feetHighlight);
  rect(12, 38, 14, 39, feet);
  rect(13, 38, 14, 39, feetHighlight);
  
  rect(25, 37, 29, 38, feet);
  rect(24, 38, 30, 38, feet);
  rect(26, 36, 28, 37, feetHighlight);
  rect(25, 38, 28, 38, feetShadow);
  rect(25, 38, 27, 39, feet);
  rect(26, 38, 27, 39, feetHighlight);
  rect(29, 39, 31, 39, feet);
  rect(30, 39, 31, 39, feetHighlight);
  
  // Ground shadow
  rect(8, 38, 31, 38, 'rgba(0,0,0,0.3)');
}

console.log('=== Generating 2D NFT Images ===\n');

for (let i = 1; i <= 10; i++) {
  const traits = generateTraits();
  
  const canvas = createCanvas(2048, 2048);
  drawAgent(traits, canvas);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`${OUTPUT_2D}/penguin_${i}.png`, buffer);
  
  const metadata = {
    id: i,
    name: traits.name.name,
    background: traits.background,
    body: traits.body,
    belly: traits.belly,
    beak: traits.beak,
    eyes: traits.eyes,
    head: traits.head,
    feet: traits.feet,
    cheeks: traits.cheeks,
  };
  fs.writeFileSync(`${OUTPUT_METADATA}/penguin_${i}.json`, JSON.stringify(metadata, null, 2));
  
  console.log(`Generated penguin_${i}.png - ${traits.name.name} | ${traits.body.name} | ${traits.eyes.name} | ${traits.head.name}`);
}

console.log('\n=== 2D Generation Complete ===');
