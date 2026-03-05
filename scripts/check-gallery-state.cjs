const hre = require('hardhat');
(async()=>{
  const c = await hre.ethers.getContractAt('PixelPenguins','0x74583D54B3c42ab08c8031d849B350Ccf425060c');
  const supply = Number(await c.totalSupply());
  const revealed = await c.revealed();
  console.log('supply', supply);
  console.log('revealed', revealed);
  const sample = Math.min(5, supply);
  for (let i=1;i<=sample;i++){
    const raw = await c.tokenMetadataJson(i);
    const hasImg = raw.includes('"image":"data:image/');
    const hasAttrs = raw.includes('"attributes":[');
    const hasName = raw.includes('"name":"');
    console.log(i, 'len', raw.length, 'img', hasImg, 'attrs', hasAttrs, 'name', hasName);
  }
})().catch(e=>{console.error(e);process.exit(1);});
