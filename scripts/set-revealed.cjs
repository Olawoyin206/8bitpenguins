const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

async function main() {
  const contractAddress = getContractAddress();
  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", contractAddress);
  const tx = await contract.setRevealed(true);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("revealed:", await contract.revealed());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
