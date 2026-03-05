const hre = require('hardhat');
(async () => {
  const addr = '0x74583D54B3c42ab08c8031d849B350Ccf425060c';
  const c = await hre.ethers.getContractAt('PixelPenguins', addr);
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
