const hre = require("hardhat");

async function main() {
  const contractAddress = "0x9858725b7e2e79A6DB4CEDa510854C48238357ff";
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
