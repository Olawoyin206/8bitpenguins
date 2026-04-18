# 8bit Penguins Mint App

Frontend + Hardhat workspace for minting and evolving `8bit Penguins` on Ethereum Mainnet.

## Active Contract

- Solidity source: `contracts/8bitPenguins.sol`
- Contract type: `EightBitPenguinsUpgradeable`
- Frontend address source of truth: `VITE_CONTRACT_ADDRESS` in `.env`
- Optional mint gate (phase + whitelist signatures): `contracts/EightBitPenguinsMintGate.sol`
- Legacy `PixelPenguins` contract sources/scripts have been removed.

## App Commands

- `npm run dev` - Start full local stack (Vite + local API)
- `npm run dev:web` - Start Vite only
- `npm run dev:api` - Start local API only
- `npm run build` - Production build
- `npm run whitelist:sync` - Build whitelist snapshot from sheets + current gate phases
- `npm run preview` - Preview production build
- `npm run lint` - Lint source

## Contract Commands

- `npm run deploy` / `npm run deploy:upgradeable` - Deploy new upgradeable proxy (Ethereum Mainnet)
- `npm run upgrade:contract` - Upgrade existing proxy implementation (Ethereum Mainnet)
- `npm run deploy:mint-gate` - Deploy mint gate and link to core (Ethereum Mainnet)
- `npm run verify:current` - Verify currently configured proxy on Etherscan (Ethereum Mainnet)
- `npm run check:proxy` - Print proxy/admin/implementation and key state (Ethereum Mainnet)
- `npm run deploy:upgradeable:sepolia` / `npm run deploy:mint-gate:sepolia` / `npm run upgrade:contract:sepolia` / `npm run verify:current:sepolia` / `npm run check:proxy:sepolia` - Explicit Sepolia flows

## Script Layout

- `scripts/` contains active operational scripts only.
- `scripts/legacy/` contains historical/debug scripts retained for reference.

## Notes

- Unrevealed placeholder is configured on-chain via `set-placeholder.cjs`.
- Keep `VITE_CONTRACT_ADDRESS` and `CONTRACT_ADDRESS` in `.env` aligned.
- For Vercel, set project root to `mint-app`.
- IPFS upload API requires `PINATA_JWT` (server-side env) and origin allowlist config via `ALLOWED_ORIGINS` / `ALLOWED_ORIGIN_SUFFIXES`.

## Split Mint Architecture

- Core contract (`EightBitPenguinsUpgradeable`) keeps NFT + evolve logic.
- Mint gate (`EightBitPenguinsMintGate`) owns phase windows, prices, per-phase limits, and whitelist signature checks.
- Core exposes `gateMint(recipient, quantity)` restricted by `mintGate`.
- Mint UI uses `VITE_MINT_GATE_ADDRESS` when set; otherwise falls back to direct core mint.

## Off-Chain Whitelist (Signed Proof)

- No large wallet list needs to be uploaded on-chain.
- API route `/api/whitelist-proof` reads local snapshot + returns signature proof for eligible wallets.
- Generate snapshot after any sheet update: `npm run whitelist:sync`.
- Signatures are bound to mint contract (`WHITELIST_GATE_ADDRESS` / request `contract` param).
- Required env vars:
  - `WHITELIST_SIGNER_PRIVATE_KEY`
  - `WHITELIST_PHASE_SHEETS` (JSON map of phase IDs -> sheet URLs)
  - `WHITELIST_GATE_ADDRESS` (mint gate address)
  - Optional: `WHITELIST_PROOF_TTL_SECONDS`, `WHITELIST_SNAPSHOT_FILE`, `WHITELIST_SNAPSHOT_CACHE_TTL_MS`, `WHITELIST_BATCH_CACHE_TTL_MS`, `WHITELIST_CHAIN_ID`
