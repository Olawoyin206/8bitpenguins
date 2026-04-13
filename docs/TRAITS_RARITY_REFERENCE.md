# 8bit Penguins Trait and Rarity Reference

Last updated: 2026-04-02

This file documents the live trait/rarity logic used by the on-chain mint path.

## Source of Truth
- Mint randomness selection: `contracts/EightBitPenguinsRandomnessHelper.sol`
- Trait labels and rarity score constants: `contracts/EightBitPenguinsRendererData.sol`
- Mint flow and ranking: `contracts/8bitPenguins.sol`
- Frontend preview trait model: `src/mintTraits.js`

## Canonical Mint Path
- Live mint path is `mintOnchainCompact(...)`.
- Caller-supplied `packedTraits` are ignored.
- Traits are generated on-chain from entropy:
- `mintEntropy = keccak256(address(this), chainid, msg.sender, blockhash(block.number-1), block.prevrandao, _currentTokenId, quantity)`
- Per token in batch: `keccak256(mintEntropy, i)`

## Trait Packing (Bit Layout)
- Background: bits `0..4` (5 bits)
- Body: bits `5..9` (5 bits)
- Belly: bits `10..12` (3 bits)
- Beak: bits `13..15` (3 bits)
- Eyes: bits `16..19` (4 bits)
- Head: bits `20..24` (5 bits)
- Feet: bits `25..26` (2 bits)

Packing formula:
```text
packed =
  background
  | (body << 5)
  | (belly << 10)
  | (beak << 13)
  | (eyes << 16)
  | (head << 20)
  | (feet << 25)
```

## Rarity Weight Tiers
- Common: `32`
- Uncommon: `16`
- Rare: `7`
- Epic: `2`

These weights are used in randomness helper weighted selection.

## Full Trait Catalog and Weights

### Background (index `0..20`, total weight `421`)
| Index | Name | Weight | Tier |
|---|---|---:|---|
| 0 | Light Blue | 32 | Common |
| 1 | Baby Pink | 32 | Common |
| 2 | Sky Blue | 32 | Common |
| 3 | Arctic White | 16 | Uncommon |
| 4 | Soft Lavender | 32 | Common |
| 5 | Mint Green | 32 | Common |
| 6 | Pastel Pink | 32 | Common |
| 7 | Royal Blue | 7 | Rare |
| 8 | Peach Cream | 32 | Common |
| 9 | Lilac Purple | 16 | Uncommon |
| 10 | Warm Beige | 32 | Common |
| 11 | Coral Red | 32 | Common |
| 12 | Midnight Blue | 7 | Rare |
| 13 | Sunset Orange | 16 | Uncommon |
| 14 | Deep Teal | 7 | Rare |
| 15 | Forest Green | 16 | Uncommon |
| 16 | Charcoal Gray | 16 | Uncommon |
| 17 | Neon Yellow | 7 | Rare |
| 18 | Electric Cyan | 7 | Rare |
| 19 | Golden Glow | 2 | Epic |
| 20 | Crimson Red | 16 | Uncommon |

### Body (index `0..19`, total weight `430`)
| Index | Name | Weight | Tier |
|---|---|---:|---|
| 0 | Skeleton Dark Bone | 32 | Common |
| 1 | Snow White | 32 | Common |
| 2 | Jet Black | 32 | Common |
| 3 | Ash Gray | 32 | Common |
| 4 | Cream | 32 | Common |
| 5 | Light Brown | 32 | Common |
| 6 | Chocolate Brown | 32 | Common |
| 7 | Golden Tan | 32 | Common |
| 8 | Ice Blue | 32 | Common |
| 9 | Baby Blue | 32 | Common |
| 10 | Ocean Blue | 16 | Uncommon |
| 11 | Soft Pink | 16 | Uncommon |
| 12 | Bubblegum Pink | 16 | Uncommon |
| 13 | Lavender Body | 16 | Uncommon |
| 14 | Royal Purple | 16 | Uncommon |
| 15 | Mint Body | 7 | Rare |
| 16 | Olive Green | 7 | Rare |
| 17 | Coral Body | 7 | Rare |
| 18 | Sunset Gold | 7 | Rare |
| 19 | Glass Style | 2 | Epic |

### Belly (index `0..4`, total weight `89`)
| Index | Name | Weight | Tier |
|---|---|---:|---|
| 0 | Cream | 32 | Common |
| 1 | Peach | 32 | Common |
| 2 | Light Blue | 16 | Uncommon |
| 3 | Mint | 7 | Rare |
| 4 | Lavender | 2 | Epic |

### Beak (index `0..5`, total weight `105`)
| Index | Name | Weight | Tier |
|---|---|---:|---|
| 0 | Small | 32 | Common |
| 1 | Large | 32 | Common |
| 2 | Wide | 16 | Uncommon |
| 3 | Pointy | 16 | Uncommon |
| 4 | Round | 7 | Rare |
| 5 | Puffy | 2 | Epic |

### Eyes (index `0..9`, total weight `192`)
| Index | Name | Weight | Tier |
|---|---|---:|---|
| 0 | Normal | 32 | Common |
| 1 | Happy | 32 | Common |
| 2 | Sad | 32 | Common |
| 3 | Angry | 16 | Uncommon |
| 4 | Sleepy | 32 | Common |
| 5 | Surprised | 16 | Uncommon |
| 6 | Wink | 16 | Uncommon |
| 7 | Side-eye | 7 | Rare |
| 8 | Closed | 7 | Rare |
| 9 | Sparkle | 2 | Epic |

