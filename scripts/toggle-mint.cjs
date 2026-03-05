const hre = require("hardhat");

async function main() {
  const contractAddress = "0x80221b01c8eB071E553D21D5cE96442402B131b4";
  const contract = await hre.ethers.getContractAt("PixelPenguins", contractAddress);

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
