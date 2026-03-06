const hre = require("hardhat");

async function main() {
  const contractAddress = "0x9858725b7e2e79A6DB4CEDa510854C48238357ff";
  const c = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", contractAddress);
  const supply = await c.totalSupply();
  const revealed = await c.revealed();
  console.log("contract:", contractAddress);
  console.log("totalSupply:", supply.toString());
  console.log("revealed:", revealed);

  if (supply > 0n) {
    const meta = await c.tokenMetadataJson(1);
    console.log("token #1 metadata:", meta);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