### Head (index `0..23`, total weight `375`)
| Index | Name | Weight | Tier |
|---|---|---:|---|
| 0 | None | 32 | Common |
| 1 | Cap Gold | 32 | Common |
| 2 | Cap Matte Black | 32 | Common |
| 3 | Cap Sapphire Blue | 32 | Common |
| 4 | Cap Crimson | 32 | Common |
| 5 | Cap Royal Gold | 32 | Common |
| 6 | Beanie Gold | 16 | Uncommon |
| 7 | Beanie Matte Black | 16 | Uncommon |
| 8 | Beanie Sapphire Blue | 16 | Uncommon |
| 9 | Beanie Crimson | 16 | Uncommon |
| 10 | Beanie Royal Gold | 16 | Uncommon |
| 11 | Scarf Gold | 16 | Uncommon |
| 12 | Scarf Matte Black | 16 | Uncommon |
| 13 | Scarf Sapphire Blue | 16 | Uncommon |
| 14 | Scarf Crimson | 7 | Rare |
| 15 | Scarf Royal Gold | 7 | Rare |
| 16 | Headband Gold | 7 | Rare |
| 17 | Headband Matte Black | 7 | Rare |
| 18 | Headband Sapphire Blue | 7 | Rare |
| 19 | Headband Crimson | 7 | Rare |
| 20 | Headband Royal Gold | 7 | Rare |
| 21 | Crown Imperial | 2 | Epic |
| 22 | Crown Elegant | 2 | Epic |
| 23 | Halo | 2 | Epic |

### Feet
- Randomness helper currently hard-sets `feetIndex = 0`.
- Minted by current flow:
- `0 => Default Orange`
- Renderer still supports legacy indices:
- `1 => Default Pink`
- `2 => Default Black`
- `3 => Default White`

### Name Trait (Canonical, derived from packed traits)
Name is deterministic from `packedTraits` using:
- `roll = uint256(keccak256("8BIT_PENGUIN_NAME", packedTraits)) % 208`
- weighted buckets that match the project name palette

| Index | Name | Weight | Tier |
|---|---|---:|---|
| 0 | Frosty | 32 | Common |
| 1 | Waddles | 32 | Common |
| 2 | Pebble | 32 | Common |
| 3 | Chilly | 32 | Common |
| 4 | Snowy | 32 | Common |
| 5 | Flurry | 16 | Uncommon |
| 6 | Icee | 16 | Uncommon |
| 7 | Bubbles | 7 | Rare |
| 8 | Nippy | 7 | Rare |
| 9 | Tuxy | 2 | Epic |

Notes:
- This does not consume extra storage.
- Same `packedTraits` always resolves to the same Name.
- Implementation source: `contracts/EightBitPenguinsRendererData.sol`.

### Effect Trait (Derived, not independently rolled)
- `Snow (White)` when background is `Arctic White (3)` or `Midnight Blue (12)`.
- `Stone (White)` when background is `Royal Blue (7)`, `Deep Teal (14)`, or `Golden Glow (19)`.

## Reroll and Constraint Logic (Randomness Helper)

Color contrast metric:
- `colorDiff = |r1-r2| + |g1-g2| + |b1-b2|`
- Threshold used: `>= 80`

Rules:
- Body: sampled with body weights, rerolled up to 24 attempts until body contrasts enough with background.
- Belly:
- First pass enforces contrast against body.
- Second pass enforces contrast against background.
- Each pass can reroll up to 24 attempts.
- Head:
- If head index is `1..20`, contrast must pass against body.
- `0 (None)`, `21 (Crown Imperial)`, `22 (Crown Elegant)`, `23 (Halo)` do not require this contrast check.
- Reroll up to 24 attempts.

Note:
- Rerolling changes realized frequencies from the simple raw weight ratios.

## On-Chain Rarity Score Calculation

Minted token rarity score is:
- `tokenRarityScore = rarityScoreFromPacked(packedTraits)`
- The renderer adds per-category constants:
- `backgroundScore + bodyScore + bellyScore + beakScore + eyesScore + headScore + feetScore`

### Per-tier score constants used by renderer
- Background: Common `2577`, Uncommon `3270`, Rare `4097`, Epic `5349`
- Body: Common `2598`, Uncommon `3291`, Rare `4118`, Epic `5371`
- Belly: Common `1023`, Uncommon `1716`, Rare `2543`, Epic `3795`
- Beak: Common `1188`, Uncommon `1881`, Rare `2708`, Epic `3961`
- Eyes: Common `1792`, Uncommon `2485`, Rare `3312`, Epic `4564`
- Head: Common `2461`, Uncommon `3154`, Rare `3981`, Epic `5234`
- Feet: index-based constants:
- `0 => 577`, `1 => 1270`, `2 => 2097`, `3 => 3350`

## Rank Determination

Runtime rank function in contract:
- Higher `tokenRarityScore` means rarer.
- Rank starts at 1.
- For each other token:
- if `otherScore > targetScore`, rank increments.
- if equal score and `otherTokenId < targetTokenId`, rank increments.

Tie-break rule:
- Lower token ID wins ties (better rank).

If `rarityFinalized == true` and `tokenFinalRarityRank[tokenId] > 0`, the frozen stored rank is returned.

## Frontend Preview Rarity (Non-canonical)

`src/mintTraits.js` has a preview formula:
- Uses `-ln(weight/total)` per category.
- Sums categories and multiplies by `1000`.

This is useful for UI/preview, but on-chain mint uses renderer score constants as canonical.

## Quick Summary
- Canonical mint randomness: on-chain helper with weighted picks + rerolls.
- Canonical rarity score: renderer constant-sum score by packed traits.
- Canonical ranking: score descending, then token ID ascending for ties.
- Commit-reveal path is removed from current contract surface.

## Visibility Note
- `Arctic White` background was adjusted from `#F8FBFF` to `#DDE8F8` so `Snow (White)` remains visible.
