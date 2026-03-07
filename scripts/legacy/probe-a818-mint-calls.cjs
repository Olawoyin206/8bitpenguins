const { ethers } = require('ethers');
async function trySig(sig,args){
 const p=new ethers.JsonRpcProvider('https://sepolia.base.org');
 const to='0xa81882b34253Ce8253aBf8e8cD013F6282C9455e';
 const iface=new ethers.Interface([`function ${sig}`]);
 const data=iface.encodeFunctionData(sig.split('(')[0],args);
 try { await p.call({to,data}); console.log(sig,'ok'); }
 catch(e){ console.log(sig, e.shortMessage||e.message); }
}
(async()=>{
 await trySig('mint(uint256 quantity)', [1]);
 await trySig('mint(uint256 quantity, string[] svgImages)', [1,['x']]);
 await trySig('mint(uint256 quantity, string[] imageUrls, string[] names)', [1,['x'],['n']]);
})();
