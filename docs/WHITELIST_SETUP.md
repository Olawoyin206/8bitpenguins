# Off-Chain Whitelist Guide (Mainnet + Mint Gate)

## 1) How This Whitelist Works

This project uses **off-chain whitelist sheets** as source of truth, not on-chain wallet storage.

Flow:

1. User opens Mint page and selects quantity.
2. Frontend calls `/api/whitelist-proof` with:
   - wallet
   - active `phaseId`
   - mint gate contract address
3. API checks local whitelist snapshot for that phase (no live sheet read at request time).
4. If wallet is eligible, API returns:
   - `maxAllowance`
   - `deadline`
   - `signature`
5. Frontend mints through gate:
   - `mint(quantity, maxAllowance, deadline, signature)`

If a phase does not require signature, mint works without proof.

Snapshot lifecycle:

1. Sheets remain source of truth.
2. Run `npm run whitelist:sync` to pull sheets + phase metadata and build `cache/whitelist-snapshot.json`.
3. `/api/whitelist-proof` reads that snapshot for ultra-fast eligibility checks.

## 2) Contracts Used

- Core NFT contract (mainnet): `0xC15C47C75baAB1D22954DC5E814B520FdE809729`
- Mint gate contract: set your deployed gate address in env.

Phase controls + whitelist signature checks live on the **gate**.
NFT/evolve logic lives on **core**.

## 3) Required Environment Variables

Add these in your `.env` / deployment env:

```env
# Frontend
VITE_CONTRACT_ADDRESS=0xC15C47C75baAB1D22954DC5E814B520FdE809729
VITE_MINT_GATE_ADDRESS=0xYOUR_MINT_GATE_ADDRESS

# Admin/API
ADMIN_CONTRACT_ADDRESS=0xC15C47C75baAB1D22954DC5E814B520FdE809729
ADMIN_MINT_GATE_ADDRESS=0xYOUR_MINT_GATE_ADDRESS

# Proof signer (must match on-chain whitelistSigner on gate)
WHITELIST_SIGNER_PRIVATE_KEY=0x...
WHITELIST_GATE_ADDRESS=0xYOUR_MINT_GATE_ADDRESS

# Optional tuning
WHITELIST_PROOF_TTL_SECONDS=900
WHITELIST_SNAPSHOT_FILE=cache/whitelist-snapshot.json
WHITELIST_SNAPSHOT_CACHE_TTL_MS=60000
WHITELIST_BATCH_CACHE_TTL_MS=120000
WHITELIST_CHAIN_ID=1
```

Phase sheets map:

```env
WHITELIST_PHASE_SHEETS={"0":"https://docs.google.com/spreadsheets/d/.../edit#gid=0","1":"https://docs.google.com/spreadsheets/d/.../edit#gid=12345"}
```

Or use one workbook URL and let the API auto-match phase names to sheet tabs:

```env
WHITELIST_WORKBOOK_URL=https://docs.google.com/spreadsheets/d/.../edit?usp=sharing
```

Then generate snapshot:

```bash
npm run whitelist:sync
```

Optional:

```bash
node scripts/sync-whitelist-snapshot.mjs --contract 0x... --rpc https://... --out cache/whitelist-snapshot.json
```

## 4) Google Sheet Rules

- Sheet/tab must be publicly readable (or API-accessible URL).
- API extracts all valid wallet addresses from cells.
- Optional per-wallet allowance can be included as a positive number in row cells.
- If no allowance is provided in row, fallback is:
  - phase `maxPerWallet`, else
  - global `MAX_PER_WALLET`, else
  - `1`

## 5) On-Chain Gate Setup

1. Link gate to core (if not already linked) via core owner:
   - `setMintGate(gateAddress)`
2. On gate, set signer:
   - `setWhitelistSigner(0xSignerAddress)`
3. For whitelist phases, enable signature requirement:
   - `setPhaseWhitelistSignatureRequirement(phaseId, true)`
4. For open/public phases, disable signature requirement:
   - `setPhaseWhitelistSignatureRequirement(phaseId, false)`

## 6) Phase Plan (Your Case)

Recommended phase IDs:

- `0` Team
- `1` GTD
- `2` Communities Phase 1
- `3` Communities Phase 2
- `4` Communities Phase 3
- `5` Communities Phase 4
- `6` FCFS

Set each phase in gate, then map each phase ID to its own sheet URL in `WHITELIST_PHASE_SHEETS`.

## 7) Admin Whitelist Manager Usage

You can still use Admin page for:

- creating/updating phases
- toggling signature requirement per phase
- updating whitelist signer
- importing sheets for operational checks

But your **source of truth remains off-chain sheets** used by `/api/whitelist-proof`.

## 8) Quick Test Checklist

1. `VITE_MINT_GATE_ADDRESS` is set.
2. Gate `whitelistSigner` equals API signer wallet address.
3. `WHITELIST_PHASE_SHEETS` contains active phase ID.
4. Wallet exists in that phase sheet.
5. Mint call succeeds with returned signature payload.
6. `cache/whitelist-snapshot.json` is present and fresh (re-run `npm run whitelist:sync` after sheet updates).

## 9) Common Failures

- `Wallet is not eligible for this phase`
  - address missing in sheet or wrong sheet mapped to phase
- `Invalid whitelist proof signature`
  - signer mismatch between API private key and gate `whitelistSigner`
- `Whitelist signature expired`
  - increase `WHITELIST_PROOF_TTL_SECONDS` or retry mint quickly
- `Whitelist sheet is not configured for phase`
  - missing `WHITELIST_PHASE_SHEETS` entry for active phase
- `Phase X missing in whitelist snapshot`
  - run `npm run whitelist:sync` and redeploy/restart API
