const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

const EVOLVED_TOKEN_ID = 21;

function decodeTokenUriJson(tokenUri) {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) {
    throw new Error(`Unexpected tokenURI format: ${tokenUri.slice(0, 32)}`);
  }
  const json = Buffer.from(tokenUri.slice(prefix.length), "base64").toString("utf8");
  return JSON.parse(json);
}

async function main() {
  const contractAddress = getContractAddress();
  const c = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", contractAddress);

  const tokenUri = await c.tokenURI(EVOLVED_TOKEN_ID);
  const metadata = decodeTokenUriJson(tokenUri);

  console.log("contract:", contractAddress);
  console.log("tokenId:", EVOLVED_TOKEN_ID);
  console.log(
    JSON.stringify(
      {
        name: metadata.name,
        revealed: metadata.revealed,
        evolved_3d: metadata.evolved_3d,
        image: metadata.image,
        image_3d: metadata.image_3d,
        animation_url: metadata.animation_url,
        attributes: metadata.attributes,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
