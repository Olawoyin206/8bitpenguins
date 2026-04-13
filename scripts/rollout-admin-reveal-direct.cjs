const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");
require("dotenv").config();
const { getContractAddress } = require("./_config.cjs");

const ROOT = path.resolve(__dirname, "..");
const IMPLEMENTATION_SLOT = "0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

const MAIN_SOURCE = "contracts/8bitPenguins.sol";
const METADATA_HELPER_SOURCE = "contracts/EightBitPenguinsMetadataBuilder.sol";
const RANDOMNESS_HELPER_SOURCE = "contracts/EightBitPenguinsRandomnessHelper.sol";
const MAIN_CONTRACT = "EightBitPenguinsUpgradeable";
const METADATA_HELPER_CONTRACT = "EightBitPenguinsMetadataBuilder";
const RANDOMNESS_HELPER_CONTRACT = "EightBitPenguinsRandomnessHelper";

const DEFAULT_METADATA_HELPER_ADDRESS = "0x2a4b10F08Af5272Ce73CBf24f90383dd2b6F97a1";
const DEFAULT_RANDOMNESS_HELPER_ADDRESS = "0x909bc6A060041B05F729f060F581c9B91CBF58c5";

const PROXY_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function UPGRADE_INTERFACE_VERSION() view returns (string)",
  "function upgradeAndCall(address proxy, address implementation, bytes data) external payable",
];

const PROXY_ABI = [
  "function owner() view returns (address)",
  "function setMetadataBuilder(address builder) external",
  "function setRandomnessHelper(address helper) external",
  "function configureMintMode(bool directMintEnabled_) external",
  "function mintModeConfigured() view returns (bool)",
  "function directMintEnabled() view returns (bool)",
];

