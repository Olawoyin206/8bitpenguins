# Royalty Implementation (ERC-2981)

This project now includes on-chain royalty signaling in the NFT contract.

## What Was Added

File: `contracts/8bitPenguins.sol`

- Added storage:
  - `address public royaltyReceiver`
  - `uint96 public royaltyFeeBps`
- Added owner setter:
  - `setRoyaltyInfo(address receiver, uint96 feeBps)`
- Added royalty view:
  - `royaltyInfo(uint256 tokenId, uint256 salePrice) -> (receiver, amount)`
- Added ERC-2981 interface support in `supportsInterface`.
- Added event and validation errors for royalty updates.

File: `scripts/set-royalty.cjs`

- Owner script to set royalty receiver and bps on the proxy contract.

File: `package.json`

- Added npm script:
  - `npm run set:royalty`

## How Royalty Amount Is Calculated

`royaltyAmount = salePrice * royaltyFeeBps / 10000`

Examples:

- `500` bps = `5%`
- `750` bps = `7.5%`

## Important Behavior

ERC-2981 **does not force payment**. It only returns royalty info. Marketplace support/policy determines whether royalty is paid.

## Deployment / Upgrade Flow

1. Upgrade contract implementation (proxy upgrade as usual).
2. Set royalty info after upgrade (initializer will not rerun on existing proxy).

## Set Royalty (PowerShell)

```powershell
$env:ROYALTY_RECEIVER="0xYourPayoutAddress"
$env:ROYALTY_BPS="500"
npm run set:royalty
```

## Disable Royalty

```powershell
$env:ROYALTY_BPS="0"
npm run set:royalty
```

## Validation Rules

- `feeBps` must be between `0` and `10000`
- if `feeBps > 0`, receiver cannot be zero address

## Compile Verification Notes

- `hardhat compile` timed out in this environment (likely due slow Windows WASM/viaIR compile path).
- Contract compiles successfully via:

```powershell
npx solcjs contracts/8bitPenguins.sol --base-path . --include-path node_modules --bin --abi -o .tmp-solc-out
```

That produced ABI/bin output and only warnings (no errors).
