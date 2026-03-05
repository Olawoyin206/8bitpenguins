const hre = require("hardhat");

async function main() {
  const address = "0x74583D54B3c42ab08c8031d849B350Ccf425060c";
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
