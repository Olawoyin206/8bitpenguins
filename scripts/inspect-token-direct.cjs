require("dotenv").config();
const { ethers } = require("ethers");

function decodeTokenUriJson(tokenUri) {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) return { raw: tokenUri };
  const json = Buffer.from(tokenUri.slice(prefix.length), "base64").toString("utf8");
  return JSON.parse(json);
}

async function main() {
  const rpcUrl =
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.ETH_SEPOLIA_RPC_URL ||
    process.env.BASE_SEPOLIA_RPC_URL ||
    process.env.VITE_RPC_URL ||
    "https://ethereum-rpc.publicnode.com";
  const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || "").trim();
  const tokenId = Number(process.env.TOKEN_ID || process.argv[2] || 0);

  if (!contractAddress) throw new Error("Missing contract address");
  if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error("Provide TOKEN_ID env var or numeric arg");

  const abi = require("../src/abi/EightBitPenguinsUpgradeable.abi.json");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, abi, provider);

  const owner = await contract.ownerOf(tokenId);
  const revealed = await contract.revealed();
  const evolved = await contract.tokenEvolved3D(tokenId);
  const attrsRaw = await contract.tokenAttributes(tokenId);
  const image = await contract.tokenImage(tokenId);
  const originalImage = await contract.tokenOriginalImage(tokenId);
  const evolvedImage = await contract.tokenEvolvedImage(tokenId);
  const model = await contract.tokenInteractiveModel(tokenId);

  const tokenUri = await contract.tokenURI(tokenId);
  const metadata = decodeTokenUriJson(tokenUri);

  console.log(
    JSON.stringify(
      {
        contract: contractAddress,
        tokenId,
        owner,
        collectionRevealed: revealed,
        evolved3D: evolved,
        tokenImage: image,
        tokenOriginalImage: originalImage,
        tokenEvolvedImage: evolvedImage,
        tokenInteractiveModel: model,
        tokenAttributesRaw: attrsRaw,
        metadata,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
