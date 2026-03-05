const hre = require("hardhat");

async function main() {
  const contractAddress = "0xCc362C9812DFd88c7B476eeB425830Cc40d2C24D";
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
