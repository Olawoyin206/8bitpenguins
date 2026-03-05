const hre = require("hardhat");

async function main() {
  const contractAddress = "0xB9C639d00BbF3648361A9a53b6588AF31f39E31b";
  const contract = await hre.ethers.getContractAt("PixelPenguins", contractAddress);
  
  const tokenURI = await contract.tokenURI(1);
  console.log("Token URI:", tokenURI);
  
  // Decode base64 JSON
  const base64Data = tokenURI.replace("data:application/json;base64,", "");
  const jsonBuffer = Buffer.from(base64Data, "base64");
  const jsonStr = jsonBuffer.toString("utf-8");
  console.log("\nJSON:", jsonStr);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
