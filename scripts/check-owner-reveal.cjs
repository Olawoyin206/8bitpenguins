const hre = require('hardhat');
(async()=>{
  const addr='0x9858725b7e2e79A6DB4CEDa510854C48238357ff';
  const c = await hre.ethers.getContractAt('EightBitPenguinsUpgradeable',addr);
  const [s] = await hre.ethers.getSigners();
  console.log('contract:',addr);
  console.log('owner:', await c.owner());
  console.log('signer:', s.address);
  console.log('revealed:', await c.revealed());
  console.log('mintActive:', await c.mintActive());
})().catch((e)=>{console.error(e);process.exit(1);});
