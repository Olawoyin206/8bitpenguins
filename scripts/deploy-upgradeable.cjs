const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying upgradeable PixelPenguins contract...");
  console.log("Deployer:", deployer.address);

  // Deploy implementation
  const PixelPenguins = await hre.ethers.getContractFactory("PixelPenguinsUpgradeable");
  const implementation = await PixelPenguins.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();
  
  console.log("Implementation deployed to:", implementationAddress);

  // Deploy proxy admin
  const ProxyAdmin = await hre.ethers.getContractFactory("contracts/ProxyAdmin.sol:ProxyAdmin");
  const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
  await proxyAdmin.waitForDeployment();
  const proxyAdminAddress = await proxyAdmin.getAddress();
  
  console.log("Proxy Admin deployed to:", proxyAdminAddress);

  // Deploy transparent proxy
  const TransparentUpgradeableProxy = await hre.ethers.getContractFactory("contracts/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy");
  
  // Encode the initialize function call
  const initializeData = implementation.interface.encodeFunctionData("initialize", []);
  
  const proxy = await TransparentUpgradeableProxy.deploy(
    implementationAddress,
    proxyAdminAddress,
    initializeData
  );
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  
  console.log("Proxy deployed to:", proxyAddress);
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Implementation:", implementationAddress);
  console.log("Proxy (use this):", proxyAddress);
  console.log("ProxyAdmin:", proxyAdminAddress);
  
  // Save addresses
  console.log("\nSave these addresses:");
  console.log("CONTRACT_ADDRESS=" + proxyAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
