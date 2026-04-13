# 8bit Penguins Mint App

Frontend + Hardhat workspace for minting and evolving `8bit Penguins` on Ethereum Mainnet.

## Active Contract

- Solidity source: `contracts/8bitPenguins.sol`
- Contract type: `EightBitPenguinsUpgradeable`
- Frontend address source of truth: `VITE_CONTRACT_ADDRESS` in `.env`
- Legacy `PixelPenguins` contract sources/scripts have been removed.

## App Commands

- `npm run dev` - Start full local stack (Vite + local API)
- `npm run dev:web` - Start Vite only
- `npm run dev:api` - Start local API only
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run lint` - Lint source

## Contract Commands

- `npm run deploy` / `npm run deploy:upgradeable` - Deploy new upgradeable proxy (Ethereum Mainnet)
- `npm run upgrade:contract` - Upgrade existing proxy implementation (Ethereum Mainnet)
- `npm run verify:current` - Verify currently configured proxy on Etherscan (Ethereum Mainnet)
- `npm run check:proxy` - Print proxy/admin/implementation and key state (Ethereum Mainnet)
- `npm run deploy:upgradeable:sepolia` / `npm run upgrade:contract:sepolia` / `npm run verify:current:sepolia` / `npm run check:proxy:sepolia` - Explicit Sepolia flows

## Script Layout

- `scripts/` contains active operational scripts only.
- `scripts/legacy/` contains historical/debug scripts retained for reference.

## Notes

- Unrevealed placeholder is configured on-chain via `set-placeholder.cjs`.
- Keep `VITE_CONTRACT_ADDRESS` and `CONTRACT_ADDRESS` in `.env` aligned.
- For Vercel, set project root to `mint-app`.
- IPFS upload API requires `PINATA_JWT` (server-side env) and origin allowlist config via `ALLOWED_ORIGINS` / `ALLOWED_ORIGIN_SUFFIXES`.
