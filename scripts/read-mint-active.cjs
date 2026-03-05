const { ethers } = require('ethers');
async function main(){
 const p = new ethers.JsonRpcProvider('https://sepolia.base.org');
 const c = new ethers.Contract('0xa81882b34253Ce8253aBf8e8cD013F6282C9455e',['function mintActive() view returns (bool)'],p);
 console.log('mintActive', await c.mintActive());
}
main();
