#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");
require("dotenv").config();
const { getContractAddress } = require("./_config.cjs");

const ROOT = path.resolve(__dirname, "..");
const HELPER_SOURCE = "contracts/EightBitPenguinsRandomnessHelper.sol";
const HELPER_CONTRACT = "EightBitPenguinsRandomnessHelper";

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

function compileRandomnessHelper() {
  const input = {
    language: "Solidity",
    sources: {
      [HELPER_SOURCE]: { content: readSource(HELPER_SOURCE) },
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
    throw new Error("Randomness helper compile failed");
  }

  const helper = output.contracts?.[HELPER_SOURCE]?.[HELPER_CONTRACT];
  if (!helper?.abi || !helper?.evm?.bytecode?.object) {
    throw new Error("Missing randomness helper ABI/bytecode");
  }

  return {
    abi: helper.abi,
    bytecode: helper.evm.bytecode.object.startsWith("0x")
      ? helper.evm.bytecode.object
      : `0x${helper.evm.bytecode.object}`,
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
  console.log("Compiling randomness helper...");

  const helper = compileRandomnessHelper();
  const factory = new ethers.ContractFactory(helper.abi, helper.bytecode, wallet);

  console.log("Deploying randomness helper...");
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  const helperAddress = await deployed.getAddress();
  console.log(`Randomness helper deployed: ${helperAddress}`);

  const proxy = new ethers.Contract(
    proxyAddress,
    [
      "function setRandomnessHelper(address helper) external",
      "function owner() view returns (address)",
      "function mintModeConfigured() view returns (bool)",
      "function directMintEnabled() view returns (bool)",
    ],
    wallet
  );

  const owner = await proxy.owner();
  console.log(`Proxy owner: ${owner}`);
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Signer ${wallet.address} is not contract owner ${owner}`);
  }

  await waitTx("Set randomness helper", proxy.setRandomnessHelper(helperAddress));

  console.log("Done.");
  console.log(`Randomness helper address: ${helperAddress}`);
  console.log(`mintModeConfigured: ${await proxy.mintModeConfigured()}`);
  console.log(`directMintEnabled: ${await proxy.directMintEnabled()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
