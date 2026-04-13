const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config();
const { getContractAddress } = require("./_config.cjs");

const ROOT = path.resolve(__dirname, "..");
const IMPLEMENTATION_SLOT = "0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC";
const ETHERSCAN_API = "https://api.etherscan.io/v2/api";
const CHAIN_ID = String(process.env.ETHERSCAN_CHAIN_ID || process.env.CHAIN_ID || "1");
const COMPILER_VERSION = "v0.8.26+commit.8a97fa7a";
const CONTRACT_NAME = "contracts/8bitPenguins.sol:EightBitPenguinsUpgradeable";

function asPosix(p) {
  return String(p || "").replace(/\\/g, "/");
}

function resolveFilePath(importKey) {
  const key = asPosix(importKey);
  const candidates = [
    path.join(ROOT, key),
    path.join(ROOT, "node_modules", key),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return "";
}

function extractImports(content) {
  const imports = [];
  const re = /import\s+(?:[^'"]*from\s+)?["']([^"']+)["'];/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

function resolveImportKey(currentKey, childImport) {
  if (childImport.startsWith(".")) {
    return asPosix(path.posix.normalize(path.posix.join(path.posix.dirname(currentKey), childImport)));
  }
  return asPosix(childImport);
}

function buildSources(entryKey) {
  const sources = {};
  const seen = new Set();
  const stack = [asPosix(entryKey)];

  while (stack.length > 0) {
    const key = stack.pop();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const filePath = resolveFilePath(key);
    if (!filePath) {
      throw new Error(`Unable to resolve source: ${key}`);
    }

    const content = fs.readFileSync(filePath, "utf8");
    sources[key] = { content };

    const children = extractImports(content);
    for (const child of children) {
      const childKey = resolveImportKey(key, child);
      if (!seen.has(childKey)) stack.push(childKey);
    }
  }

  return sources;
}

function slotToAddress(slotHex) {
  const stripped = String(slotHex || "").replace(/^0x/, "");
  return ethers.getAddress(`0x${stripped.slice(-40)}`);
}

async function postApi(params) {
  const body = new URLSearchParams({ ...params });
  const url = `${ETHERSCAN_API}?chainid=${encodeURIComponent(CHAIN_ID)}`;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Unexpected Etherscan response: ${text}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt >= 5) break;
      const waitMs = 2000 * attempt;
      console.log(`POST retry ${attempt}/5 after network error...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function getApi(params) {
  const query = new URLSearchParams({ ...params }).toString();
  const url = `${ETHERSCAN_API}?chainid=${encodeURIComponent(CHAIN_ID)}&${query}`;
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Unexpected Etherscan response: ${text}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt >= 5) break;
      const waitMs = 2000 * attempt;
      console.log(`GET retry ${attempt}/5 after network error...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

async function pollStatus(action, guid, apiKey) {
  const maxAttempts = 45;
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    const status = await getApi({
      module: "contract",
      action,
      guid,
      apikey: apiKey,
    });
    const resultText = String(status?.result || "");
    if (String(status?.status) === "1" || /already verified/i.test(resultText)) {
      return status;
    }
    if (/failed|unable|error/i.test(resultText)) {
      throw new Error(`${action} failed: ${resultText}`);
    }
    console.log(`${action} pending: ${resultText || "in queue"}`);
  }
  throw new Error(`${action} timed out`);
}

async function main() {
  const apiKey = process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY;
  if (!apiKey) throw new Error("Missing ETHERSCAN_API_KEY / BASESCAN_API_KEY");

  const proxyAddress = getContractAddress();
  let implementationAddress = (process.env.IMPLEMENTATION_ADDRESS || "").trim();
  if (!implementationAddress) {
    const rpcUrl =
      process.env.ETH_MAINNET_RPC_URL ||
      process.env.MAINNET_RPC_URL ||
      process.env.ETH_SEPOLIA_RPC_URL ||
      process.env.VITE_RPC_URL ||
      "https://ethereum-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const implSlot = await provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
    implementationAddress = slotToAddress(implSlot);
  } else {
    implementationAddress = ethers.getAddress(implementationAddress);
  }

  console.log("Proxy:", proxyAddress);
  console.log("Implementation:", implementationAddress);

  const sources = buildSources("contracts/8bitPenguins.sol");
  const compilerInput = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      metadata: { bytecodeHash: "none" },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  console.log("Submitting implementation verification...");
  const verifyResult = await postApi({
    module: "contract",
    action: "verifysourcecode",
    contractaddress: implementationAddress,
    sourceCode: JSON.stringify(compilerInput),
    codeformat: "solidity-standard-json-input",
    contractname: CONTRACT_NAME,
    compilerversion: COMPILER_VERSION,
    optimizationUsed: "1",
    runs: "1",
    constructorArguments: "",
    apikey: apiKey,
  });

  if (String(verifyResult?.status) !== "1") {
    throw new Error(`Implementation verify submit failed: ${verifyResult?.result || "unknown error"}`);
  }

  const implGuid = String(verifyResult.result || "");
  console.log("Implementation verify GUID:", implGuid);
  await pollStatus("checkverifystatus", implGuid, apiKey);
  console.log("Implementation verified.");

  console.log("Submitting proxy verification...");
  const proxyVerify = await postApi({
    module: "contract",
    action: "verifyproxycontract",
    address: proxyAddress,
    expectedimplementation: implementationAddress,
    apikey: apiKey,
  });

  if (String(proxyVerify?.status) !== "1") {
    throw new Error(`Proxy verify submit failed: ${proxyVerify?.result || "unknown error"}`);
  }

  const proxyGuid = String(proxyVerify.result || "");
  console.log("Proxy verify GUID:", proxyGuid);
  await pollStatus("checkproxyverification", proxyGuid, apiKey);
  console.log("Proxy verification completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
