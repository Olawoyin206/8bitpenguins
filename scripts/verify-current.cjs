const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

const IMPLEMENTATION_CONTRACT = "contracts/8bitPenguins.sol:EightBitPenguinsUpgradeable";
const TRANSIENT_ERROR_PATTERNS = [
  "other side closed",
  "socket",
  "tlsv1 alert decrypt error",
  "econnreset",
  "etimedout",
  "timeout",
  "bad record mac",
];

function isAlreadyVerified(error) {
  const message = String(error?.message || "");
  return message.includes("Already Verified") || message.includes("already verified");
}

function isTransientVerifyError(error) {
  const message = String(error?.message || "").toLowerCase();
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

async function assertLocalArtifactMatchesImplementation(address) {
  const artifact = await hre.artifacts.readArtifact("EightBitPenguinsUpgradeable");
  const onchainBytecode = await hre.ethers.provider.getCode(address);
  const localDeployedBytecode = artifact.deployedBytecode;

  if (onchainBytecode === localDeployedBytecode) {
    return;
  }

  throw new Error(
    [
      `Local artifact bytecode does not match current implementation ${address}.`,
      "The active proxy has been upgraded with a build that is not present in this workspace.",
      "Restore the exact contract source/settings that produced the current implementation, then rerun verification.",
    ].join(" ")
  );
}

async function verifyWithRetry(label, taskArgs, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`Verifying ${label}${attempt > 1 ? ` (attempt ${attempt}/${attempts})` : ""}:`, taskArgs.address);
      await hre.run("verify:verify", taskArgs);
      return { ok: true, alreadyVerified: false };
    } catch (error) {
      if (isAlreadyVerified(error)) {
        console.log(`${label} already verified.`);
        return { ok: true, alreadyVerified: true };
      }

      if (attempt < attempts && isTransientVerifyError(error)) {
        console.log(`Transient verification error for ${label}:`, String(error.message || error));
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
        continue;
      }

      console.log(`Failed to verify ${label}:`, String(error?.message || error));
      return { ok: false, error };
    }
  }

  return { ok: false, error: new Error(`Exhausted retries while verifying ${label}`) };
}

async function main() {
  const proxyAddress = getContractAddress();
  const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);

  await assertLocalArtifactMatchesImplementation(implementationAddress);

  const implementationResult = await verifyWithRetry("implementation", {
    address: implementationAddress,
    contract: IMPLEMENTATION_CONTRACT,
    constructorArguments: [],
  });

  if (!implementationResult.ok) {
    process.exit(1);
  }

  const proxyResult = await verifyWithRetry("proxy", {
    address: proxyAddress,
    constructorArguments: [],
  });

  if (!proxyResult.ok) {
    process.exit(1);
  }

  console.log("Verification completed: proxy and current implementation are verified or were already verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
