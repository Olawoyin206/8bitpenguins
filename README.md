# 8bit Penguins Mint App

Frontend + Hardhat workspace for minting and evolving `8bit Penguins` on Ethereum Sepolia.

## Active Contract

- Solidity source: `contracts/8bitPenguins.sol`
- Contract type: `EightBitPenguinsUpgradeable`
- Frontend address source of truth: `VITE_CONTRACT_ADDRESS` in `.env`
- Legacy `PixelPenguins` contract sources/scripts have been removed.

## App Commands

- `npm run dev` - Start Vite dev server
- `npm run server` - Start identity verification API
- `npm run server:dev` - Start identity API in watch mode
- `npm run build` - Production build
- `npm run preview` - Preview production build
- `npm run lint` - Lint source

## Contract Commands

- `npm run deploy` / `npm run deploy:upgradeable` - Deploy new upgradeable proxy
- `npm run upgrade:contract` - Upgrade existing proxy implementation
- `npm run verify:current` - Verify currently configured proxy on Etherscan (Sepolia)
- `npm run check:proxy` - Print proxy/admin/implementation and key state

## Script Layout

- `scripts/` contains active operational scripts only.
- `scripts/legacy/` contains historical/debug scripts retained for reference.

## Notes

- Unrevealed placeholder is configured on-chain via `set-placeholder.cjs`.
- Keep `VITE_CONTRACT_ADDRESS` and `CONTRACT_ADDRESS` in `.env` aligned.
- For Vercel, set project root to `mint-app`.
- Puzzle identity gate is backed by `POST /api/identity/verify` (Express + Postgres).
- New game identity entries are forwarded to the Google Apps Script endpoint with `sheetName: "Game details"`.
- Duplicate X handles are blocked when wallet does not match the existing record.
