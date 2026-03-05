const hre = require('hardhat');

async function main() {
  const address = '0x235f3B6B1B1Ecad94fE1148fe92930E7B56CCDAF';
  const [signer] = await hre.ethers.getSigners();
  const abi = [
    'function mintActive() view returns (bool)',
    'function toggleMint()'
  ];
  const contract = new hre.ethers.Contract(address, abi, signer);

  const before = await contract.mintActive();
  const tx = await contract.toggleMint();
  await tx.wait();
  const after = await contract.mintActive();

  console.log('Signer:', signer.address);
  console.log('Mint active before:', before);
  console.log('Tx hash:', tx.hash);
  console.log('Mint active after:', after);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
