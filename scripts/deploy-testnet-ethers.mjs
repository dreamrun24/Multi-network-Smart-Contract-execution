/*
 Multi Network Smart Contract Studio – scripts/deploy-testnet-ethers.mjs
 Purpose: Deploy using Ethers.js to a chosen public testnet.
 Usage:
 - Set `RPC_URL` and `PRIVATE_KEY` env vars.
 - Run: `node scripts/deploy-testnet-ethers.mjs`
 Behavior:
 - Deploys contracts and logs addresses for frontend configuration.
*/
import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.error('Missing RPC_URL or PRIVATE_KEY in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifactPath = path.join(
    'artifacts',
    'contracts',
    'SimpleStorage.sol',
    'SimpleStorage.json'
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  console.log('Testnet contract deployed at', contract.target);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});