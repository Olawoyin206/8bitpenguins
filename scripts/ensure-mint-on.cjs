const hre = require('hardhat');
const { getContractAddress } = require('./_config.cjs');
(async () => {
  const addr = getContractAddress();
  const c = await hre.ethers.getContractAt('EightBitPenguinsUpgradeable', addr);
  const before = await c.mintActive();
  const owner = await c.owner();
  const [signer] = await hre.ethers.getSigners();
  console.log('Address:', addr);
  console.log('Owner:', owner);
  console.log('Signer:', signer.address);
  console.log('Before:', before);
  if (!before) {
    const tx = await c.toggleMint();
    console.log('Tx:', tx.hash);
    await tx.wait();
  }
  console.log('After:', await c.mintActive());
})().catch((e) => { console.error(e); process.exit(1); });
