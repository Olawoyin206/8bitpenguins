const hre = require("hardhat");

async function main() {
  const contractAddress = "0x74583D54B3c42ab08c8031d849B350Ccf425060c";
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
