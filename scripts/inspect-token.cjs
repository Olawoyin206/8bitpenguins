const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

function decodeTokenUriJson(tokenUri) {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) {
    return { raw: tokenUri };
  }
  const json = Buffer.from(tokenUri.slice(prefix.length), "base64").toString("utf8");
  return JSON.parse(json);
}

async function main() {
  const tokenId = Number(process.env.TOKEN_ID || process.argv[2] || 0);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    throw new Error("Provide TOKEN_ID env var or numeric arg");
  }

  const contractAddress = getContractAddress();
  const c = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", contractAddress);

  const [owner, revealed, evolved, attrsRaw, image, originalImage, evolvedImage, model] = await Promise.all([
    c.ownerOf(tokenId),
    c.revealed(),
    c.tokenEvolved3D(tokenId),
    c.tokenAttributes(tokenId),
    c.tokenImage(tokenId),
    c.tokenOriginalImage(tokenId),
    c.tokenEvolvedImage(tokenId),
    c.tokenInteractiveModel(tokenId),
  ]);

  const tokenUri = await c.tokenURI(tokenId);
  const metadata = decodeTokenUriJson(tokenUri);

  console.log(JSON.stringify({
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
  }, null, 2));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
