#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

dotenv.config();

const ROOT = path.resolve(__dirname, "..");
const MAIN_SOURCE_PATH = "contracts/8bitPenguins.sol";
const MAIN_CONTRACT_NAME = "EightBitPenguinsUpgradeable";
const BUILDER_SOURCE_PATH = "contracts/EightBitPenguinsMetadataBuilder.sol";
const BUILDER_CONTRACT_NAME = "EightBitPenguinsMetadataBuilder";

const MAX_CODE_SIZE = 24576;
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const PROXY_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function UPGRADE_INTERFACE_VERSION() view returns (string)",
  "function upgrade(address proxy, address implementation) external",
  "function upgradeAndCall(address proxy, address implementation, bytes data) external payable",
];

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function resolveImport(importPath) {
  const candidates = [
    path.resolve(ROOT, importPath),
    path.resolve(ROOT, "contracts", importPath),
    path.resolve(ROOT, "node_modules", importPath),
    path.resolve(ROOT, path.dirname(MAIN_SOURCE_PATH), importPath),
    path.resolve(ROOT, path.dirname(BUILDER_SOURCE_PATH), importPath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `File not found: ${importPath}` };
}

function compileArtifacts() {
  const input = {
    language: "Solidity",
    sources: {
      [MAIN_SOURCE_PATH]: { content: readSource(MAIN_SOURCE_PATH) },
      [BUILDER_SOURCE_PATH]: { content: readSource(BUILDER_SOURCE_PATH) },
    },
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      metadata: { bytecodeHash: "none" },
      debug: { revertStrings: "strip" },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));
  const diagnostics = Array.isArray(output.errors) ? output.errors : [];
  const fatal = diagnostics.filter((entry) => entry.severity === "error");

  diagnostics.forEach((entry) => {
    const level = String(entry.severity || "info").toUpperCase();
    const message = entry.formattedMessage || entry.message || String(entry);
    console.log(`${level}: ${message}`);
  });

  if (fatal.length > 0) {
    throw new Error("solc compile failed");
  }

  const main = output.contracts?.[MAIN_SOURCE_PATH]?.[MAIN_CONTRACT_NAME];
  const builder = output.contracts?.[BUILDER_SOURCE_PATH]?.[BUILDER_CONTRACT_NAME];
  if (!main || !builder) {
    throw new Error("Missing compiled outputs for main contract or metadata builder");
  }

  const mainBytecode = main.evm?.bytecode?.object || "";
  const mainSize = mainBytecode.length / 2;
  console.log(`Implementation bytecode size: ${mainSize} bytes`);
  if (mainSize > MAX_CODE_SIZE) {
    throw new Error(`Implementation exceeds max deployable code size (${mainSize} > ${MAX_CODE_SIZE})`);
  }

  return {
    main: {
      abi: main.abi,
      bytecode: mainBytecode.startsWith("0x") ? mainBytecode : `0x${mainBytecode}`,
    },
    builder: {
      abi: builder.abi,
      bytecode: (builder.evm?.bytecode?.object || "").startsWith("0x")
        ? builder.evm.bytecode.object
        : `0x${builder.evm?.bytecode?.object || ""}`,
    },
  };
}

