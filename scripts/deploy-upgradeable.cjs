const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying upgradeable 8bit Penguins contract...");
  console.log("Deployer:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("EightBitPenguinsUpgradeable");
  const proxy = await hre.upgrades.deployProxy(Factory, [], {
    initializer: "initialize",
    kind: "transparent",
  });
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Proxy (use this):", proxyAddress);

  try {
    const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Implementation:", implementationAddress);
  } catch (e) {
    console.log("Implementation read skipped:", e?.message || e);
  }

  try {
    const proxyAdminAddress = await hre.upgrades.erc1967.getAdminAddress(proxyAddress);
    console.log("ProxyAdmin:", proxyAdminAddress);
  } catch (e) {
    console.log("ProxyAdmin read skipped:", e?.message || e);
  }

  console.log("CONTRACT_ADDRESS=" + proxyAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
