const hre = require('hardhat');
(async()=>{
  const c = await hre.ethers.getContractAt('EightBitPenguinsUpgradeable','0x9858725b7e2e79A6DB4CEDa510854C48238357ff');
  const tx = await c.setRevealed(false);
  console.log('Tx:', tx.hash);
  await tx.wait();
  console.log('revealed:', await c.revealed());
})().catch((e)=>{console.error(e);process.exit(1);});
