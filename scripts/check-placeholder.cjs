const hre = require('hardhat');
(async()=>{
  const c = await hre.ethers.getContractAt('PixelPenguins','0x74EFbA98Acb0f46d667Cbc9741d9706f5c6BD47B');
  const img = await c.placeholderImage();
  console.log('prefix:', img.slice(0,30));
  console.log('len:', img.length);
})().catch((e)=>{console.error(e);process.exit(1);});
