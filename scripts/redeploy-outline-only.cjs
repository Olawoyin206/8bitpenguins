const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");
require("dotenv").config();

const ROOT = process.cwd();
const DEFAULT_PROXY = "0x7652D81dCc83fAaF55371C18C47be51Af67C19A5";

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

function compileContracts() {
  const input = {
    language: "Solidity",
    sources: {
      "contracts/EightBitPenguinsOnchainRenderer.sol": {
        content: readSource("contracts/EightBitPenguinsOnchainRenderer.sol"),
      },
      "contracts/PenguinBodyOutlineSVG.sol": {
        content: readSource("contracts/PenguinBodyOutlineSVG.sol"),
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
  const errors = (output.errors || []).filter((entry) => entry.severity === "error");
  if (errors.length) {
    throw new Error(errors.map((entry) => entry.formattedMessage).join("\n\n"));
  }

  return output.contracts;
}

function getContractOutput(compiled, relPath, contractName) {
  const fileOutput = compiled[relPath];
  if (!fileOutput || !fileOutput[contractName]) {
    throw new Error(`Missing compiled output for ${relPath}:${contractName}`);
  }
  return fileOutput[contractName];
}

async function deployContract(wallet, contractOutput, args = []) {
  const factory = new ethers.ContractFactory(contractOutput.abi, contractOutput.evm.bytecode.object, wallet);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const rpcUrl =
    process.env.ETH_MAINNET_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    process.env.ETH_SEPOLIA_RPC_URL ||
    process.env.VITE_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const proxyAddress = (process.env.CONTRACT_ADDRESS || process.env.VITE_CONTRACT_ADDRESS || DEFAULT_PROXY).trim();

  if (!rpcUrl || !privateKey) {
    throw new Error("Missing RPC URL (ETH_MAINNET_RPC_URL/MAINNET_RPC_URL/VITE_RPC_URL) or PRIVATE_KEY");
  }

  const compiled = compileContracts();
  const bodyOutlineOutput = getContractOutput(compiled, "contracts/PenguinBodyOutlineSVG.sol", "PenguinBodyOutlineSVG");
  const rendererOutput = getContractOutput(compiled, "contracts/EightBitPenguinsOnchainRenderer.sol", "EightBitPenguinsOnchainRenderer");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const nft = new ethers.Contract(
    proxyAddress,
    [
      "function getOnchainRenderer() view returns (address)",
      "function setOnchainRenderer(address renderer) external",
    ],
    wallet
  );

  const currentRendererAddress = await nft.getOnchainRenderer();
  const currentRenderer = new ethers.Contract(
    currentRendererAddress,
    [
      "function backgroundRenderer() view returns (address)",
      "function snowFxRenderer() view returns (address)",
      "function dotsFxRenderer() view returns (address)",
      "function torsoRenderer() view returns (address)",
      "function torsoBellyRenderer() view returns (address)",
      "function wingsRenderer() view returns (address)",
      "function headBaseRenderer() view returns (address)",
      "function capRenderer() view returns (address)",
      "function beanieRenderer() view returns (address)",
      "function scarfRenderer() view returns (address)",
      "function headbandRenderer() view returns (address)",
      "function crownRenderer() view returns (address)",
      "function haloRenderer() view returns (address)",
      "function faceRenderer() view returns (address)",
      "function feetRenderer() view returns (address)",
      "function bodyOutlineRenderer() view returns (address)",
      "function accessoryOutlineRenderer() view returns (address)",
      "function faceDetailsOutlineRenderer() view returns (address)",
      "function feetOutlineRenderer() view returns (address)",
    ],
    provider
  );

  const currentParts = await Promise.all([
    currentRenderer.backgroundRenderer(),
    currentRenderer.snowFxRenderer(),
    currentRenderer.dotsFxRenderer(),
    currentRenderer.torsoRenderer(),
    currentRenderer.torsoBellyRenderer(),
    currentRenderer.wingsRenderer(),
    currentRenderer.headBaseRenderer(),
    currentRenderer.capRenderer(),
    currentRenderer.beanieRenderer(),
    currentRenderer.scarfRenderer(),
    currentRenderer.headbandRenderer(),
    currentRenderer.crownRenderer(),
    currentRenderer.haloRenderer(),
    currentRenderer.faceRenderer(),
    currentRenderer.feetRenderer(),
    currentRenderer.bodyOutlineRenderer(),
    currentRenderer.accessoryOutlineRenderer(),
    currentRenderer.faceDetailsOutlineRenderer(),
    currentRenderer.feetOutlineRenderer(),
  ]);

  console.log("Deployer:", wallet.address);
  console.log("Proxy:", proxyAddress);
  console.log("Current renderer:", currentRendererAddress);
  console.log("Current body outline:", currentParts[15]);

  const bodyOutline = await deployContract(wallet, bodyOutlineOutput);
  const bodyOutlineAddress = await bodyOutline.getAddress();
  console.log("New body outline:", bodyOutlineAddress);

  const rendererArgs = [
    currentParts[0],
    currentParts[1],
    currentParts[2],
    currentParts[3],
    currentParts[4],
    currentParts[5],
    currentParts[6],
    currentParts[7],
    currentParts[8],
    currentParts[9],
    currentParts[10],
    currentParts[11],
    currentParts[12],
    currentParts[13],
    currentParts[14],
    bodyOutlineAddress,
    currentParts[16],
    currentParts[17],
    currentParts[18],
  ];

  const renderer = await deployContract(wallet, rendererOutput, rendererArgs);
  const rendererAddress = await renderer.getAddress();
  console.log("New renderer:", rendererAddress);

  const setTx = await nft.setOnchainRenderer(rendererAddress);
  console.log("Set renderer tx:", setTx.hash);
  await setTx.wait();

  console.log("Outline-only redeploy complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
