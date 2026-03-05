const hre = require("hardhat");

async function main() {
  console.log("Deploying PixelPenguins contract...");
  
  const PixelPenguins = await hre.ethers.getContractFactory("PixelPenguins");
  const contract = await PixelPenguins.deploy();
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`PixelPenguins deployed to: ${address}`);
  console.log(`Network: ${hre.network.name}`);
  
  if (process.env.BASESCAN_API_KEY) {
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [],
      });
      console.log("Contract verified on Basescan");
    } catch (error) {
      console.log("Verification failed (may need to verify manually):", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
