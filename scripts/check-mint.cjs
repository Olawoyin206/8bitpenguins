const hre = require("hardhat");

async function main() {
  const PixelPenguins = await hre.ethers.getContractFactory("PixelPenguins");
  const contract = PixelPenguins.attach("0xa9BE911730dC6aa94C1f813298Ab60528F722c30");
  
  const mintActive = await contract.mintActive();
  console.log("mintActive:", mintActive);
  
  if (!mintActive) {
    console.log("Enabling mint...");
    const tx = await contract.toggleMint();
    await tx.wait();
    console.log("Mint enabled!");
    console.log("mintActive:", await contract.mintActive());
  }
}

main().catch(console.error);
