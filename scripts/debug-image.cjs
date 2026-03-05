const { ethers } = require('ethers');

async function main() {
  const addr = '0xf5B9a19fD4F79969BFffd16F2847A8Df157815A7';
  const rpc = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const abi = [
    'function totalSupply() view returns (uint256)',
    'function tokenURI(uint256) view returns (string)',
    'function evolvedTokens(uint256) view returns (bool)'
  ];
  const c = new ethers.Contract(addr, abi, rpc);
  const total = Number(await c.totalSupply());
  console.log('totalSupply', total);
  const max = Math.min(total, 5);
  for (let i = 1; i <= max; i++) {
    try {
      const uri = await c.tokenURI(i);
      const evo = await c.evolvedTokens(i);
      console.log('token', i, 'evolved', evo, 'uriPrefix', uri.slice(0, 40));
      if (uri.startsWith('data:application/json;base64,')) {
        const b64 = uri.replace('data:application/json;base64,','');
        const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
        console.log(' imagePrefix', String(json.image).slice(0, 40));
      }
    } catch (e) {
      console.log('token', i, 'error', e.message);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
