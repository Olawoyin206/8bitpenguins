const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

function parseBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;

  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  throw new Error(`Invalid boolean for ${name}: ${raw}`);
}

async function main() {
  const proxyAddress = getContractAddress();
  const directMintEnabled = parseBooleanEnv("DIRECT_MINT_ENABLED", true);

  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", proxyAddress);
  console.log("Proxy:", proxyAddress);
  console.log("Applying mint mode config...");
  console.log("directMintEnabled:", directMintEnabled);

  const tx = await contract.configureMintMode(directMintEnabled);
  console.log("Tx:", tx.hash);
  await tx.wait();

  console.log("Mint mode updated");
  console.log("mintModeConfigured:", await contract.mintModeConfigured());
  console.log("directMintEnabled:", await contract.directMintEnabled());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
