const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

async function main() {
  const proxyAddress = getContractAddress();
  const receiver = process.env.ROYALTY_RECEIVER || "";
  const feeBps = Number(process.env.ROYALTY_BPS || "0");

  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) {
    throw new Error("ROYALTY_BPS must be an integer between 0 and 10000");
  }
  if (feeBps > 0 && !hre.ethers.isAddress(receiver)) {
    throw new Error("ROYALTY_RECEIVER must be a valid address when ROYALTY_BPS > 0");
  }

  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", proxyAddress);
  const nextReceiver = feeBps > 0 ? hre.ethers.getAddress(receiver) : hre.ethers.ZeroAddress;

  console.log("Proxy:", proxyAddress);
  console.log("Current royalty receiver:", await contract.royaltyReceiver());
  console.log("Current royalty bps:", String(await contract.royaltyFeeBps()));
  console.log("Setting receiver:", nextReceiver);
  console.log("Setting bps:", String(feeBps));

  const tx = await contract.setRoyaltyInfo(nextReceiver, feeBps);
  console.log("Tx:", tx.hash);
  await tx.wait();

  console.log("Updated royalty receiver:", await contract.royaltyReceiver());
  console.log("Updated royalty bps:", String(await contract.royaltyFeeBps()));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
