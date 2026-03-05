const hre = require('hardhat');
(async()=>{
  const c = await hre.ethers.getContractAt('PixelPenguins','0xFea8dFFF55Ec061bF8282d3e3A6D70292826c354');
  console.log('mintActive:', await c.mintActive());
  console.log('revealed:', await c.revealed());
  console.log('totalSupply:', Number(await c.totalSupply()));
  if (Number(await c.totalSupply()) > 0) {
    console.log('score#1:', Number(await c.tokenRarityScore(1)));
    console.log('rank#1:', Number(await c.rarityRank(1)));
  }
})().catch((e)=>{console.error(e);process.exit(1);});
