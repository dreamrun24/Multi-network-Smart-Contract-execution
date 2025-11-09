import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

/*
 Multi Network Smart Contract Studio – scripts/deploy-local-ethers.ts
 Purpose: Example deployment using Ethers.js to a local Hardhat node.
 Usage:
 - Start local node: `npx hardhat node`
 - Deploy: `npx ts-node scripts/deploy-local-ethers.ts`
 Behavior:
 - Deploys SimpleStorage and prints the address and a sample interaction.
*/
async function main() {
  const rpcUrl = "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Use Hardhat local Account #0
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifactPath = path.join(
    "artifacts",
    "contracts",
    "SimpleStorage.sol",
    "SimpleStorage.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  console.log("Contract deployed successfully at", contract.target);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});