const hre = require('hardhat');
(async()=>{
  const addr='0xCc362C9812DFd88c7B476eeB425830Cc40d2C24D';
  const c = await hre.ethers.getContractAt('PixelPenguins', addr);
  const supply = Number(await c.totalSupply());
  console.log('revealed', await c.revealed());
  console.log('supply', supply);
  if (supply > 0) {
    const id = supply;
    const raw = await c.tokenMetadataJson(id);
    console.log('id', id, 'len', raw.length);
    console.log('prefix', raw.slice(0,180));
    console.log('hasImageDataPng', raw.includes('data:image/png;base64,'));
  }
})().catch(e=>{console.error(e);process.exit(1);});
