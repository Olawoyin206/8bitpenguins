const { ethers } = require('ethers');
async function test(sig,args){
 const p=new ethers.JsonRpcProvider('https://sepolia.base.org');
 const to='0xa81882b34253Ce8253aBf8e8cD013F6282C9455e';
 const iface=new ethers.Interface([`function ${sig}`]);
 const data=iface.encodeFunctionData(sig.split('(')[0],args);
 try{
  await p.call({to,data});
  console.log(sig,'call ok');
 }catch(e){
  console.log(sig,'err', e.shortMessage||e.message);
 }
}
(async()=>{
 await test('mint(uint256 quantity, string[] svgImages)', [1,['data:image/svg+xml;base64,AA==']]);
 await test('mint(uint256 quantity, string[] imageUrls, string[] names)', [1,['data:image/svg+xml;base64,AA=='],['Test']]);
})();
