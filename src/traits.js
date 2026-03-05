export const TRAITS = {
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
    { name: 'Headband Blue', type: 'headband', color: '#1565C0', highlight: '#1976F3', weight: 5 },
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
    { name: 'Ice', weight: 10 },
    { name: 'Glacier', weight: 8 },
    { name: 'Blizzard', weight: 8 },
    { name: 'Tundra', weight: 10 },
  ],
};

export function randomItem(arr) {
  const total = arr.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of arr) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return arr[0];
}

export function generateTraits() {
  return {
    background: randomItem(TRAITS.background),
    body: randomItem(TRAITS.body),
    belly: randomItem(TRAITS.belly),
    beak: randomItem(TRAITS.beak),
    eyes: randomItem(TRAITS.eyes),
    head: randomItem(TRAITS.head),
    feet: randomItem(TRAITS.feet),
    name: randomItem(TRAITS.name),
  };
}
