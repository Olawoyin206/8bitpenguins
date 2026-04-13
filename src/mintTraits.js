const RARITY_WEIGHT_BY_TIER = Object.freeze({
  Common: 32,
  Uncommon: 16,
  Rare: 7,
  Epic: 2,
})

function trait(rarity, config) {
  return {
    ...config,
    rarity,
    weight: RARITY_WEIGHT_BY_TIER[rarity],
  }
}

export const MINT_TRAITS = {
  background: [
    trait('Common', { name: 'Light Blue', color: '#ADD8E6' }),
    trait('Common', { name: 'Baby Pink', color: '#F4A6B8' }),
    trait('Common', { name: 'Sky Blue', color: '#87CEEB' }),
    trait('Uncommon', { name: 'Arctic White', color: '#DDE8F8', fx: 'snowflakes' }),
    trait('Common', { name: 'Soft Lavender', color: '#C8B6FF' }),
    trait('Common', { name: 'Mint Green', color: '#98FFCC' }),
    trait('Common', { name: 'Pastel Pink', color: '#FFD1DC' }),
    trait('Rare', { name: 'Royal Blue', color: '#4169E1', fx: 'softdots' }),
    trait('Common', { name: 'Peach Cream', color: '#FFE5B4' }),
    trait('Uncommon', { name: 'Lilac Purple', color: '#D8B4F8' }),
    trait('Common', { name: 'Warm Beige', color: '#F5F5DC' }),
    trait('Common', { name: 'Coral Red', color: '#FF6B6B' }),
    trait('Rare', { name: 'Midnight Blue', color: '#1A1A2E', fx: 'snowflakes' }),
    trait('Uncommon', { name: 'Sunset Orange', color: '#FF7A18' }),
    trait('Rare', { name: 'Deep Teal', color: '#0F4C5C', fx: 'softdots' }),
    trait('Uncommon', { name: 'Forest Green', color: '#2E8B57' }),
    trait('Uncommon', { name: 'Charcoal Gray', color: '#36454F' }),
    trait('Rare', { name: 'Neon Yellow', color: '#F5FF3B' }),
    trait('Rare', { name: 'Electric Cyan', color: '#00FFFF' }),
    trait('Epic', { name: 'Golden Glow', color: '#FFD700', fx: 'softdots' }),
    trait('Uncommon', { name: 'Crimson Red', color: '#DC143C' }),
  ],
  body: [
    trait('Common', { name: 'Skeleton Dark Bone', base: '#D6CCB8', highlight: '#E8E2D4', shadow: '#9F8B7D' }),
    trait('Common', { name: 'Snow White', base: '#F5F5F5', highlight: '#FFFFFF', shadow: '#C2C2C2' }),
    trait('Common', { name: 'Jet Black', base: '#1C1C1C', highlight: '#484848', shadow: '#000000' }),
    trait('Common', { name: 'Ash Gray', base: '#B2B2B2', highlight: '#D9D9D9', shadow: '#858585' }),
    trait('Common', { name: 'Cream', base: '#FFF3D6', highlight: '#FFFFEB', shadow: '#CCC2A3' }),
    trait('Common', { name: 'Light Brown', base: '#C68642', highlight: '#E0A86A', shadow: '#8E5C2B' }),
    trait('Common', { name: 'Chocolate Brown', base: '#5C3A21', highlight: '#8A6145', shadow: '#3A2514' }),
    trait('Common', { name: 'Golden Tan', base: '#D2A679', highlight: '#E8C9A4', shadow: '#9E7856' }),
    trait('Common', { name: 'Ice Blue', base: '#CFE9FF', highlight: '#F0F8FF', shadow: '#9FBFCD' }),
    trait('Common', { name: 'Baby Blue', base: '#A7C7E7', highlight: '#D4E9F5', shadow: '#7A96B0' }),
    trait('Uncommon', { name: 'Ocean Blue', base: '#2B6CB0', highlight: '#5A9AD4', shadow: '#1D4D7E' }),
    trait('Uncommon', { name: 'Soft Pink', base: '#F4A6B8', highlight: '#FAD2DD', shadow: '#B77A8B' }),
    trait('Uncommon', { name: 'Bubblegum Pink', base: '#FF77AA', highlight: '#FFA5CC', shadow: '#CC4F7D' }),
    trait('Uncommon', { name: 'Lavender Body', base: '#BFA2DB', highlight: '#D9C9EB', shadow: '#8F76A4' }),
    trait('Uncommon', { name: 'Royal Purple', base: '#6B3FA0', highlight: '#9670BF', shadow: '#4D2A75' }),
    trait('Rare', { name: 'Mint Body', base: '#A8E6CF', highlight: '#D4F5E8', shadow: '#7DB39C' }),
    trait('Rare', { name: 'Olive Green', base: '#708238', highlight: '#96A65C', shadow: '#515D27' }),
    trait('Rare', { name: 'Coral Body', base: '#FF8C69', highlight: '#FFB49B', shadow: '#CC634A' }),
    trait('Rare', { name: 'Sunset Gold', base: '#E6B422', highlight: '#F0CC57', shadow: '#B38618' }),
    trait('Epic', { name: 'Glass Style', base: '#E0FFFF', highlight: '#F0FFFF', shadow: '#A8C8C8' }),
  ],
  belly: [
    trait('Common', { name: 'Cream', base: '#FDF5E6', highlight: '#FFFAF0', shadow: '#F5E6D3' }),
    trait('Common', { name: 'Peach', base: '#FFDAB9', highlight: '#FFE4C4', shadow: '#F5CBA7' }),
    trait('Uncommon', { name: 'Light Blue', base: '#D6EAF8', highlight: '#EBF5FB', shadow: '#AED6F1' }),
    trait('Rare', { name: 'Mint', base: '#D5F5E3', highlight: '#E8F8F5', shadow: '#ABEBC6' }),
    trait('Epic', { name: 'Lavender', base: '#E8DAEF', highlight: '#F4ECF7', shadow: '#D2B4DE' }),
  ],
  beak: [
    trait('Common', { name: 'Small', type: 'small', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }),
    trait('Common', { name: 'Large', type: 'large', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }),
    trait('Uncommon', { name: 'Wide', type: 'wide', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }),
    trait('Uncommon', { name: 'Pointy', type: 'pointy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }),
    trait('Rare', { name: 'Round', type: 'round', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }),
    trait('Epic', { name: 'Puffy', type: 'puffy', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }),
  ],
  eyes: [
    trait('Common', { name: 'Normal', type: 'round' }),
    trait('Common', { name: 'Happy', type: 'happy' }),
    trait('Common', { name: 'Sad', type: 'sad' }),
    trait('Uncommon', { name: 'Angry', type: 'angry' }),
    trait('Common', { name: 'Sleepy', type: 'sleepy' }),
    trait('Uncommon', { name: 'Surprised', type: 'surprised' }),
    trait('Uncommon', { name: 'Wink', type: 'wink' }),
    trait('Rare', { name: 'Side-eye', type: 'sideeye' }),
    trait('Rare', { name: 'Closed', type: 'closed' }),
    trait('Epic', { name: 'Sparkle', type: 'sparkle' }),
  ],
  head: [
    trait('Common', { name: 'None', type: 'none' }),
    trait('Common', { name: 'Cap Gold', type: 'cap', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' }),
    trait('Common', { name: 'Cap Matte Black', type: 'cap', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' }),
    trait('Common', { name: 'Cap Sapphire Blue', type: 'cap', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' }),
    trait('Common', { name: 'Cap Crimson', type: 'cap', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' }),
    trait('Common', { name: 'Cap Royal Gold', type: 'cap', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' }),
    trait('Uncommon', { name: 'Beanie Gold', type: 'beanie', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' }),
    trait('Uncommon', { name: 'Beanie Matte Black', type: 'beanie', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' }),
    trait('Uncommon', { name: 'Beanie Sapphire Blue', type: 'beanie', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' }),
    trait('Uncommon', { name: 'Beanie Crimson', type: 'beanie', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' }),
    trait('Uncommon', { name: 'Beanie Royal Gold', type: 'beanie', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' }),
    trait('Uncommon', { name: 'Scarf Gold', type: 'scarf', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' }),
    trait('Uncommon', { name: 'Scarf Matte Black', type: 'scarf', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' }),
    trait('Uncommon', { name: 'Scarf Sapphire Blue', type: 'scarf', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' }),
    trait('Rare', { name: 'Scarf Crimson', type: 'scarf', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' }),
    trait('Rare', { name: 'Scarf Royal Gold', type: 'scarf', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' }),
    trait('Rare', { name: 'Headband Gold', type: 'headband', color: '#FFD700', highlight: '#FFE44D', shadow: '#CCAC00' }),
    trait('Rare', { name: 'Headband Matte Black', type: 'headband', color: '#2B2B2B', highlight: '#545454', shadow: '#141414' }),
    trait('Rare', { name: 'Headband Sapphire Blue', type: 'headband', color: '#0F52BA', highlight: '#3D71D1', shadow: '#0A3A8C' }),
    trait('Rare', { name: 'Headband Crimson', type: 'headband', color: '#DC143C', highlight: '#E54767', shadow: '#A00F2C' }),
    trait('Rare', { name: 'Headband Royal Gold', type: 'headband', color: '#FAD02E', highlight: '#FFE170', shadow: '#C9A823' }),
    trait('Epic', { name: 'Crown Imperial', type: 'crown', style: 'imperial' }),
    trait('Epic', { name: 'Crown Elegant', type: 'crown', style: 'elegant' }),
    trait('Epic', { name: 'Halo', type: 'halo' }),
  ],
  feet: [
    trait('Common', { name: 'Default Orange', type: 'default', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' }),
  ],
  name: [
    trait('Common', { name: 'Frosty' }),
    trait('Common', { name: 'Waddles' }),
    trait('Common', { name: 'Pebble' }),
    trait('Common', { name: 'Chilly' }),
    trait('Common', { name: 'Snowy' }),
    trait('Uncommon', { name: 'Flurry' }),
    trait('Uncommon', { name: 'Icee' }),
    trait('Rare', { name: 'Bubbles' }),
    trait('Rare', { name: 'Nippy' }),
    trait('Epic', { name: 'Tuxy' }),
  ],
}

const LEGACY_METADATA_TRAITS = {
  feet: [
    { name: 'Default Orange', type: 'default', base: '#FF9F43', highlight: '#FFBE76', shadow: '#E67E22' },
    { name: 'Default Pink', type: 'default', base: '#FD79A8', highlight: '#FDCBDF', shadow: '#E84393' },
    { name: 'Default Black', type: 'default', base: '#2D3436', highlight: '#636E72', shadow: '#0D1318' },
    { name: 'Default White', type: 'default', base: '#DFE6E9', highlight: '#FFFFFF', shadow: '#B2BEC3' },
  ],
}

export function randomMintTraitItem(arr) {
  const total = arr.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total
  for (const item of arr) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return arr[0]
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null
}

function colorDiff(colorA, colorB) {
  if (!colorA || !colorB) return 999
  return Math.abs(colorA.r - colorB.r) + Math.abs(colorA.g - colorB.g) + Math.abs(colorA.b - colorB.b)
}

function rerollTraitWithLimit(currentValue, pool, isAcceptable, maxAttempts = 24) {
  let selected = currentValue
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (isAcceptable(selected)) return selected
    selected = randomMintTraitItem(pool)
  }
  return selected
}

export function generateMintPenguinTraits() {
  const traits = {
    background: randomMintTraitItem(MINT_TRAITS.background),
    body: randomMintTraitItem(MINT_TRAITS.body),
    belly: randomMintTraitItem(MINT_TRAITS.belly),
    beak: randomMintTraitItem(MINT_TRAITS.beak),
    eyes: randomMintTraitItem(MINT_TRAITS.eyes),
    head: randomMintTraitItem(MINT_TRAITS.head),
    feet: MINT_TRAITS.feet[0],
    name: randomMintTraitItem(MINT_TRAITS.name),
  }

  traits.body = rerollTraitWithLimit(
    traits.body,
    MINT_TRAITS.body,
    (candidate) => colorDiff(hexToRgb(traits.background.color), hexToRgb(candidate?.base)) >= 80
  )

  traits.belly = rerollTraitWithLimit(
    traits.belly,
    MINT_TRAITS.belly,
    (candidate) => colorDiff(hexToRgb(candidate?.base), hexToRgb(traits.body.base)) >= 80
  )

  traits.belly = rerollTraitWithLimit(
    traits.belly,
    MINT_TRAITS.belly,
    (candidate) => colorDiff(hexToRgb(traits.background.color), hexToRgb(candidate?.base)) >= 80
  )

  const hasHeadAccessory = traits.head.type !== 'none' && traits.head.type !== 'crown' && traits.head.type !== 'halo'
  if (hasHeadAccessory && traits.head.color) {
    traits.head = rerollTraitWithLimit(
      traits.head,
      MINT_TRAITS.head,
      (candidate) => colorDiff(hexToRgb(candidate?.color), hexToRgb(traits.body.base)) >= 80
    )
  }

  return traits
}

export function getMintTraitByName(group, name, fallbackIndex = 0) {
  const items = Array.isArray(LEGACY_METADATA_TRAITS[group])
    ? LEGACY_METADATA_TRAITS[group]
    : (Array.isArray(MINT_TRAITS[group]) ? MINT_TRAITS[group] : [])
  return items.find((item) => item.name === name) || items[fallbackIndex] || null
}

export function rebuildMintTraitsFromAttributes(attributes) {
  const traitMap = new Map(
    (Array.isArray(attributes) ? attributes : [])
      .map((entry) => [String(entry?.trait_type || '').trim(), String(entry?.value || '').trim()])
      .filter(([key, value]) => key && value)
  )

  return {
    background: getMintTraitByName('background', traitMap.get('Background')),
    body: getMintTraitByName('body', traitMap.get('Body')),
    belly: getMintTraitByName('belly', traitMap.get('Belly')),
    beak: getMintTraitByName('beak', traitMap.get('Beak')),
    eyes: getMintTraitByName('eyes', traitMap.get('Eyes')),
    head: getMintTraitByName('head', traitMap.get('Head')),
    feet: getMintTraitByName('feet', traitMap.get('Feet')),
  }
}

export function buildMintAttributesFromTraits(traits) {
  const getEffectValue = () => {
    if (traits.effect?.name && traits.effect.name !== 'None') {
      const variant = traits.effect.variant || 'White'
      return `${traits.effect.name} (${variant})`
    }
    if (traits.background?.fx === 'snowflakes') return 'Snow (White)'
    if (traits.background?.fx === 'softdots') return 'Stone (White)'
    return null
  }

  const effectValue = getEffectValue()
  const attributes = [
    { trait_type: 'Background', value: traits.background?.name || 'Unknown' },
    { trait_type: 'Body', value: traits.body?.name || 'Unknown' },
    { trait_type: 'Belly', value: traits.belly?.name || 'Unknown' },
    { trait_type: 'Beak', value: traits.beak?.name || 'Unknown' },
    { trait_type: 'Eyes', value: traits.eyes?.name || 'Unknown' },
    { trait_type: 'Head', value: traits.head?.name || 'Unknown' },
    { trait_type: 'Feet', value: traits.feet?.name || 'Unknown' },
  ]
  if (effectValue) attributes.splice(1, 0, { trait_type: 'Effect', value: effectValue })
  return attributes
}

export function calculateMintRarityScore(traits) {
  const safeWeight = (item) => Math.max(1, Number(item?.weight || 1))
  const scoreFrom = (item, pool) => {
    const totalWeight = pool.reduce((sum, entry) => sum + safeWeight(entry), 0)
    const probability = safeWeight(item) / totalWeight
    return -Math.log(probability)
  }

  const sum =
    scoreFrom(traits.background, MINT_TRAITS.background) +
    scoreFrom(traits.body, MINT_TRAITS.body) +
    scoreFrom(traits.belly, MINT_TRAITS.belly) +
    scoreFrom(traits.beak, MINT_TRAITS.beak) +
    scoreFrom(traits.eyes, MINT_TRAITS.eyes) +
    scoreFrom(traits.head, MINT_TRAITS.head) +
    scoreFrom(traits.feet, MINT_TRAITS.feet)

  return Math.round(sum * 1000)
}

function indexOfTrait(group, name, fallback = 0) {
  const items = Array.isArray(MINT_TRAITS[group]) ? MINT_TRAITS[group] : []
  const index = items.findIndex((item) => item?.name === name)
  return index >= 0 ? index : fallback
}

export function packMintTraits(traits) {
  const backgroundIndex = indexOfTrait('background', traits?.background?.name)
  const bodyIndex = indexOfTrait('body', traits?.body?.name)
  const bellyIndex = indexOfTrait('belly', traits?.belly?.name)
  const beakIndex = indexOfTrait('beak', traits?.beak?.name)
  const eyesIndex = indexOfTrait('eyes', traits?.eyes?.name)
  const headIndex = indexOfTrait('head', traits?.head?.name)
  const feetIndex = indexOfTrait('feet', traits?.feet?.name)

  return (
    backgroundIndex |
    (bodyIndex << 5) |
    (bellyIndex << 10) |
    (beakIndex << 13) |
    (eyesIndex << 16) |
    (headIndex << 20) |
    (feetIndex << 25)
  ) >>> 0
}
