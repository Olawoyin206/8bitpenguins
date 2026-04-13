const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { ethers } = require("ethers");
require("dotenv").config();
const { getContractAddress } = require("./_config.cjs");

const ROOT = path.resolve(__dirname, "..");
const MAX_CODE_SIZE = 24576;
const IMPLEMENTATION_SLOT = "0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

const BASE_REQUIRED_SOURCES = [
  "contracts/8bitPenguins.sol",
  "contracts/EightBitPenguinsOnchainRenderer.sol",
  "contracts/EightBitPenguinsRendererData.sol",
  "contracts/EightBitPenguinsRendererLayers.sol",
  "contracts/PenguinBackgroundSVG.sol",
  "contracts/PenguinSnowFxSVG.sol",
  "contracts/PenguinDotsFxSVG.sol",
  "contracts/PenguinTorsoSVG.sol",
  "contracts/PenguinTorsoBellySVG.sol",
  "contracts/PenguinWingsSVG.sol",
  "contracts/PenguinHeadBaseSVG.sol",
  "contracts/PenguinCapSVG.sol",
  "contracts/PenguinBeanieSVG.sol",
  "contracts/PenguinScarfSVG.sol",
  "contracts/PenguinHeadbandSVG.sol",
  "contracts/PenguinCrownSVG.sol",
  "contracts/PenguinHaloSVG.sol",
  "contracts/PenguinFaceSVG.sol",
  "contracts/PenguinFeetSVG.sol",
  "contracts/PenguinBodyOutlineSVG.sol",
  "contracts/PenguinAccessoryOutlineSVG.sol",
  "contracts/PenguinFaceDetailsOutlineSVG.sol",
  "contracts/PenguinFeetOutlineSVG.sol",
];

function getRequiredSources(rendererOnly) {
  return rendererOnly
    ? BASE_REQUIRED_SOURCES.filter((file) => file !== "contracts/8bitPenguins.sol")
    : BASE_REQUIRED_SOURCES;
}

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

function buildCompilerInput(rendererOnly) {
  const sources = {};
  for (const relPath of getRequiredSources(rendererOnly)) {
    sources[relPath] = { content: readSource(relPath) };
  }
  return {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "storageLayout"],
        },
      },
    },
  };
}

function compileContracts(rendererOnly) {
  const output = JSON.parse(solc.compile(JSON.stringify(buildCompilerInput(rendererOnly)), { import: findImport }));
  const errors = output.errors || [];
  const fatal = errors.filter((entry) => entry.severity === "error");
  errors.forEach((entry) => {
    const level = entry.severity.toUpperCase();
    console.log(`${level}: ${entry.formattedMessage}`);
  });
  if (fatal.length > 0) {
    throw new Error("solc compilation failed");
  }
  return output.contracts || {};
}

function getContractOutput(compiled, file, name) {
  const contract = compiled?.[file]?.[name];
  if (!contract) {
    throw new Error(`Missing compiled output for ${file}:${name}`);
  }
  return contract;
}

function codeSize(contractOutput) {
  return (contractOutput.evm?.bytecode?.object || "").length / 2;
}

function normalizeHex(data) {
  return String(data || "").toLowerCase().replace(/^0x/, "");
}

async function implementationMatchesCompiled(provider, currentImplementation, contractOutput) {
  const onchainCode = normalizeHex(await provider.getCode(currentImplementation));
  const compiledRuntime = normalizeHex(contractOutput.evm?.deployedBytecode?.object || "");
  return Boolean(onchainCode) && Boolean(compiledRuntime) && onchainCode === compiledRuntime;
}

