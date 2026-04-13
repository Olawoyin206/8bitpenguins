const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_JPG_PATH = path.resolve(PROJECT_ROOT, "placeholder.jpg");
const OUTPUT_SVG_PATH = path.resolve(PROJECT_ROOT, "public", "placeholder.svg");

function buildSvgFromJpgBase64(base64Jpg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <image href="data:image/jpeg;base64,${base64Jpg}" x="0" y="0" width="400" height="400" preserveAspectRatio="xMidYMid slice"/>
</svg>
`;
}

function getSvgFromPlaceholderJpg() {
  if (!fs.existsSync(SOURCE_JPG_PATH)) {
    throw new Error(`Missing source image: ${SOURCE_JPG_PATH}`);
  }
  const jpgBytes = fs.readFileSync(SOURCE_JPG_PATH);
  const jpgBase64 = jpgBytes.toString("base64");
  const svg = buildSvgFromJpgBase64(jpgBase64);

  fs.mkdirSync(path.dirname(OUTPUT_SVG_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_SVG_PATH, svg, "utf8");
  return svg;
}

function toSvgDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function main() {
  const contractAddress = getContractAddress();
  const svg = getSvgFromPlaceholderJpg();
  const dataUri = toSvgDataUri(svg);

  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", contractAddress);
  const tx = await contract.setPlaceholderImage(dataUri);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("Placeholder updated with SVG wrapper generated from placeholder.jpg");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
