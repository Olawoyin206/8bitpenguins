const { ethers } = require('ethers');
(async()=>{
 const addr='0xa81882b34253Ce8253aBf8e8cD013F6282C9455e';
 const p=new ethers.JsonRpcProvider('https://sepolia.base.org');
 const code=await p.getCode(addr);
 const sel1=ethers.id('mint(uint256)').slice(2,10);
 const sel2=ethers.id('mint(uint256,string[],string[])').slice(2,10);
 console.log('has mint(uint256):', code.includes(sel1));
 console.log('has mint(uint256,string[],string[]):', code.includes(sel2));
})();
