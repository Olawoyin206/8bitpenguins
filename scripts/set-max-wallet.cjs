const hre = require("hardhat");

async function main() {
  const contractAddress = "0xab5ffaa03F6A2713b854a3144086e746303b12a3";
  
  const contract = await hre.ethers.getContractAt("PixelPenguins", contractAddress);
  
  // Set max per wallet to a very high number (50 = total supply)
  const tx = await contract.setMaxPerWallet(50);
  console.log("Transaction sent:", tx.hash);
  await tx.wait();
  
  const max = await contract.MAX_PER_WALLET();
  console.log("MAX_PER_WALLET set to:", max.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
