const { ethers } = require('ethers');

function normalizeOnchainImage(image) {
  if (!image || typeof image !== 'string') return '';
  if (image.startsWith('data:image/')) return image;
  if (image.startsWith('<svg')) return `data:image/svg+xml;utf8,${encodeURIComponent(image)}`;
  if (image.startsWith('ipfs://')) return image.replace('ipfs://', 'https://ipfs.io/ipfs/');
  return image;
}
function decodeBase64Loose(input) {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}
function extractImageFromMetadataString(raw) {
  try {
    const parsed = JSON.parse(raw);
    return normalizeOnchainImage(parsed.image);
  } catch {
    const marker = '"image":"';
    const start = raw.indexOf(marker);
    if (start === -1) return '';
    const from = raw.slice(start + marker.length);
    const candidates = ['","attributes"', '","description"', '"}'];
    let end = -1;
    for (const c of candidates) {
      const idx = from.indexOf(c);
      if (idx !== -1 && (end === -1 || idx < end)) end = idx;
    }
    if (end === -1) return '';
    const image = from.slice(0, end).replace(/\\"/g, '"');
    return normalizeOnchainImage(image);
  }
}

async function main() {
  const addr = '0xf5B9a19fD4F79969BFffd16F2847A8Df157815A7';
  const rpc = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const abi = ['function totalSupply() view returns (uint256)','function tokenURI(uint256) view returns (string)'];
  const c = new ethers.Contract(addr, abi, rpc);
  const total = Number(await c.totalSupply());
  console.log('totalSupply', total);
  for (let i=1;i<=Math.min(total,6);i++) {
    const uri = await c.tokenURI(i);
    const b64 = uri.replace('data:application/json;base64,','');
    const raw = decodeBase64Loose(b64);
    const image = extractImageFromMetadataString(raw);
    console.log(i, image ? image.slice(0,35) : 'NO_IMAGE');
  }
}
main().catch(e=>{console.error(e);process.exit(1)});
