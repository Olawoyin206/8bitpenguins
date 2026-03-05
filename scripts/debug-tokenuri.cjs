const hre = require("hardhat");

async function main() {
  const PixelPenguins = await hre.ethers.getContractFactory("PixelPenguins");
  const contract = PixelPenguins.attach("0x975dA50f965339Ea368F5338BAefE896c2c79c9F");
  
  const tokenId = 1;
  const tokenUri = await contract.tokenURI(tokenId);
  console.log("tokenURI:", tokenUri);
  
  const base64Data = tokenUri.replace('data:application/json;base64,', '');
  console.log("base64Data length:", base64Data.length);
  console.log("base64Data (first 100 chars):", base64Data.substring(0, 100));
}

main().catch(console.error);
