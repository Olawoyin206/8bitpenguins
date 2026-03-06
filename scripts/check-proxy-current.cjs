const hre = require("hardhat");

async function main() {
  const proxyAddress = "0x9858725b7e2e79A6DB4CEDa510854C48238357ff";
  console.log("Proxy:", proxyAddress);

  try {
    const impl = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Implementation:", impl);
  } catch (e) {
    console.log("Implementation lookup failed:", e?.message || e);
  }

  try {
    const admin = await hre.upgrades.erc1967.getAdminAddress(proxyAddress);
    console.log("ProxyAdmin:", admin);
  } catch (e) {
    console.log("Admin lookup failed:", e?.message || e);
  }

  const c = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", proxyAddress);
  console.log("owner:", await c.owner());
  console.log("revealed:", await c.revealed());
  console.log("mintActive:", await c.mintActive());
  console.log("totalSupply:", (await c.totalSupply()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
