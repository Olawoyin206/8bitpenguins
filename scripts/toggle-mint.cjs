const hre = require("hardhat");

async function main() {
  const contractAddress = "0x9858725b7e2e79A6DB4CEDa510854C48238357ff";
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
