const hre = require("hardhat");

async function main() {
  console.log("Deploying PixelPenguinsUpgradeable implementation...");
  
  const PixelPenguins = await hre.ethers.getContractFactory("contracts/PixelPenguinsUpgradeable.sol:PixelPenguins");
  const impl = await PixelPenguins.deploy();
  await impl.waitForDeployment();
  
  const implAddress = await impl.getAddress();
  console.log("Implementation deployed to:", implAddress);
  
  // Initialize the implementation
  console.log("Initializing...");
  const tx = await impl.initialize();
  await tx.wait();
  console.log("Initialized!");
  
  console.log("\n=== Implementation Address ===");
  console.log(implAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
