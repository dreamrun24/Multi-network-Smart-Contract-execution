/*
 Multi Network Smart Contract Studio – scripts/deploy-testnet.ts
 Purpose: Deploy contracts to a supported public testnet using Hardhat.
 Usage:
 - Set your RPC URLs and private key in Hardhat config or env vars.
 - Run: `npx hardhat run scripts/deploy-testnet.ts --network <network>`
 What it does:
 - Compiles the contracts and deploys SimpleStorage (and others if configured).
 - Prints deployed addresses for use in the frontend.
*/
import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const simpleStorage = await viem.deployContract("SimpleStorage");
  console.log("Contract deployed successfully at", simpleStorage.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});