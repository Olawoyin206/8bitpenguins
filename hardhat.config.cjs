require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

if (process.platform === "win32" && process.env.HARDHAT_USE_NATIVE_SOLC !== "true") {
  const { CompilerDownloader, CompilerPlatform } = require("hardhat/internal/solidity/compiler/downloader");
  CompilerDownloader.getCompilerPlatform = () => CompilerPlatform.WASM;
}

const parsedOptimizerRuns = Number.parseInt(String(process.env.SOLC_OPTIMIZER_RUNS || "").trim(), 10);
const optimizerRuns = Number.isFinite(parsedOptimizerRuns) && parsedOptimizerRuns > 0 ? parsedOptimizerRuns : 1;
const useViaIR = String(process.env.SOLC_VIA_IR || "true").trim().toLowerCase() !== "false";
const solidityVersion = String(process.env.SOLC_VERSION || "0.8.20").trim();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: solidityVersion,
    settings: {
      optimizer: {
        enabled: true,
        runs: optimizerRuns
      },
      viaIR: useViaIR
    }
  },
  networks: {
    mainnet: {
      url:
        process.env.ETH_MAINNET_RPC_URL ||
        process.env.MAINNET_RPC_URL ||
        process.env.VITE_RPC_URL ||
        "https://ethereum-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
    },
    sepolia: {
      url:
        process.env.ETH_SEPOLIA_RPC_URL ||
        process.env.BASE_SEPOLIA_RPC_URL ||
        "https://rpc.sepolia.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "",
    },
  },
};
