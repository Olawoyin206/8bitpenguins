# Explorer Function Cleanup List

These are functions you can remove from explorer exposure (by removing/merging in a future contract upgrade), while keeping core mint + ERC721 behavior.

## Removable

- `tokenImage(uint256)`
- `tokenOriginalImage(uint256)`
- `tokenEvolvedImage(uint256)`
- `tokenInteractiveModel(uint256)`
- `tokenName(uint256)`
- `tokenAttributes(uint256)`
- `tokenRarityScore(uint256)`
- `tokenFinalRarityRank(uint256)`
- `tokenMetadataJson(uint256)`
- `mintedPerWallet(address)`
- `phaseMintedPerWallet(uint256,address)`
- `phaseWhitelistCount(uint256)`
- `getPhaseWhitelist(uint256)`
- `isPhaseWhitelisted(uint256,address)`
- `getTokenDisplayModeState(uint256)`
- `publicDisplayToggleDuration()`
- `refreshExpiredDisplayMode(uint256)`
- `setPublicDisplayToggleDuration(uint256)`
- `configureMintMode(bool)`
- `directMintEnabled()`
- `mintModeConfigured()`
- `getOnchainRenderer()`
- `setOnchainRenderer(address)`
- `setMetadataBuilder(address)`
- `setRandomnessHelper(address)`
- `setFinalRarityData(uint256[],uint256[],uint256[])`
- `finalizeRarity()`
- `rarityFinalized()`
- `rarityRank(uint256)`
- `setPlaceholderImage(string)`
- `setRevealed(bool)`
- `deletePhase(uint256)`

## Optional Merge (Reduce More)

Keep one evolve method and remove the others:

- `evolveTo3DImageOnly(uint256,string)`
- `evolveTo3DWithModel(uint256,string,string,string)`
- `evolveTo3DImageOnlyWithModel(uint256,string,string)`
