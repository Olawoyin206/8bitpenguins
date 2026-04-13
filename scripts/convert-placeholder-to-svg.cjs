const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_JPG_PATH = path.resolve(PROJECT_ROOT, "placeholder.jpg");
const OUTPUT_SVG_PATH = path.resolve(PROJECT_ROOT, "public", "placeholder.svg");

function buildSvgFromJpgBase64(base64Jpg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <image href="data:image/jpeg;base64,${base64Jpg}" x="0" y="0" width="400" height="400" preserveAspectRatio="xMidYMid slice"/>
</svg>
`;
}

function ensureSourceImage() {
  if (!fs.existsSync(SOURCE_JPG_PATH)) {
    throw new Error(`Missing source image: ${SOURCE_JPG_PATH}`);
  }
  return fs.readFileSync(SOURCE_JPG_PATH);
}

function main() {
  const jpgBytes = ensureSourceImage();
  const jpgBase64 = jpgBytes.toString("base64");
  const svg = buildSvgFromJpgBase64(jpgBase64);

  fs.mkdirSync(path.dirname(OUTPUT_SVG_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_SVG_PATH, svg, "utf8");

  console.log(`Wrote: ${OUTPUT_SVG_PATH}`);
  console.log(`SVG chars: ${svg.length.toLocaleString()}`);
}

main();
