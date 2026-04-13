const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

async function main() {
  const proxy = getContractAddress();
  const artifact = await hre.artifacts.readArtifact("EightBitPenguinsUpgradeable");
  const contract = new hre.ethers.Contract(proxy, artifact.abi, hre.ethers.provider);
  const network = await hre.ethers.provider.getNetwork();

  const maxSupply = await contract.MAX_SUPPLY();
  const totalSupply = await contract.totalSupply();
  const revealed = await contract.revealed();
  const rarityFinalized = await contract.rarityFinalized();

  console.log("Network chainId:", network.chainId.toString());
  console.log("Proxy:", proxy);
  console.log("MAX_SUPPLY:", maxSupply.toString());
  console.log("totalSupply:", totalSupply.toString());
  console.log("revealed:", revealed);
  console.log("rarityFinalized:", rarityFinalized);
  console.log("setFinalRarityData selector live:", typeof contract.setFinalRarityData === "function");
  console.log("finalizeRarity selector live:", typeof contract.finalizeRarity === "function");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
