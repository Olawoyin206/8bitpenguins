#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");
require("dotenv").config();
const { getContractAddress } = require("./_config.cjs");

const ROOT = path.resolve(__dirname, "..");
const BUILDER_SOURCE = "contracts/EightBitPenguinsMetadataBuilder.sol";
const BUILDER_CONTRACT = "EightBitPenguinsMetadataBuilder";

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function resolveImport(importPath) {
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

function compileBuilder() {
  const input = {
    language: "Solidity",
    sources: {
      [BUILDER_SOURCE]: { content: readSource(BUILDER_SOURCE) },
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
    throw new Error("Builder compile failed");
  }

  const builder = output.contracts?.[BUILDER_SOURCE]?.[BUILDER_CONTRACT];
  if (!builder?.abi || !builder?.evm?.bytecode?.object) {
    throw new Error("Missing builder ABI/bytecode");
  }

  return {
    abi: builder.abi,
    bytecode: builder.evm.bytecode.object.startsWith("0x")
      ? builder.evm.bytecode.object
      : `0x${builder.evm.bytecode.object}`,
  };
}

async function waitTx(label, txPromise) {
  const tx = await txPromise;
  console.log(`${label} tx: ${tx.hash}`);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${label} reverted`);
  }
  console.log(`${label} confirmed in block ${receipt.blockNumber}`);
}

async function main() {
  const rpcUrl = String(
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.VITE_RPC_URL ||
    process.env.ETH_SEPOLIA_RPC_URL ||
    process.env.BASE_SEPOLIA_RPC_URL ||
    ""
  ).trim();
  const privateKey = String(process.env.PRIVATE_KEY || "").trim();
  if (!rpcUrl || !privateKey) {
    throw new Error("Missing mainnet RPC URL (ETH_MAINNET_RPC_URL/MAINNET_RPC_URL/VITE_RPC_URL) / PRIVATE_KEY");
  }

  const proxyAddress = getContractAddress();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const network = await provider.getNetwork();

  console.log(`Network chainId: ${network.chainId}`);
  console.log(`Signer: ${wallet.address}`);
  console.log(`Proxy: ${proxyAddress}`);
  console.log("Compiling metadata builder...");

  const builder = compileBuilder();
  const factory = new ethers.ContractFactory(builder.abi, builder.bytecode, wallet);

  console.log("Deploying metadata builder...");
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  const builderAddress = await deployed.getAddress();
  console.log(`Metadata builder deployed: ${builderAddress}`);

  const proxy = new ethers.Contract(
    proxyAddress,
    [
      "function setMetadataBuilder(address builder) external",
      "function owner() view returns (address)",
    ],
    wallet
  );

  const owner = await proxy.owner();
  console.log(`Proxy owner: ${owner}`);
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Signer ${wallet.address} is not contract owner ${owner}`);
  }

  await waitTx("Set metadata builder", proxy.setMetadataBuilder(builderAddress));

  console.log("Done.");
  console.log(`Builder address: ${builderAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
