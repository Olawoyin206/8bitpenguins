const hre = require("hardhat");
const { createCanvas } = require("canvas");

async function main() {
  const contractAddress = "0x9858725b7e2e79A6DB4CEDa510854C48238357ff";
  const size = 400;
  const grid = 40;
  const px = size / grid;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const block = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * px, y * px, w * px, h * px);
  };

  const glyphs = {
    "8": ["11111", "10001", "11111", "10001", "10001", "10001", "11111"],
    B: ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    " ": ["000", "000", "000", "000", "000", "000", "000"],
  };

  const drawPixelText = (text, startX, startY, scale, color) => {
    let cursor = startX;
    for (const raw of text) {
      const ch = raw.toUpperCase();
      const pattern = glyphs[ch] || glyphs[" "];
      const w = pattern[0].length;
      for (let row = 0; row < pattern.length; row++) {
        for (let col = 0; col < w; col++) {
          if (pattern[row][col] === "1") {
            block(cursor + col * scale, startY + row * scale, scale, scale, color);
          }
        }
      }
      cursor += (w + 1) * scale;
    }
  };

  const hexToRgb = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
  };
  const rgbToHex = ({ r, g, b }) =>
    `#${Math.max(0, Math.min(255, Math.round(r))).toString(16).padStart(2, "0")}${Math.max(0, Math.min(255, Math.round(g))).toString(16).padStart(2, "0")}${Math.max(0, Math.min(255, Math.round(b))).toString(16).padStart(2, "0")}`;
  const mix = (a, b, t) => {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return rgbToHex({
      r: ca.r + (cb.r - ca.r) * t,
      g: ca.g + (cb.g - ca.g) * t,
      b: ca.b + (cb.b - ca.b) * t,
    });
  };

  block(0, 0, 40, 40, "#5b0b1a");

  for (let y = 27; y < 40; y++) {
    const depth = (y - 27) / 12;
    const base = mix("#8f1730", "#4b0917", depth * 0.9);
    for (let x = 0; x < 40; x++) {
      const r1 = ((x + y * 2) % 7) === 0 ? 0.22 : 0;
      const r2 = ((x * 2 + y) % 11) === 0 ? 0.16 : 0;
      const trough = ((x + y) % 9) === 0 ? 0.18 : 0;
      let c = mix(base, "#d73a5d", r1 + r2);
      c = mix(c, "#2d050f", trough);
      block(x, y, 1, 1, c);
    }
  }
  for (let x = 1; x < 39; x++) {
    if (x % 3 !== 0) block(x, 27, 1, 1, "#cf3658");
    if (x % 5 === 0) block(x, 28, 1, 1, "#b32645");
  }

  const cx = 20;
  const cy = 19.5;
  const rx = 11.8;
  const ry = 14.8;
  const darkGold = "#8f5b12";
  const midGold = "#c88f1f";
  const brightGold = "#efbf45";
  const deepShadow = "#6b3f09";
  const outline = "#3a2608";

  for (let y = 5; y < 35; y++) {
    for (let x = 6; x < 34; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;

      const radial = Math.max(0, 1 - d);
      const topLight = Math.max(0, 1 - (y - 7) / 26);
      const sideShade = Math.max(0, (x - cx + 1.5) / 13);
      const underside = Math.max(0, (y - 22) / 10);
      const metallicBand = Math.max(0, 1 - Math.abs(y - 18) / 5.6);
      const shimmer = metallicBand * (0.35 + (1 - Math.abs(x - 17.5) / 16) * 0.65);
      const warmBounce = Math.max(0, 1 - Math.abs(y - 25) / 7) * Math.max(0, 1 - Math.abs(x - 22) / 12);

      let color = mix(darkGold, midGold, 0.35 + radial * 0.45 + topLight * 0.2);
      color = mix(color, brightGold, shimmer * 0.45);
      color = mix(color, deepShadow, sideShade * 0.52 + underside * 0.28);
      color = mix(color, "#a86e1c", warmBounce * 0.25);

      if (d > 0.88) color = mix(color, outline, 0.62);
      block(x, y, 1, 1, color);
    }
  }

  for (let y = 8; y < 31; y++) {
    const sheenStrength = Math.max(0, 1 - Math.abs(y - 17) / 8.5);
    if (sheenStrength <= 0) continue;
    const sheenColor = mix("#d3a235", "#f5c958", sheenStrength * 0.85);
    const xStart = 14 + Math.floor((y - 8) / 9);
    const w = y < 18 ? 5 : 4;
    block(xStart, y, w, 1, mix(sheenColor, "#ba8628", 0.2));
  }

  const label = "8BIT PENGUIN";
  const scale = 0.5;
  const textWidth = label.split("").reduce((acc, raw) => acc + (((glyphs[raw.toUpperCase()] || glyphs[" "])[0].length + 1) * scale), 0) - scale;
  const textX = (40 - textWidth) / 2;
  const textY = 19.4;
  drawPixelText(label, textX + 0.25, textY + 0.25, scale, "#0f172acc");
  drawPixelText(label, textX + 0.1, textY, scale, "#f8fafc");
  drawPixelText(label, textX, textY, scale, "#f8fafc");

  const dataUri = canvas.toDataURL("image/png");

  const contract = await hre.ethers.getContractAt("EightBitPenguinsUpgradeable", contractAddress);
  const tx = await contract.setPlaceholderImage(dataUri);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("Placeholder updated");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
