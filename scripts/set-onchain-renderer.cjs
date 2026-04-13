const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

async function main() {
  const proxyAddress = getContractAddress();
  const rendererAddress = (process.env.ONCHAIN_RENDERER_ADDRESS || "").trim();

  if (!rendererAddress) {
    throw new Error("Missing ONCHAIN_RENDERER_ADDRESS in environment");
  }

  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", proxyAddress);
  const tx = await contract.setOnchainRenderer(rendererAddress);
  console.log("Setting on-chain renderer:", rendererAddress);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("On-chain renderer updated");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
