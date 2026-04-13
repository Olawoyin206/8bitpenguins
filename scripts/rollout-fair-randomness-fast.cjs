const fs = require("fs");
const path = require("path");
const solc = require("solc");
const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

const MAIN_SOURCE = "contracts/8bitPenguins.sol";
const METADATA_HELPER_SOURCE = "contracts/EightBitPenguinsMetadataBuilder.sol";
const RANDOMNESS_HELPER_SOURCE = "contracts/EightBitPenguinsRandomnessHelper.sol";
const MAIN_CONTRACT = "EightBitPenguinsUpgradeable";
const METADATA_HELPER_CONTRACT = "EightBitPenguinsMetadataBuilder";
const RANDOMNESS_HELPER_CONTRACT = "EightBitPenguinsRandomnessHelper";

const PROXY_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function UPGRADE_INTERFACE_VERSION() view returns (string)",
  "function upgradeAndCall(address proxy, address implementation, bytes data) external payable",
];

function parseBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;

  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean for ${name}: ${raw}`);
}

function resolveImport(importPath) {
  const candidates = [
    path.resolve(process.cwd(), importPath),
    path.resolve(process.cwd(), "node_modules", importPath),
    path.resolve(process.cwd(), "contracts", importPath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `File not found: ${importPath}` };
}

function compileContracts() {
  const sources = {
    [MAIN_SOURCE]: { content: fs.readFileSync(MAIN_SOURCE, "utf8") },
    [METADATA_HELPER_SOURCE]: { content: fs.readFileSync(METADATA_HELPER_SOURCE, "utf8") },
    [RANDOMNESS_HELPER_SOURCE]: { content: fs.readFileSync(RANDOMNESS_HELPER_SOURCE, "utf8") },
  };

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      metadata: { bytecodeHash: "none" },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));
  const errors = Array.isArray(output.errors) ? output.errors : [];
  const fatalErrors = errors.filter((entry) => entry.severity === "error");

  if (fatalErrors.length > 0) {
    throw new Error(fatalErrors.map((entry) => entry.formattedMessage || entry.message).join("\n"));
  }

  return {
    main: output.contracts?.[MAIN_SOURCE]?.[MAIN_CONTRACT],
    metadataHelper: output.contracts?.[METADATA_HELPER_SOURCE]?.[METADATA_HELPER_CONTRACT],
    randomnessHelper: output.contracts?.[RANDOMNESS_HELPER_SOURCE]?.[RANDOMNESS_HELPER_CONTRACT],
  };
}

async function deployCompiledContract(label, contractOutput, signer) {
  const bytecode = contractOutput?.evm?.bytecode?.object;
  const abi = contractOutput?.abi;
  if (!abi || !bytecode) throw new Error(`Missing ABI/bytecode for ${label}`);

  const factory = new hre.ethers.ContractFactory(
    abi,
    bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`,
    signer
  );

  console.log(`Deploying ${label}...`);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`${label}:`, address);
  return { contract, address, abi };
}

function isTransientRpcError(error) {
  const text = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code.includes("UND_ERR_SOCKET") ||
    code.includes("UND_ERR_HEADERS_TIMEOUT") ||
    text.includes("socketerror") ||
    text.includes("other side closed") ||
    text.includes("headers timeout") ||
    text.includes("tlsv1 alert") ||
    text.includes("timeout")
  );
}

async function deployCompiledContractWithRetry(label, contractOutput, signer, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await deployCompiledContract(label, contractOutput, signer);
    } catch (error) {
      lastError = error;
      const canRetry = isTransientRpcError(error) && attempt < attempts;
      console.warn(`${label} deploy attempt ${attempt}/${attempts} failed:`, error?.message || error);
      if (!canRetry) break;
      const waitMs = 2000 * attempt;
      console.log(`Retrying ${label} deploy in ${waitMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function main() {
  const proxyAddress = getContractAddress();
  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();

  const directMintEnabled = parseBooleanEnv("DIRECT_MINT_ENABLED", false);

  console.log("Proxy:", proxyAddress);
  console.log("Signer:", signerAddress);
  console.log("Compiling deployment set...");
  const compiled = compileContracts();

  const mainSize = (compiled.main.evm.bytecode.object.length / 2);
  console.log("Implementation size:", mainSize, "bytes");
  if (mainSize >= 24576) {
    throw new Error(`Implementation still exceeds EVM size limit: ${mainSize} bytes`);
  }

  const metadataHelper = await deployCompiledContractWithRetry("Metadata helper", compiled.metadataHelper, signer);
  const randomnessHelper = await deployCompiledContractWithRetry("Randomness helper", compiled.randomnessHelper, signer);
  const implementation = await deployCompiledContractWithRetry("Upgradeable implementation", compiled.main, signer);

  const previousImplementation = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  const proxyAdminAddress = await hre.upgrades.erc1967.getAdminAddress(proxyAddress);
  const proxyAdmin = new hre.ethers.Contract(proxyAdminAddress, PROXY_ADMIN_ABI, signer);
  const proxyAdminOwner = await proxyAdmin.owner();

  console.log("Previous implementation:", previousImplementation);
  console.log("ProxyAdmin:", proxyAdminAddress);
  console.log("ProxyAdmin owner:", proxyAdminOwner);

  if (proxyAdminOwner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(`Signer ${signerAddress} is not ProxyAdmin owner ${proxyAdminOwner}`);
  }

  console.log("Upgrading proxy...");
  try {
    console.log("ProxyAdmin upgrade interface:", await proxyAdmin.UPGRADE_INTERFACE_VERSION());
  } catch (error) {
    console.log("ProxyAdmin upgrade interface read skipped:", error?.shortMessage || error?.message || error);
  }

  const upgradeTx = await proxyAdmin.upgradeAndCall(proxyAddress, implementation.address, "0x");
  console.log("Upgrade tx:", upgradeTx.hash);
  await upgradeTx.wait();

  const liveImplementation = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Live implementation:", liveImplementation);
  if (liveImplementation.toLowerCase() !== implementation.address.toLowerCase()) {
    throw new Error(`Upgrade mismatch: expected ${implementation.address}, got ${liveImplementation}`);
  }

  const proxy = new hre.ethers.Contract(proxyAddress, compiled.main.abi, signer);

  console.log("Setting metadata helper...");
  const metadataTx = await proxy.setMetadataBuilder(metadataHelper.address);
  console.log("Metadata helper tx:", metadataTx.hash);
  await metadataTx.wait();

  console.log("Setting randomness helper...");
  const randomnessTx = await proxy.setRandomnessHelper(randomnessHelper.address);
  console.log("Randomness helper tx:", randomnessTx.hash);
  await randomnessTx.wait();

  console.log("Configuring mint mode...");
  const configTx = await proxy.configureMintMode(directMintEnabled);
  console.log("Mint mode tx:", configTx.hash);
  await configTx.wait();

  console.log("Rollout complete");
  console.log("Proxy:", proxyAddress);
  console.log("Implementation:", liveImplementation);
  console.log("Metadata helper:", metadataHelper.address);
  console.log("Randomness helper:", randomnessHelper.address);
  console.log("mintModeConfigured:", await proxy.mintModeConfigured());
  console.log("directMintEnabled:", await proxy.directMintEnabled());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
