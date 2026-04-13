const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");
require("dotenv").config();
const { getContractAddress } = require("./_config.cjs");

const ROOT = path.resolve(__dirname, "..");
const IMPLEMENTATION_SLOT = "0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const SOURCE_FILE = "contracts/8bitPenguins.sol";
const CONTRACT_NAME = "EightBitPenguinsUpgradeable";

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
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `File not found: ${importPath}` };
}

function compileImplementation() {
  const input = {
    language: "Solidity",
    sources: {
      [SOURCE_FILE]: { content: readSource(SOURCE_FILE) },
    },
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
  const errors = output.errors || [];
  const fatal = errors.filter((entry) => entry.severity === "error");
  errors.forEach((entry) => console.log(`${entry.severity.toUpperCase()}: ${entry.formattedMessage}`));
  if (fatal.length > 0) {
    throw new Error("solc compilation failed");
  }

  const contract = output.contracts?.[SOURCE_FILE]?.[CONTRACT_NAME];
  if (!contract) {
    throw new Error(`Missing compiled output for ${SOURCE_FILE}:${CONTRACT_NAME}`);
  }
  return contract;
}

function normalizeHex(value) {
  return String(value || "").toLowerCase().replace(/^0x/, "");
}

function parseAddressFromSlot(slotValue) {
  return ethers.getAddress(`0x${String(slotValue || "").slice(-40)}`);
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

async function main() {
  const rpcUrl =
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.ETH_SEPOLIA_RPC_URL ||
    process.env.VITE_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  if (!rpcUrl || !privateKey) {
    throw new Error("Missing RPC URL (ETH_MAINNET_RPC_URL/MAINNET_RPC_URL/VITE_RPC_URL) or PRIVATE_KEY");
  }

  const proxyAddress = getContractAddress();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Proxy:", proxyAddress);
  console.log("Deployer:", wallet.address);

  const compiled = compileImplementation();
  const currentPointers = await readProxyPointers(provider, proxyAddress);
  console.log("Current implementation:", currentPointers.implementation);
  console.log("Proxy admin:", currentPointers.admin);

  const compiledRuntime = normalizeHex(compiled.evm?.deployedBytecode?.object || "");
  const onchainRuntime = normalizeHex(await provider.getCode(currentPointers.implementation));
  if (compiledRuntime && onchainRuntime && compiledRuntime === onchainRuntime) {
    console.log("Current implementation already matches local source");
    return;
  }

  const factory = new ethers.ContractFactory(
    compiled.abi,
    `0x${compiled.evm.bytecode.object}`,
    wallet
  );
  const implementation = await factory.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();
  console.log("New implementation:", implementationAddress);

  const proxyAdmin = new ethers.Contract(
    currentPointers.admin,
    [
      "function owner() view returns (address)",
      "function upgrade(address proxy, address implementation) external",
      "function upgradeAndCall(address proxy, address implementation, bytes data) external payable",
    ],
    wallet
  );

  const adminOwner = await proxyAdmin.owner();
  console.log("ProxyAdmin owner:", adminOwner);
  if (adminOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error("Configured PRIVATE_KEY is not the ProxyAdmin owner");
  }

  let upgradeTx;
  try {
    upgradeTx = await proxyAdmin.upgrade(proxyAddress, implementationAddress);
    console.log("Upgrade tx (upgrade):", upgradeTx.hash);
  } catch (error) {
    console.warn(
      "ProxyAdmin.upgrade failed; retrying with upgradeAndCall:",
      error?.shortMessage || error?.message || error
    );
    upgradeTx = await proxyAdmin.upgradeAndCall(proxyAddress, implementationAddress, "0x");
    console.log("Upgrade tx (upgradeAndCall):", upgradeTx.hash);
  }
  await upgradeTx.wait();
  console.log("Upgrade complete");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
