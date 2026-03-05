const hre = require("hardhat");

async function main() {
  const proxyAddress = "0x74583D54B3c42ab08c8031d849B350Ccf425060c";
  const Factory = await hre.ethers.getContractFactory("EightBitPenguinsUpgradeable");

  console.log("Upgrading proxy:", proxyAddress);
  const upgraded = await hre.upgrades.upgradeProxy(proxyAddress, Factory, {
    kind: "transparent",
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