function readSource(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function findImport(importPath) {
  const candidates = [
    path.join(ROOT, importPath),
    path.join(ROOT, "contracts", importPath),
    path.join(ROOT, "node_modules", importPath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `File not found: ${importPath}` };
}

function compileContracts() {
  const input = {
    language: "Solidity",
    sources: {
      [MAIN_SOURCE]: { content: readSource(MAIN_SOURCE) },
      [METADATA_HELPER_SOURCE]: { content: readSource(METADATA_HELPER_SOURCE) },
      [RANDOMNESS_HELPER_SOURCE]: { content: readSource(RANDOMNESS_HELPER_SOURCE) },
    },
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      metadata: { bytecodeHash: "none" },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
  const errors = output.errors || [];
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

function normalizeHex(value) {
  return String(value || "").toLowerCase().replace(/^0x/, "");
}

function parseAddressFromSlot(slotValue) {
  return ethers.getAddress(`0x${String(slotValue || "").slice(-40)}`);
}

function parseAddressEnv(name, fallback) {
  const value = (process.env[name] || fallback || "").trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return ethers.getAddress(value);
}

async function ensureRuntimeMatches(provider, label, address, contractOutput) {
  const onchainRuntime = normalizeHex(await provider.getCode(address));
  const compiledRuntime = normalizeHex(contractOutput?.evm?.deployedBytecode?.object || "");

  if (!onchainRuntime || onchainRuntime === "0") {
    throw new Error(`${label} has no code at ${address}`);
  }
  if (!compiledRuntime) {
    throw new Error(`Missing compiled runtime for ${label}`);
  }
  if (onchainRuntime !== compiledRuntime) {
    throw new Error(`${label} runtime mismatch at ${address}`);
  }
}

async function readProxyPointers(provider, proxyAddress) {
  const [implementationSlot, adminSlot] = await Promise.all([
    provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT),
    provider.getStorage(proxyAddress, ADMIN_SLOT),
  ]);

  return {
    implementation: parseAddressFromSlot(implementationSlot),
    admin: parseAddressFromSlot(adminSlot),
  };
}

async function waitForTx(label, txPromise) {
  const tx = await txPromise;
  console.log(`${label} tx:`, tx.hash);
  await tx.wait();
}

async function deployCompiledContract(contractOutput, wallet) {
  const bytecode = contractOutput?.evm?.bytecode?.object;
  const abi = contractOutput?.abi;
  if (!abi || !bytecode) {
    throw new Error("Missing compiled implementation bytecode");
  }

  const factory = new ethers.ContractFactory(
    abi,
    bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`,
    wallet
  );
  const implementation = await factory.deploy();
  await implementation.waitForDeployment();
  return implementation.getAddress();
}

async function main() {
  const rpcUrl =
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.ETH_SEPOLIA_RPC_URL ||
    process.env.BASE_SEPOLIA_RPC_URL ||
    process.env.VITE_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  if (!rpcUrl || !privateKey) {
    throw new Error("Missing RPC URL (ETH_MAINNET_RPC_URL/MAINNET_RPC_URL/VITE_RPC_URL) or PRIVATE_KEY");
  }

  const proxyAddress = getContractAddress();
  const metadataHelperAddress = parseAddressEnv("FAIR_RANDOMNESS_METADATA_HELPER_ADDRESS", DEFAULT_METADATA_HELPER_ADDRESS);
  const randomnessHelperAddress = parseAddressEnv("FAIR_RANDOMNESS_RANDOMNESS_HELPER_ADDRESS", DEFAULT_RANDOMNESS_HELPER_ADDRESS);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Proxy:", proxyAddress);
  console.log("Signer:", wallet.address);
  console.log("Compiling local contracts...");

  const compiled = compileContracts();
  const implementationSize = normalizeHex(compiled.main.evm?.deployedBytecode?.object || "").length / 2;
  console.log("Implementation runtime size:", implementationSize, "bytes");
  if (implementationSize >= 24576) {
    throw new Error(`Implementation exceeds EVM size limit: ${implementationSize}`);
  }

  console.log("Verifying helper contracts...");
  await ensureRuntimeMatches(provider, "Metadata helper", metadataHelperAddress, compiled.metadataHelper);
  await ensureRuntimeMatches(provider, "Randomness helper", randomnessHelperAddress, compiled.randomnessHelper);

  console.log("Deploying new implementation...");
  const implementationAddress = await deployCompiledContract(compiled.main, wallet);
  console.log("New implementation:", implementationAddress);

  const pointersBefore = await readProxyPointers(provider, proxyAddress);
  console.log("Current implementation:", pointersBefore.implementation);
  console.log("ProxyAdmin:", pointersBefore.admin);

  const proxyAdmin = new ethers.Contract(pointersBefore.admin, PROXY_ADMIN_ABI, wallet);
  const proxyAdminOwner = await proxyAdmin.owner();
  console.log("ProxyAdmin owner:", proxyAdminOwner);
  if (proxyAdminOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Signer ${wallet.address} is not ProxyAdmin owner ${proxyAdminOwner}`);
  }

  try {
    console.log("ProxyAdmin upgrade interface:", await proxyAdmin.UPGRADE_INTERFACE_VERSION());
  } catch (error) {
    console.log("ProxyAdmin upgrade interface read skipped:", error?.shortMessage || error?.message || error);
  }

  await waitForTx(
    "Upgrade",
    proxyAdmin.upgradeAndCall(proxyAddress, implementationAddress, "0x")
  );

  const proxy = new ethers.Contract(proxyAddress, PROXY_ABI, wallet);
  console.log("Proxy owner:", await proxy.owner());

  await waitForTx("Set metadata helper", proxy.setMetadataBuilder(metadataHelperAddress));
  await waitForTx("Set randomness helper", proxy.setRandomnessHelper(randomnessHelperAddress));
  await waitForTx("Configure admin reveal mint", proxy.configureMintMode(true));

  const pointersAfter = await readProxyPointers(provider, proxyAddress);
  console.log("Final implementation:", pointersAfter.implementation);
  console.log("mintModeConfigured:", await proxy.mintModeConfigured());
  console.log("directMintEnabled:", await proxy.directMintEnabled());
  console.log("Metadata helper:", metadataHelperAddress);
  console.log("Randomness helper:", randomnessHelperAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
