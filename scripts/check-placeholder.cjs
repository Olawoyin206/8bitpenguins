const hre = require('hardhat');
const { getContractAddress } = require('./_config.cjs');
(async()=>{
  const c = await hre.ethers.getContractAt('EightBitPenguinsUpgradeable', getContractAddress());
  const img = await c.placeholderImage();
  console.log('prefix:', img.slice(0,30));
  console.log('len:', img.length);
})().catch((e)=>{console.error(e);process.exit(1);});
