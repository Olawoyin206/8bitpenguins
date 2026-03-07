const hre = require('hardhat');
(async()=>{
  const c = await hre.ethers.getContractAt('EightBitPenguinsUpgradeable','0x9858725b7e2e79A6DB4CEDa510854C48238357ff');
  const img = await c.placeholderImage();
  console.log('prefix:', img.slice(0,30));
  console.log('len:', img.length);
})().catch((e)=>{console.error(e);process.exit(1);});
