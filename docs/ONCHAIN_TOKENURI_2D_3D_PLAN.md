# Onchain TokenURI 2D+3D Implementation Plan

## Goal
After evolve, each token's onchain `tokenURI` must always include both image references:
- `image_2d`
- `image_3d`

And the onchain display toggle must continue to control the active `image` field returned in `tokenURI`.

No frontend dependency for metadata truth.

## Current State (confirmed)
- Onchain toggle state already exists in [`contracts/8bitPenguins.sol`](../contracts/8bitPenguins.sol):
  - `toggleEvolvedDisplayMode(tokenId)`
  - `refreshExpiredDisplayMode(tokenId)`
  - `getTokenDisplayModeState(tokenId)`
  - `tokenDisplayMode`, `tokenDisplayModeExpiresAt`, auto-expire duration
- Evolve flow already preserves 2D source onchain for evolved tokens:
  - `_applyEvolveTo3D` stores `tokenOriginalImage[tokenId]` when needed
  - `_resolved2DImage` and `_resolved3DImage` already exist
- Gap: metadata builder currently only emits `image_3d` (conditional) and does not emit `image_2d`.

## Contract-Level Changes

### 1) Metadata payload must include both images
Update metadata output so revealed/evolved JSON includes:
- `image` (active display image, based on onchain toggle state)
- `image_2d` (resolved 2D source, if present)
- `image_3d` (resolved 3D source, if present)

Files:
- [`contracts/8bitPenguins.sol`](../contracts/8bitPenguins.sol)
- [`contracts/EightBitPenguinsMetadataBuilder.sol`](../contracts/EightBitPenguinsMetadataBuilder.sol)

Implementation detail:
- Extend `revealedMetadataJson(...)` signature to accept `image2D` alongside `activeImage` and `image3D`.
- In `tokenMetadataJson`, pass `image2D` and `image3D` to builder.
- Builder always emits `image_2d` if non-empty and `image_3d` if non-empty.

### 2) Keep toggle fully onchain
No frontend state authority. Toggle affects only onchain metadata `image` selection:
- default: 3D for evolved tokens
- temporary toggle: 2D until expiry
- expiry restores effective 3D mode

Existing functions already do this; no behavior change required unless we add metadata fields below.

### 3) Optional metadata transparency fields (recommended)
Add fields in JSON for indexers/UIs:
- `display_mode` (`"2d"` or `"3d"`)
- `display_mode_expires_at` (unix timestamp, `0` when not in temporary mode)

This is optional but recommended for debugging and marketplace consistency checks.

## Upgrade / Deployment Sequence
Because builder function signature changes, this must be rolled out carefully:

1. Deploy updated `EightBitPenguinsMetadataBuilder`.
2. Upgrade `EightBitPenguinsUpgradeable` implementation to version that calls new builder signature.
3. Call `setMetadataBuilder(newBuilderAddress)`.
4. Verify `tokenMetadataJson(tokenId)` on evolved token includes both `image_2d` and `image_3d`.
5. Run one toggle tx and re-check:
   - `image` flips as expected
   - `image_2d` and `image_3d` remain present

## Test Plan

### Unit/contract checks
- Evolved token metadata contains:
  - non-empty `image`
  - non-empty `image_2d`
  - non-empty `image_3d`
- Toggle to temporary 2D:
  - `image` == `image_2d`
  - `image_3d` unchanged
- After expiry:
  - `image` == `image_3d`
  - both `image_2d` and `image_3d` still present

### Regression checks
- Non-evolved token behavior unchanged.
- Unrevealed token behavior unchanged.
- Existing `animation_url` handling unchanged.

## Risks / Notes
- If contract is upgraded before builder address is updated, metadata calls can fail due ABI mismatch.
- Larger metadata JSON size may increase response bytes but remains valid for base64 data URI output.
- OpenSea reads `image`/`animation_url`; custom fields (`image_2d`, `image_3d`) are extra metadata fields.

## Acceptance Criteria
- After evolve, onchain `tokenURI` JSON contains both `image_2d` and `image_3d` for each evolved token.
- Onchain toggle changes active `image` while keeping both image fields present.
- No frontend logic is required for metadata correctness.
