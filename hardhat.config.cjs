require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

if (process.platform === "win32" && process.env.HARDHAT_USE_NATIVE_SOLC !== "true") {
  const { CompilerDownloader, CompilerPlatform } = require("hardhat/internal/solidity/compiler/downloader");
  CompilerDownloader.getCompilerPlatform = () => CompilerPlatform.WASM;
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1
      },
      viaIR: true
    }
  },
  networks: {
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
    apiKey: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "",
  },
};
