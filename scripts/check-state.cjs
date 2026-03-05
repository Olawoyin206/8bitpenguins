const hre = require("hardhat");

async function main() {
  const contract = await hre.ethers.getContractAt("PixelPenguins", "0xB9C639d00BbF3648361A9a53b6588AF31f39E31b");
  
  const price = await contract.mintPrice();
  console.log("mintPrice:", price.toString());
  
  const active = await contract.mintActive();
  console.log("mintActive:", active);
  
  const supply = await contract.totalSupply();
  console.log("totalSupply:", supply.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
