const hre = require("hardhat");

async function main() {
  const address = "0x80221b01c8eB071E553D21D5cE96442402B131b4";
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
