const hre = require('hardhat');
const { getContractAddress } = require('./_config.cjs');
(async()=>{
  const c = await hre.ethers.getContractAt('EightBitPenguinsUpgradeable', getContractAddress());
  const tx = await c.setRevealed(false);
  console.log('Tx:', tx.hash);
  await tx.wait();
  console.log('revealed:', await c.revealed());
})().catch((e)=>{console.error(e);process.exit(1);});
