const { ethers } = require('ethers');
(async()=>{
 const p=new ethers.JsonRpcProvider('https://sepolia.base.org');
 const c=new ethers.Contract('0xa81882b34253Ce8253aBf8e8cD013F6282C9455e',['function mintActive() view returns(bool)','function MAX_SUPPLY() view returns(uint256)','function totalSupply() view returns(uint256)','function MAX_PER_WALLET() view returns(uint256)'],p);
 console.log('mintActive',await c.mintActive());
 console.log('total',String(await c.totalSupply()),'max',String(await c.MAX_SUPPLY()),'maxPer',String(await c.MAX_PER_WALLET()));
})();
