const hre = require("hardhat");

async function main() {
  const contractAddress = "0x0a4a69Addbc1E5C431F2757eb442191e19BD4929";
  const contract = await hre.ethers.getContractAt("PixelPenguins", contractAddress);
  
  const totalSupply = await contract.totalSupply();
  console.log("Total supply:", totalSupply.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
