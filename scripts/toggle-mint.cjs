const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

async function main() {
  const contractAddress = getContractAddress();
  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", contractAddress);

  const before = await contract.mintActive();
  console.log("Before:", before);

  const tx = await contract.toggleMint();
  console.log("Tx:", tx.hash);
  await tx.wait();

  const after = await contract.mintActive();
  console.log("After:", after);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
