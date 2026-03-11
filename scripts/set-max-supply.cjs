const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

async function main() {
  const proxyAddress = getContractAddress();
  const nextMaxSupply = BigInt(process.env.NEW_MAX_SUPPLY || "8888");

  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", proxyAddress);
  console.log("Proxy:", proxyAddress);
  console.log("Current MAX_SUPPLY:", String(await contract.MAX_SUPPLY()));
  console.log("Setting MAX_SUPPLY to:", String(nextMaxSupply));

  const tx = await contract.setMaxSupply(nextMaxSupply);
  console.log("Tx:", tx.hash);
  await tx.wait();

  console.log("Updated MAX_SUPPLY:", String(await contract.MAX_SUPPLY()));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
