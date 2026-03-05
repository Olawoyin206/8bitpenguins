const hre = require("hardhat");

async function main() {
  const contract = await hre.ethers.getContractAt("PixelPenguins", "0x1B1769F54c70A50EB8F4F755249C39Af3Cb69528");
  
  const active = await contract.mintActive();
  console.log("mintActive:", active);
  
  if (!active) {
    const tx = await contract.toggleMint();
    console.log("Tx:", tx.hash);
    await tx.wait();
    console.log("Enabled!");
  }
  
  const newState = await contract.mintActive();
  console.log("Final:", newState);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
