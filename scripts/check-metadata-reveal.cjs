const hre = require('hardhat');
(async()=>{
  const c = await hre.ethers.getContractAt('PixelPenguins','0xFea8dFFF55Ec061bF8282d3e3A6D70292826c354');
  const supply = Number(await c.totalSupply());
  const revealed = await c.revealed();
  console.log('revealed:', revealed);
  console.log('supply:', supply);
  if (supply > 0) {
    const id = 1;
    const raw = await c.tokenMetadataJson(id);
    console.log('tokenMetadataJson#1 prefix:', raw.slice(0, 220));
    console.log('has attributes:', raw.includes('"attributes":['));
    console.log('has rarity_score:', raw.includes('"rarity_score":'));
    console.log('has rarity_rank:', raw.includes('"rarity_rank":'));
  }
})().catch((e)=>{console.error(e);process.exit(1);});
