const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

async function main() {
  const proxyAddress = getContractAddress();
  const Factory = await hre.ethers.getContractFactory("EightBitPenguinsUpgradeable");

  console.log("Upgrading proxy:", proxyAddress);
  try {
    await hre.upgrades.forceImport(proxyAddress, Factory, {
      kind: "transparent",
    });
    console.log("Registered existing proxy in local manifest");
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.toLowerCase().includes("already")) {
      console.warn("forceImport warning:", message);
    }
  }
  const upgraded = await hre.upgrades.upgradeProxy(proxyAddress, Factory, {
    kind: "transparent",
    redeployImplementation: "always",
  });
  await upgraded.waitForDeployment();

  const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Upgrade complete");
  console.log("Proxy:", proxyAddress);
  console.log("Implementation:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
