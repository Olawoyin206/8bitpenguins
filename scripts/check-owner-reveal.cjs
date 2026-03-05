const hre = require('hardhat');
(async()=>{
  const addr='0x74583D54B3c42ab08c8031d849B350Ccf425060c';
  const c = await hre.ethers.getContractAt('PixelPenguins',addr);
  const [s] = await hre.ethers.getSigners();
  console.log('contract:',addr);
  console.log('owner:', await c.owner());
  console.log('signer:', s.address);
  console.log('revealed:', await c.revealed());
  console.log('mintActive:', await c.mintActive());
})().catch((e)=>{console.error(e);process.exit(1);});
