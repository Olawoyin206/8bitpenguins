const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

function hasFunctionSignatureInAbi(abi, signature) {
  const target = String(signature || "").trim();
  if (!target) return false;

  const [namePart, argsPart] = target.split("(");
  const fnName = String(namePart || "").trim();
  const argTypes = String(argsPart || "")
    .replace(")", "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (abi || []).some((entry) => {
    if (!entry || entry.type !== "function" || entry.name !== fnName) return false;
    const inputs = Array.isArray(entry.inputs) ? entry.inputs.map((input) => input.type) : [];
    if (inputs.length !== argTypes.length) return false;
    return inputs.every((type, index) => type === argTypes[index]);
  });
}

async function assertLocalContractMatchesLiveMintMode(proxyAddress) {
  if (String(process.env.ALLOW_DIVERGENT_SOURCE || "").trim() === "1") return;

  const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  const runtimeCode = String(await hre.ethers.provider.getCode(implementationAddress) || "").toLowerCase();
  const artifact = await hre.artifacts.readArtifact("EightBitPenguinsUpgradeable");

  const criticalSignatures = [
    "mint(uint256)",
    "mint(uint256,string[],string[],string[],uint256[])",
    "tokenOriginalImage(uint256)",
    "tokenEvolvedImage(uint256)",
    "tokenInteractiveModel(uint256)",
    "finalizeRarity()",
    "rarityFinalized()",
    "setFinalRarityData(uint256[],uint256[],uint256[])",
    "configureMintMode(bool)",
    "mintModeConfigured()",
    "directMintEnabled()",
  ];

  const missingFromLocalAbi = criticalSignatures.filter((signature) => {
    const selector = hre.ethers.id(signature).slice(2, 10).toLowerCase();
    const liveHasSignature = runtimeCode.includes(selector);
    if (!liveHasSignature) return false;
    return !hasFunctionSignatureInAbi(artifact.abi, signature);
  });

  if (missingFromLocalAbi.length > 0) {
    throw new Error(
      [
        `Live implementation ${implementationAddress} exposes function signatures that are missing from local source ABI.`,
        `Missing signatures: ${missingFromLocalAbi.join(", ")}`,
        "Local contract source/ABI appears divergent from deployed runtime.",
        "Sync contract source before upgrading, or set ALLOW_DIVERGENT_SOURCE=1 to bypass intentionally.",
      ].join(" ")
    );
  }
}

async function main() {
  const proxyAddress = getContractAddress();
  const Factory = await hre.ethers.getContractFactory("EightBitPenguinsUpgradeable");

  console.log("Upgrading proxy:", proxyAddress);
  await assertLocalContractMatchesLiveMintMode(proxyAddress);
  try {
    await hre.upgrades.forceImport(proxyAddress, Factory, {
      kind: "transparent",
    });
    console.log("Registered existing proxy in local manifest");
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.toLowerCase().includes("already")) {
      console.warn("forceImport warning:", message);
    }
  }
  const upgraded = await hre.upgrades.upgradeProxy(proxyAddress, Factory, {
    kind: "transparent",
    redeployImplementation: "always",
  });
  await upgraded.waitForDeployment();

  const implementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Upgrade complete");
  console.log("Proxy:", proxyAddress);
  console.log("Implementation:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
