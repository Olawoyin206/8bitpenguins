require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const rpcUrl =
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.ETH_SEPOLIA_RPC_URL ||
    process.env.BASE_SEPOLIA_RPC_URL ||
    process.env.VITE_RPC_URL;
  const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || "").trim();
  if (!rpcUrl) throw new Error("Missing RPC URL");
  if (!contractAddress) throw new Error("Missing CONTRACT_ADDRESS or VITE_CONTRACT_ADDRESS");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(
    contractAddress,
    [
      "function totalSupply() view returns (uint256)",
      "function tokenEvolved3D(uint256 tokenId) view returns (bool)",
      "function tokenURI(uint256 tokenId) view returns (string memory)"
    ],
    provider
  );

  const totalSupply = Number(await contract.totalSupply());
  let firstEvolved = 0;
  for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
    const evolved = await contract.tokenEvolved3D(tokenId);
    if (evolved) {
      firstEvolved = tokenId;
      break;
    }
  }

  if (!firstEvolved) {
    console.log(JSON.stringify({ totalSupply, evolvedTokenId: null }, null, 2));
    return;
  }

  const uri = await contract.tokenURI(firstEvolved);
  const prefix = "data:application/json;base64,";
  const metadata = uri.startsWith(prefix)
    ? JSON.parse(Buffer.from(uri.slice(prefix.length), "base64").toString("utf8"))
    : { raw: uri };

  console.log(JSON.stringify({ totalSupply, evolvedTokenId: firstEvolved, metadata }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
