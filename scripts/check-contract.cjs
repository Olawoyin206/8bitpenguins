const hre = require("hardhat");

async function main() {
  const contractAddress = "0xab5ffaa03F6A2713b854a3144086e746303b12a3";
  const contract = await hre.ethers.getContractAt("PixelPenguins", contractAddress);
  
  console.log("=== Contract State ===");
  console.log("mintActive:", await contract.mintActive());
  console.log("totalSupply:", Number(await contract.totalSupply()));
  console.log("MAX_SUPPLY:", Number(await contract.MAX_SUPPLY()));
  
  // Try calling toggle again
  console.log("\n=== Calling toggleMint() ===");
  const tx = await contract.toggleMint();
  console.log("Tx:", tx.hash);
  await tx.wait();
  
  console.log("\n=== After toggle ===");
  console.log("mintActive:", await contract.mintActive());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
