const hre = require('hardhat');
(async()=>{
  const addr='0x80221b01c8eB071E553D21D5cE96442402B131b4';
  const c = await hre.ethers.getContractAt('PixelPenguins',addr);
  const [s] = await hre.ethers.getSigners();
  console.log('contract:',addr);
  console.log('owner:', await c.owner());
  console.log('signer:', s.address);
  console.log('revealed:', await c.revealed());
  console.log('mintActive:', await c.mintActive());
})().catch((e)=>{console.error(e);process.exit(1);});
