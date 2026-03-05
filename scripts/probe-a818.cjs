const { ethers } = require('ethers');
async function main(){
  const addr = '0xa81882b34253Ce8253aBf8e8cD013F6282C9455e';
  const p = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const sigs = ['mint(uint256,string[],string[])','mint(uint256,string[])'];
  const code = await p.getCode(addr);
  console.log('codeSize', (code.length-2)/2);
  for (const s of sigs){
    const sel = ethers.id(s).slice(2,10);
    console.log(s, code.includes(sel) ? 'present' : 'missing');
  }
  const c = new ethers.Contract(addr,['function totalSupply() view returns(uint256)','function tokenURI(uint256) view returns(string)'],p);
  const t = Number(await c.totalSupply());
  console.log('totalSupply', t);
  if (t>0){
    const uri = await c.tokenURI(1);
    const raw = Buffer.from(uri.replace('data:application/json;base64,',''),'base64').toString('utf8');
    console.log('has attributes marker', raw.includes('"attributes":'));
  }
}
main();
