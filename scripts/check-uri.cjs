const hre = require("hardhat");

async function main() {
  const contractAddress = "0xab5ffaa03F6A2713b854a3144086e746303b12a3";
  
  const contract = await hre.ethers.getContractAt("PixelPenguins", contractAddress);
  
  const supply = await contract.totalSupply();
  console.log("Total supply:", supply.toString());
  
  if (supply > 0n) {
    const uri = await contract.tokenURI(1);
    console.log("Token URI for #1:", uri);
    console.log("Length:", uri.length);
    console.log("Starts with:", uri.slice(0, 30));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
