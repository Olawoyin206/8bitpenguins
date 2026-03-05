const hre = require('hardhat');
(async()=>{
  const c = await hre.ethers.getContractAt('PixelPenguins','0xCc362C9812DFd88c7B476eeB425830Cc40d2C24D');
  const tx = await c.setRevealed(false);
  console.log('Tx:', tx.hash);
  await tx.wait();
  console.log('revealed:', await c.revealed());
})().catch((e)=>{console.error(e);process.exit(1);});
