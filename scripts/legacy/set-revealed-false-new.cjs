const hre = require('hardhat');

(async () => {
  const addr = '0x9858725b7e2e79A6DB4CEDa510854C48238357ff';
  const c = await hre.ethers.getContractAt('EightBitPenguinsUpgradeable', addr);
  const tx = await c.setRevealed(false);
  console.log('Tx:', tx.hash);
  await tx.wait();
  console.log('contract:', addr);
  console.log('revealed:', await c.revealed());
  console.log('totalSupply:', (await c.totalSupply()).toString());
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