function assertCodeSizes(compiled, rendererOnly) {
  const deployables = [
    ["contracts/EightBitPenguinsOnchainRenderer.sol", "EightBitPenguinsOnchainRenderer"],
    ["contracts/PenguinBackgroundSVG.sol", "PenguinBackgroundSVG"],
    ["contracts/PenguinSnowFxSVG.sol", "PenguinSnowFxSVG"],
    ["contracts/PenguinDotsFxSVG.sol", "PenguinDotsFxSVG"],
    ["contracts/PenguinTorsoSVG.sol", "PenguinTorsoSVG"],
    ["contracts/PenguinTorsoBellySVG.sol", "PenguinTorsoBellySVG"],
    ["contracts/PenguinWingsSVG.sol", "PenguinWingsSVG"],
    ["contracts/PenguinHeadBaseSVG.sol", "PenguinHeadBaseSVG"],
    ["contracts/PenguinCapSVG.sol", "PenguinCapSVG"],
    ["contracts/PenguinBeanieSVG.sol", "PenguinBeanieSVG"],
    ["contracts/PenguinScarfSVG.sol", "PenguinScarfSVG"],
    ["contracts/PenguinHeadbandSVG.sol", "PenguinHeadbandSVG"],
    ["contracts/PenguinCrownSVG.sol", "PenguinCrownSVG"],
    ["contracts/PenguinHaloSVG.sol", "PenguinHaloSVG"],
    ["contracts/PenguinFaceSVG.sol", "PenguinFaceSVG"],
    ["contracts/PenguinFeetSVG.sol", "PenguinFeetSVG"],
    ["contracts/PenguinBodyOutlineSVG.sol", "PenguinBodyOutlineSVG"],
    ["contracts/PenguinAccessoryOutlineSVG.sol", "PenguinAccessoryOutlineSVG"],
    ["contracts/PenguinFaceDetailsOutlineSVG.sol", "PenguinFaceDetailsOutlineSVG"],
    ["contracts/PenguinFeetOutlineSVG.sol", "PenguinFeetOutlineSVG"],
  ];
  if (!rendererOnly) {
    deployables.unshift(["contracts/8bitPenguins.sol", "EightBitPenguinsUpgradeable"]);
  }

  for (const [file, name] of deployables) {
    const size = codeSize(getContractOutput(compiled, file, name));
    console.log(`${name} bytecode: ${size} bytes`);
    if (size > MAX_CODE_SIZE) {
      throw new Error(`${name} exceeds max deployable code size: ${size}`);
    }
  }
}

function normalizeLayout(layout) {
  const types = layout?.types || {};
  return (layout?.storage || []).map((entry) => ({
    slot: String(entry.slot),
    offset: Number(entry.offset),
    type: types[entry.type]?.label || entry.type,
  }));
}

function implementationEntryMatches(entry, currentImplementation) {
  const target = currentImplementation.toLowerCase();
  const primary = String(entry?.address || "").toLowerCase();
  if (primary === target) return true;

  return (entry?.allAddresses || []).some((address) => String(address || "").toLowerCase() === target);
}

function resolveManifestPath() {
  const explicit = (process.env.OZ_MANIFEST_PATH || process.env.OZ_MANIFEST_FILE || "").trim();
  if (explicit) {
    return path.isAbsolute(explicit) ? explicit : path.join(ROOT, explicit);
  }

  const openzeppelinDir = path.join(ROOT, ".openzeppelin");
  const candidates = [
    process.env.HARDHAT_NETWORK ? `${String(process.env.HARDHAT_NETWORK).trim()}.json` : "",
    process.env.OZ_NETWORK ? `${String(process.env.OZ_NETWORK).trim()}.json` : "",
    "mainnet.json",
    "unknown-1.json",
    "sepolia.json",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const candidatePath = path.join(openzeppelinDir, candidate);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return candidatePath;
    }
  }

  throw new Error(
    "Could not find OpenZeppelin manifest. Set OZ_MANIFEST_PATH (or OZ_MANIFEST_FILE) to the correct .openzeppelin/*.json file."
  );
}

function assertStorageLayoutCompatible(compiled, currentImplementation) {
  const manifestPath = resolveManifestPath();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const implEntries = Object.values(manifest.impls || {});
  let currentImplEntry = implEntries.find((entry) => (
    implementationEntryMatches(entry, currentImplementation)
  ));

  if (!currentImplEntry) {
    currentImplEntry = implEntries.at(-1);
    if (!currentImplEntry) {
      throw new Error(`Current implementation ${currentImplementation} not found in manifest and manifest has no baseline impls`);
    }
    console.warn(
      `WARNING: Current implementation ${currentImplementation} not found in manifest. ` +
      `Falling back to latest manifest layout at ${currentImplEntry.address} from ${manifestPath}.`
    );
  }

  const oldLayout = normalizeLayout(currentImplEntry.layout);
  const newLayout = normalizeLayout(getContractOutput(compiled, "contracts/8bitPenguins.sol", "EightBitPenguinsUpgradeable").storageLayout);

  if (newLayout.length < oldLayout.length) {
    throw new Error(`New storage layout is shorter than current layout (${newLayout.length} < ${oldLayout.length})`);
  }

  for (let i = 0; i < oldLayout.length; i++) {
    const oldEntry = oldLayout[i];
    const newEntry = newLayout[i];
    if (!newEntry) {
      throw new Error(`Missing new storage entry for index ${i}`);
    }
    const same =
      oldEntry.slot === newEntry.slot &&
      oldEntry.offset === newEntry.offset &&
      oldEntry.type === newEntry.type;
    if (!same) {
      throw new Error(
        `Storage layout mismatch at index ${i}: old=${JSON.stringify(oldEntry)} new=${JSON.stringify(newEntry)}`
      );
    }
  }

  console.log(`Storage layout check passed against ${currentImplementation}`);
}

