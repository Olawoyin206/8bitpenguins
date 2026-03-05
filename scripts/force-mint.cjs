const hre = require("hardhat");

async function main() {
  const PixelPenguins = await hre.ethers.getContractFactory("PixelPenguins");
  const contract = PixelPenguins.attach("0x975dA50f965339Ea368F5338BAefE896c2c79c9F");
  
  console.log("Before toggle, mintActive:", await contract.mintActive());
  
  const tx = await contract.toggleMint();
  const receipt = await tx.wait();
  console.log("Transaction confirmed, block:", receipt.blockNumber);
  
  console.log("After toggle, mintActive:", await contract.contract.mintActive ? await contract.mintActive() : "N/A");
  
  const mintActive2 = await contract.mintActive();
  console.log("Final mintActive:", mintActive2);
}

main().catch(console.error);
