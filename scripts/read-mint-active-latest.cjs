const { ethers } = require('ethers');
(async()=>{
 const p=new ethers.JsonRpcProvider('https://sepolia.base.org');
 const c=new ethers.Contract('0x235f3B6B1B1Ecad94fE1148fe92930E7B56CCDAF',['function mintActive() view returns(bool)'],p);
 console.log('mintActive',await c.mintActive());
})();