function slotToAddress(rawValue) {
  return ethers.getAddress(`0x${rawValue.slice(-40)}`);
}

async function readProxyPointers(provider, proxyAddress) {
  const [implRaw, adminRaw] = await Promise.all([
    provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT),
    provider.getStorage(proxyAddress, ADMIN_SLOT),
  ]);
  return {
    implementation: slotToAddress(implRaw),
    admin: slotToAddress(adminRaw),
  };
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
  const compileOnly = process.env.COMPILE_ONLY === "1";
  const rendererOnly = process.env.RENDERER_ONLY === "1";
  if (!compileOnly && (!rpcUrl || !privateKey)) {
    throw new Error("Missing mainnet RPC URL (ETH_MAINNET_RPC_URL/MAINNET_RPC_URL/VITE_RPC_URL) or PRIVATE_KEY");
  }

  const compiled = compileContracts(rendererOnly);
  assertCodeSizes(compiled, rendererOnly);
  if (compileOnly) {
    console.log("Compile-only check passed");
    return;
  }

  const proxyAddress = getContractAddress();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deployer:", wallet.address);
  console.log("Proxy:", proxyAddress);

  const implementationOutput = rendererOnly ? null : getContractOutput(compiled, "contracts/8bitPenguins.sol", "EightBitPenguinsUpgradeable");

  const pointers = await readProxyPointers(provider, proxyAddress);
  console.log("Current implementation:", pointers.implementation);
  console.log("ProxyAdmin:", pointers.admin);

  const implementationUnchanged = rendererOnly
    ? true
    : await implementationMatchesCompiled(provider, pointers.implementation, implementationOutput);
  console.log("Implementation unchanged:", implementationUnchanged);

  if (!rendererOnly && !implementationUnchanged) {
    assertStorageLayoutCompatible(compiled, pointers.implementation);
  }

  const background = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinBackgroundSVG.sol", "PenguinBackgroundSVG"));
  const snowFx = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinSnowFxSVG.sol", "PenguinSnowFxSVG"));
  const dotsFx = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinDotsFxSVG.sol", "PenguinDotsFxSVG"));
  const torso = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinTorsoSVG.sol", "PenguinTorsoSVG"));
  const torsoBelly = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinTorsoBellySVG.sol", "PenguinTorsoBellySVG"));
  const wings = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinWingsSVG.sol", "PenguinWingsSVG"));
  const headBase = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinHeadBaseSVG.sol", "PenguinHeadBaseSVG"));
  const cap = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinCapSVG.sol", "PenguinCapSVG"));
  const beanie = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinBeanieSVG.sol", "PenguinBeanieSVG"));
  const scarf = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinScarfSVG.sol", "PenguinScarfSVG"));
  const headband = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinHeadbandSVG.sol", "PenguinHeadbandSVG"));
  const crown = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinCrownSVG.sol", "PenguinCrownSVG"));
  const halo = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinHaloSVG.sol", "PenguinHaloSVG"));
  const face = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinFaceSVG.sol", "PenguinFaceSVG"));
  const feet = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinFeetSVG.sol", "PenguinFeetSVG"));
  const bodyOutline = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinBodyOutlineSVG.sol", "PenguinBodyOutlineSVG"));
  const accessoryOutline = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinAccessoryOutlineSVG.sol", "PenguinAccessoryOutlineSVG"));
  const faceDetailsOutline = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinFaceDetailsOutlineSVG.sol", "PenguinFaceDetailsOutlineSVG"));
  const feetOutline = await deployContract(wallet, getContractOutput(compiled, "contracts/PenguinFeetOutlineSVG.sol", "PenguinFeetOutlineSVG"));

  const renderer = await deployContract(
    wallet,
    getContractOutput(compiled, "contracts/EightBitPenguinsOnchainRenderer.sol", "EightBitPenguinsOnchainRenderer"),
    [
      await background.getAddress(),
      await snowFx.getAddress(),
      await dotsFx.getAddress(),
      await torso.getAddress(),
      await torsoBelly.getAddress(),
      await wings.getAddress(),
      await headBase.getAddress(),
      await cap.getAddress(),
      await beanie.getAddress(),
      await scarf.getAddress(),
      await headband.getAddress(),
      await crown.getAddress(),
      await halo.getAddress(),
      await face.getAddress(),
      await feet.getAddress(),
      await bodyOutline.getAddress(),
      await accessoryOutline.getAddress(),
      await faceDetailsOutline.getAddress(),
      await feetOutline.getAddress(),
    ]
  );

  let implementation = null;
  if (!implementationUnchanged) {
    implementation = await deployContract(wallet, implementationOutput);
  }

  console.log("Background:", await background.getAddress());
  console.log("SnowFx:", await snowFx.getAddress());
  console.log("DotsFx:", await dotsFx.getAddress());
  console.log("Torso:", await torso.getAddress());
  console.log("TorsoBelly:", await torsoBelly.getAddress());
  console.log("Wings:", await wings.getAddress());
  console.log("HeadBase:", await headBase.getAddress());
  console.log("Cap:", await cap.getAddress());
  console.log("Beanie:", await beanie.getAddress());
  console.log("Scarf:", await scarf.getAddress());
  console.log("Headband:", await headband.getAddress());
  console.log("Crown:", await crown.getAddress());
  console.log("Halo:", await halo.getAddress());
  console.log("Face:", await face.getAddress());
  console.log("Feet:", await feet.getAddress());
  console.log("BodyOutline:", await bodyOutline.getAddress());
  console.log("AccessoryOutline:", await accessoryOutline.getAddress());
  console.log("FaceDetailsOutline:", await faceDetailsOutline.getAddress());
  console.log("FeetOutline:", await feetOutline.getAddress());
  console.log("Renderer:", await renderer.getAddress());
  console.log("New implementation:", implementation ? await implementation.getAddress() : pointers.implementation);

  const proxyAdmin = new ethers.Contract(
    pointers.admin,
    [
      "function owner() view returns (address)",
      "function UPGRADE_INTERFACE_VERSION() view returns (string)",
      "function upgradeAndCall(address proxy, address implementation, bytes data) external payable",
    ],
    wallet
  );

  const proxyAdminOwner = await proxyAdmin.owner();
  console.log("ProxyAdmin owner:", proxyAdminOwner);
  if (proxyAdminOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error("Deployer is not ProxyAdmin owner");
  }

  const upgraded = rendererOnly
    ? new ethers.Contract(proxyAddress, ["function setOnchainRenderer(address renderer) external"], wallet)
    : new ethers.Contract(proxyAddress, implementationOutput.abi, wallet);

  if (!rendererOnly && !implementationUnchanged) {
    const upgradeInterfaceVersion = await proxyAdmin.UPGRADE_INTERFACE_VERSION().catch(() => "legacy");
    console.log("ProxyAdmin upgrade interface:", upgradeInterfaceVersion);

    const upgradeTx = await proxyAdmin.upgradeAndCall(proxyAddress, await implementation.getAddress(), "0x");
    console.log("Upgrade tx:", upgradeTx.hash);
    await upgradeTx.wait();
  } else {
    console.log("Skipping proxy upgrade because implementation runtime matches current deployment");
  }

  const setRendererTx = await upgraded.setOnchainRenderer(await renderer.getAddress());
  console.log("Set renderer tx:", setRendererTx.hash);
  await setRendererTx.wait();

  console.log("On-chain stack deployed and configured");
  console.log("Proxy:", proxyAddress);
  console.log("Implementation:", implementation ? await implementation.getAddress() : pointers.implementation);
  console.log("Renderer:", await renderer.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
