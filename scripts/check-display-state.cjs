const hre = require('hardhat');
(async()=>{
  const c = await hre.ethers.getContractAt('PixelPenguins','0xFea8dFFF55Ec061bF8282d3e3A6D70292826c354');
  const supply = Number(await c.totalSupply());
  const revealed = await c.revealed();
  console.log('totalSupply:', supply);
  console.log('revealed:', revealed);
  if (supply > 0) {
    const uri = await c.tokenURI(1);
    console.log('tokenURI prefix:', uri.slice(0, 32));
  }
})().catch((e)=>{console.error(e);process.exit(1);});
