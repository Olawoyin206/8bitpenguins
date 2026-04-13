const fs = require("fs");
const path = require("path");
const solc = require("solc");
const hre = require("hardhat");
const { getContractAddress } = require("./_config.cjs");

const CONTRACT_SOURCE_PATH = "contracts/8bitPenguins.sol";
const CONTRACT_NAME = "EightBitPenguinsUpgradeable";
const PROXY_ADMIN_ABI = [
  "function owner() view returns (address)",
  "function UPGRADE_INTERFACE_VERSION() view returns (string)",
  "function upgradeAndCall(address proxy, address implementation, bytes data) external payable",
];

function resolveImport(importPath) {
  const candidates = [
    path.resolve(process.cwd(), importPath),
    path.resolve(process.cwd(), "node_modules", importPath),
    path.resolve(process.cwd(), path.dirname(CONTRACT_SOURCE_PATH), importPath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `File not found: ${importPath}` };
}

function compileImplementation() {
  const source = fs.readFileSync(path.resolve(process.cwd(), CONTRACT_SOURCE_PATH), "utf8");
  const input = {
    language: "Solidity",
    sources: {
      [CONTRACT_SOURCE_PATH]: { content: source },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
      metadata: {
        bytecodeHash: "none",
      },
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

  const contractOutput = output.contracts?.[CONTRACT_SOURCE_PATH]?.[CONTRACT_NAME];
  const bytecode = contractOutput?.evm?.bytecode?.object;
  const abi = contractOutput?.abi;

  if (!abi || !bytecode) {
    throw new Error("Failed to produce ABI/bytecode for implementation");
  }

  return {
    abi,
    bytecode: bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`,
  };
}

async function main() {
  const proxyAddress = getContractAddress();
  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("Proxy:", proxyAddress);
  console.log("Signer:", signerAddress);
  console.log("Compiling implementation with solc viaIR...");

  const { abi, bytecode } = compileImplementation();

  console.log("Deploying new implementation...");
  const factory = new hre.ethers.ContractFactory(abi, bytecode, signer);
  const implementation = await factory.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  console.log("Implementation deployed:", implementationAddress);

  const oldImplementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  const proxyAdminAddress = await hre.upgrades.erc1967.getAdminAddress(proxyAddress);
  const proxyAdmin = new hre.ethers.Contract(proxyAdminAddress, PROXY_ADMIN_ABI, signer);
  const proxyAdminOwner = await proxyAdmin.owner();

  console.log("Previous implementation:", oldImplementationAddress);
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

  const upgradeTx = await proxyAdmin.upgradeAndCall(proxyAddress, implementationAddress, "0x");
  console.log("Upgrade tx:", upgradeTx.hash);
  await upgradeTx.wait();

  const liveImplementationAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  if (liveImplementationAddress.toLowerCase() !== implementationAddress.toLowerCase()) {
    throw new Error(`Upgrade mismatch: expected ${implementationAddress}, got ${liveImplementationAddress}`);
  }

  console.log("Upgrade complete");
  console.log("Proxy:", proxyAddress);
  console.log("Implementation:", liveImplementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
