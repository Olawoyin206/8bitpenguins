const hre = require("hardhat");

async function main() {
  const contractAddress = "0xCc362C9812DFd88c7B476eeB425830Cc40d2C24D";
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
