const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");
require("dotenv").config();

const ROOT = path.resolve(__dirname, "..");
const IMPLEMENTATION_SOURCE = "contracts/8bitPenguins.sol";
const IMPLEMENTATION_CONTRACT = "EightBitPenguinsUpgradeable";
const PROXY_ADMIN_SOURCE = "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
const PROXY_ADMIN_CONTRACT = "ProxyAdmin";
const TRANSPARENT_PROXY_SOURCE = "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
const TRANSPARENT_PROXY_CONTRACT = "TransparentUpgradeableProxy";

function readFile(relativePath) {
  const projectPath = path.join(ROOT, relativePath);
  if (fs.existsSync(projectPath) && fs.statSync(projectPath).isFile()) {
    return fs.readFileSync(projectPath, "utf8");
  }

  const nodeModulesPath = path.join(ROOT, "node_modules", relativePath);
  if (fs.existsSync(nodeModulesPath) && fs.statSync(nodeModulesPath).isFile()) {
    return fs.readFileSync(nodeModulesPath, "utf8");
  }

  throw new Error(`File not found: ${relativePath}`);
}

function resolveImport(importPath) {
  try {
    return { contents: readFile(importPath) };
  } catch (error) {
    return { error: String(error?.message || error) };
  }
}

function compileDeploymentArtifacts() {
  const input = {
    language: "Solidity",
    sources: {
      [IMPLEMENTATION_SOURCE]: { content: readFile(IMPLEMENTATION_SOURCE) },
      [PROXY_ADMIN_SOURCE]: { content: readFile(PROXY_ADMIN_SOURCE) },
      [TRANSPARENT_PROXY_SOURCE]: { content: readFile(TRANSPARENT_PROXY_SOURCE) },
    },
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
  const diagnostics = Array.isArray(output.errors) ? output.errors : [];
  const fatal = diagnostics.filter((entry) => entry.severity === "error");
  diagnostics.forEach((entry) => {
    const level = String(entry.severity || "info").toUpperCase();
    console.log(`${level}: ${entry.formattedMessage || entry.message || entry}`);
  });
  if (fatal.length > 0) {
    throw new Error("Compilation failed");
  }

  return output.contracts || {};
}

function getArtifact(compiled, sourcePath, contractName) {
  const artifact = compiled?.[sourcePath]?.[contractName];
  if (!artifact?.abi || !artifact?.evm?.bytecode?.object) {
    throw new Error(`Missing artifact for ${sourcePath}:${contractName}`);
  }
  const bytecode = String(artifact.evm.bytecode.object || "");
  return {
    abi: artifact.abi,
    bytecode: bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`,
  };
}

async function deployContract(wallet, artifact, args = []) {
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const rpcUrl = String(
    process.env.ETH_MAINNET_RPC_URL ||
      process.env.MAINNET_RPC_URL ||
      process.env.VITE_RPC_URL ||
      ""
  ).trim();
  const privateKey = String(process.env.PRIVATE_KEY || "").trim();

  if (!rpcUrl || !privateKey) {
    throw new Error("Missing ETH_MAINNET_RPC_URL (or MAINNET_RPC_URL/VITE_RPC_URL) or PRIVATE_KEY");
  }

  console.log("Compiling implementation + transparent proxy artifacts...");
  const compiled = compileDeploymentArtifacts();
  const implementationArtifact = getArtifact(compiled, IMPLEMENTATION_SOURCE, IMPLEMENTATION_CONTRACT);
  const proxyAdminArtifact = getArtifact(compiled, PROXY_ADMIN_SOURCE, PROXY_ADMIN_CONTRACT);
  const transparentProxyArtifact = getArtifact(compiled, TRANSPARENT_PROXY_SOURCE, TRANSPARENT_PROXY_CONTRACT);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId !== 1) {
    throw new Error(`Refusing deploy: connected chainId=${chainId}, expected 1 (Ethereum Mainnet)`);
  }

  console.log("Network:", `chainId=${chainId}`);
  console.log("Deployer:", wallet.address);

  const implementation = await deployContract(wallet, implementationArtifact);
  const implementationAddress = await implementation.getAddress();
  console.log("Implementation:", implementationAddress);

  const proxyAdmin = await deployContract(wallet, proxyAdminArtifact);
  const proxyAdminAddress = await proxyAdmin.getAddress();
  console.log("ProxyAdmin:", proxyAdminAddress);

  const initializerIface = new ethers.Interface(implementationArtifact.abi);
  const initializeData = initializerIface.encodeFunctionData("initialize");
  const proxy = await deployContract(wallet, transparentProxyArtifact, [
    implementationAddress,
    proxyAdminAddress,
    initializeData,
  ]);
  const proxyAddress = await proxy.getAddress();
  console.log("Proxy (use this):", proxyAddress);

  const live = new ethers.Contract(proxyAddress, implementationArtifact.abi, provider);
  const [name, symbol, owner] = await Promise.all([live.name(), live.symbol(), live.owner()]);
  console.log("Initialized name/symbol:", `${name} / ${symbol}`);
  console.log("Owner:", owner);

  console.log("");
  console.log("=== COPY TO .env ===");
  console.log(`VITE_CONTRACT_ADDRESS=${proxyAddress}`);
  console.log(`CONTRACT_ADDRESS=${proxyAddress}`);
  console.log(`PROXY_ADMIN_ADDRESS=${proxyAdminAddress}`);
  console.log(`IMPLEMENTATION_ADDRESS=${implementationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
