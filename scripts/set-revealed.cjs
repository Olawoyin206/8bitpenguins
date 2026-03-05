const hre = require("hardhat");

async function main() {
  const contractAddress = "0x74583D54B3c42ab08c8031d849B350Ccf425060c";
  const contract = await hre.ethers.getContractAt("PixelPenguins", contractAddress);
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
