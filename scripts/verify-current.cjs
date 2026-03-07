const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

async function main() {
  const address = getContractAddress();
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("Verified:", address);
  } catch (error) {
    const message = String(error?.message || "unknown");
    if (message.includes("Already Verified")) {
      console.log("Verification completed: remaining items were already verified.");
      return;
    }
    console.log("Verify error message:", message);
    if (error?.stack) {
      console.log(error.stack);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
