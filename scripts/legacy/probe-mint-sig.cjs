const { ethers } = require('ethers');
async function main(){
  const addr = '0xCe047500b65b7AC0b6019cEcCfa3fd9d4bDe7aCd';
  const p = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const sigs = [
    'mint(uint256,string[],string[])',
    'mint(uint256,string[])',
    'mint(uint256)',
    'mint(uint256,string[],string[],uint256)'
  ];
  const code = await p.getCode(addr);
  console.log('codeSize', (code.length-2)/2);
  for (const s of sigs){
    const sel = ethers.id(s).slice(0,10);
    console.log(s, code.includes(sel.slice(2)) ? 'maybe' : 'no');
  }
}
main();
