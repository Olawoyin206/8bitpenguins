# Mainnet Migration Runbook

## Goal
Move the 8bit Penguins stack from Sepolia-focused setup to Ethereum Mainnet safely, with a repeatable process and rollback path.

## Current State (Before Migration)
- App/network config is Sepolia-hardcoded in `src/contractConfig.js`.
- Hardhat config defines only `sepolia` network.
- Most npm deploy scripts target `--network sepolia`.
- `scripts/deploy-onchain-stack-direct.cjs` uses `.openzeppelin/sepolia.json` directly.
- `scripts/verify-on-etherscan-direct.cjs` hardcodes `CHAIN_ID = "11155111"`.
- Lint currently fails (`npm run lint`), while build/tests pass.

Do not launch mainnet from this state.

## Phase 1: Preflight (Mandatory)
1. Create a release branch:
   - `git checkout -b release/mainnet-migration`
2. Ensure clean working tree for release:
   - `git status`
3. Run quality gates:
   - `npm run build`
   - `npm run test`
   - `npm run lint`
4. Fix lint errors before mainnet launch.
5. Freeze feature changes until migration is complete.

## Phase 2: Mainnet Configuration Changes
Update code to remove Sepolia hardcoding.

### A) Hardhat network config
In `hardhat.config.cjs`, add `mainnet`:
- `url: process.env.ETH_MAINNET_RPC_URL`
- `accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []`
- `chainId: 1`

### B) Frontend runtime chain config
In `src/contractConfig.js`, make these env-driven:
- RPC URL
- chain id hex
- chain name
- block explorer URL

Recommended env keys:
- `VITE_RPC_URL`
- `VITE_CHAIN_ID_HEX` (`0x1`)
- `VITE_CHAIN_NAME` (`Ethereum Mainnet`)
- `VITE_BLOCK_EXPLORER_URL` (`https://etherscan.io`)

### C) Direct deploy script manifest path
In `scripts/deploy-onchain-stack-direct.cjs`:
- Replace hardcoded `.openzeppelin/sepolia.json` with env-driven network manifest.
- Example pattern:
  - `const OZ_NETWORK = process.env.OZ_NETWORK || "sepolia"`
  - `const MANIFEST_PATH = path.join(ROOT, ".openzeppelin", `${OZ_NETWORK}.json`)`

### D) Verification script chain id
In `scripts/verify-on-etherscan-direct.cjs`:
- Replace hardcoded `CHAIN_ID = "11155111"` with env-driven value.
- Example:
  - `const CHAIN_ID = process.env.ETHERSCAN_CHAIN_ID || "11155111"`

### E) NPM scripts for mainnet
Add mainnet script variants in `package.json`, e.g.:
- `deploy:upgradeable:mainnet`
- `upgrade:contract:mainnet`
- `verify:current:mainnet`
- `check:proxy:mainnet`
- `set:onchain-renderer:mainnet`
- `set:royalty:mainnet`
- `set:mint-mode:mainnet`

## Phase 3: Environment Setup
Create `.env.mainnet` (do not commit secrets):

```bash
PRIVATE_KEY=0x...
ETH_MAINNET_RPC_URL=https://...
ETHERSCAN_API_KEY=...
ETHERSCAN_CHAIN_ID=1

CONTRACT_ADDRESS=
VITE_CONTRACT_ADDRESS=
VITE_RPC_URL=https://...
VITE_CHAIN_ID_HEX=0x1
VITE_CHAIN_NAME=Ethereum Mainnet
VITE_BLOCK_EXPLORER_URL=https://etherscan.io

DIRECT_MINT_ENABLED=true
ROYALTY_RECEIVER=0x...
ROYALTY_BPS=...
```

For Vercel production, set the same `VITE_*` vars in project settings.

## Phase 4: Deployment Sequence (Mainnet)
Use a funded deployer that owns ProxyAdmin.

1. Deploy proxy (if new mainnet launch):
   - `npx hardhat run scripts/deploy-upgradeable.cjs --network mainnet`
2. Save proxy address:
   - Set both `CONTRACT_ADDRESS` and `VITE_CONTRACT_ADDRESS`.
3. Deploy/attach on-chain renderer stack and wire contract:
   - `node scripts/deploy-onchain-stack-direct.cjs`
4. Configure mint mode:
   - `npx hardhat run scripts/set-mint-randomness.cjs --network mainnet`
5. Configure royalty:
   - `npx hardhat run scripts/set-royalty.cjs --network mainnet`
6. Verify implementation + proxy:
   - `npx hardhat run scripts/verify-current.cjs --network mainnet`
   - `node scripts/verify-on-etherscan-direct.cjs` (if needed)
7. Sanity-check live proxy pointers/state:
   - `npx hardhat run scripts/check-proxy-current.cjs --network mainnet`

## Phase 5: App + Admin Cutover
1. Deploy frontend with mainnet `VITE_*` vars.
2. Open Admin page and confirm:
- Owner wallet recognized
- Phase controls work
- Whitelist read/write works
- Remove-all-in-phase works
3. Keep mint paused until final smoke tests complete.

## Phase 6: Smoke Tests Before Opening Mint
1. Wallet connect and chain switch behavior.
2. Read contract state in UI (supply, price, phase).
3. Mint test with production wallet.
4. Evolve flow and tokenURI rendering checks.
5. Etherscan Read/Write as Proxy works.
6. OpenSea metadata displays expected fields.
7. Captcha and proof submission path works end-to-end.

## Rollback Plan
If anything fails after cutover:
1. Pause mint immediately (`toggleMint`).
2. Revert frontend env to last stable deployment.
3. If issue is implementation logic, upgrade proxy to previous verified implementation.
4. Announce maintenance window and resume only after smoke tests pass.

## Final Go/No-Go Checklist
- [ ] Mainnet network/config not hardcoded to Sepolia
- [ ] Build/test/lint all pass
- [ ] Proxy + implementation verified on Etherscan
- [ ] Renderer wired and tokenURI validated
- [ ] Admin controls and whitelist operations validated
- [ ] Frontend production env points to mainnet
- [ ] Mint paused until final approval
- [ ] Rollback addresses and commands documented
