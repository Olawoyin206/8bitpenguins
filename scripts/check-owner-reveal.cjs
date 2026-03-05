const hre = require('hardhat');
(async()=>{
  const addr='0xCc362C9812DFd88c7B476eeB425830Cc40d2C24D';
  const c = await hre.ethers.getContractAt('PixelPenguins',addr);
  const [s] = await hre.ethers.getSigners();
  console.log('contract:',addr);
  console.log('owner:', await c.owner());
  console.log('signer:', s.address);
  console.log('revealed:', await c.revealed());
  console.log('mintActive:', await c.mintActive());
})().catch((e)=>{console.error(e);process.exit(1);});
