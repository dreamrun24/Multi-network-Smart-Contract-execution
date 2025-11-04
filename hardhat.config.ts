import * as dotenv from "dotenv";
dotenv.config();
import type { HardhatUserConfig } from "hardhat/config";
// Enable plugins for type augmentation and runtime helpers
// import "@nomicfoundation/hardhat-ethers";
// import "@nomicfoundation/hardhat-viem";
// Ignition plugin provides tasks; modules import will work once package is installed
import "@nomicfoundation/hardhat-ignition";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      type: "http",
      url: "https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    polygon_amoy: {
      type: "http",
      url: "https://rpc-amoy.polygon.technology",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    avalanche_fuji: {
      type: "http",
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    bsc_testnet: {
      type: "http",
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    gnosis_chiado: {
      type: "http",
      url: "https://rpc.chiadochain.net",
      accounts: [process.env.PRIVATE_KEY || ""]
    }
  },
};

export default config;