function envValue(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

async function waitTx(label, txPromise) {
  const tx = await txPromise;
  console.log(`${label}: submitted ${tx.hash}`);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${label}: transaction reverted`);
  }
  console.log(`${label}: confirmed in block ${receipt.blockNumber}`);
  return receipt;
}

async function findProxyAdminAddress(provider, proxyAddress) {
  const slotValue = await provider.getStorage(proxyAddress, ADMIN_SLOT);
  if (!slotValue || /^0x0+$/.test(slotValue)) {
    throw new Error("Could not read proxy admin slot.");
  }
  return ethers.getAddress(`0x${slotValue.slice(-40)}`);
}

async function pickVerificationToken(contract) {
  const totalSupply = Number(await contract.totalSupply());
  if (!Number.isFinite(totalSupply) || totalSupply <= 0) return 0;

  const explicit = Number(process.env.VERIFY_TOKEN_ID || 0);
  if (Number.isInteger(explicit) && explicit > 0 && explicit <= totalSupply) {
    return explicit;
  }

  const maxProbe = Math.min(totalSupply, 200);
  for (let tokenId = totalSupply; tokenId > Math.max(0, totalSupply - maxProbe); tokenId--) {
    try {
      const evolved = await contract.tokenEvolved3D(tokenId);
      if (evolved) return tokenId;
    } catch {
      // Ignore and continue probing.
    }
  }

  return Math.min(totalSupply, 1);
}

async function main() {
  const rpcUrl = envValue("ETH_MAINNET_RPC_URL", "MAINNET_RPC_URL", "VITE_RPC_URL", "ETH_SEPOLIA_RPC_URL", "BASE_SEPOLIA_RPC_URL");
  const privateKey = envValue("PRIVATE_KEY");
  const proxyAddress = envValue("CONTRACT_ADDRESS", "VITE_CONTRACT_ADDRESS");

  if (!rpcUrl || !privateKey || !proxyAddress) {
    throw new Error("Missing required env vars. Need mainnet RPC URL, PRIVATE_KEY, CONTRACT_ADDRESS.");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();
  console.log(`Network: chainId=${network.chainId}`);
  console.log(`Signer: ${wallet.address}`);
  console.log(`Proxy: ${proxyAddress}`);

  console.log("Compiling contracts with optimizer + viaIR...");
  const compiled = compileArtifacts();

  const proxyAdminAddress = await findProxyAdminAddress(provider, proxyAddress);
  console.log(`ProxyAdmin: ${proxyAdminAddress}`);

  const builderFactory = new ethers.ContractFactory(compiled.builder.abi, compiled.builder.bytecode, wallet);
  const builder = await builderFactory.deploy();
  await builder.waitForDeployment();
  const builderAddress = await builder.getAddress();
  console.log(`MetadataBuilder deployed: ${builderAddress}`);

  const implFactory = new ethers.ContractFactory(compiled.main.abi, compiled.main.bytecode, wallet);
  const implementation = await implFactory.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();
  console.log(`Implementation deployed: ${implementationAddress}`);

  const proxyAdmin = new ethers.Contract(proxyAdminAddress, PROXY_ADMIN_ABI, wallet);
  try {
    const adminOwner = await proxyAdmin.owner();
    console.log(`ProxyAdmin owner: ${adminOwner}`);
  } catch (error) {
    console.log(`ProxyAdmin owner unavailable: ${error?.shortMessage || error?.message || error}`);
  }

  try {
    const version = await proxyAdmin.UPGRADE_INTERFACE_VERSION();
    console.log(`ProxyAdmin upgrade interface: ${version}`);
  } catch (error) {
    console.log(`ProxyAdmin upgrade interface unavailable: ${error?.shortMessage || error?.message || error}`);
  }

  await waitTx("Upgrade proxy", proxyAdmin.upgradeAndCall(proxyAddress, implementationAddress, "0x"));

  const proxy = new ethers.Contract(proxyAddress, compiled.main.abi, wallet);
  await waitTx("Set metadata builder", proxy.setMetadataBuilder(builderAddress));

  const verifyTokenId = await pickVerificationToken(proxy);
  if (verifyTokenId > 0) {
    const metadata = await proxy.tokenMetadataJson(verifyTokenId);
    const has2D = metadata.includes('"image_2d"');
    const has3D = metadata.includes('"image_3d"');
    console.log(`Verification token: #${verifyTokenId}`);
    console.log(`Contains image_2d: ${has2D}`);
    console.log(`Contains image_3d: ${has3D}`);
    if (!has2D || !has3D) {
      throw new Error("Post-upgrade verification failed: tokenMetadataJson missing image_2d or image_3d.");
    }
  } else {
    console.log("Verification skipped: no minted token found.");
  }

  console.log("Rollout complete.");
  console.log(`Builder: ${builderAddress}`);
  console.log(`Implementation: ${implementationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
