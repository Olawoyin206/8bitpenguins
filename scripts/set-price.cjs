const hre = require("hardhat");

async function main() {
  const contractAddress = "0x1B1769F54c70A50EB8F4F755249C39Af3Cb69528";
  
  const contract = await hre.ethers.getContractAt("PixelPenguins", contractAddress);
  
  const tx = await contract.setMintPrice(0);
  console.log("Transaction sent:", tx.hash);
  await tx.wait();
  
  const price = await contract.mintPrice();
  console.log("Mint price set to:", price.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
