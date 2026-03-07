const { ethers } = require('ethers');

function decodeBase64Loose(input){
 const cleaned=String(input||'').trim().replace(/^base64,/,'').replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/').replace(/[^A-Za-z0-9+/=]/g,'');
 const padded = cleaned + '='.repeat((4-(cleaned.length%4))%4);
 return Buffer.from(padded,'base64').toString('utf8');
}
async function main(){
 const addr='0xCe047500b65b7AC0b6019cEcCfa3fd9d4bDe7aCd';
 const p=new ethers.JsonRpcProvider('https://sepolia.base.org');
 const c=new ethers.Contract(addr,['function totalSupply() view returns(uint256)','function tokenURI(uint256) view returns(string)'],p);
 const t=Number(await c.totalSupply());
 console.log('total',t);
 if(!t) return;
 const uri=await c.tokenURI(1);
 console.log('uri prefix', uri.slice(0,40));
 const raw=decodeBase64Loose(uri.replace('data:application/json;base64,',''));
 console.log('raw head', raw.slice(0,180));
 console.log('has attributes marker', raw.includes('"attributes":'));
}
main();
