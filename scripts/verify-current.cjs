const hre = require("hardhat");

async function main() {
  const address = "0x9858725b7e2e79A6DB4CEDa510854C48238357ff";
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("Verified:", address);
  } catch (error) {
    console.log("Verify error message:", error?.message || "unknown");
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
