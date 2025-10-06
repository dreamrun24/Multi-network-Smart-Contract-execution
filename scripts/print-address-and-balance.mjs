import { readFileSync } from 'fs';
import { ethers } from 'ethers';

async function main() {
  const env = readFileSync('.env', 'utf8');
  const pkMatch = env.match(/PRIVATE_KEY\s*=\s*([^\r\n]+)/);
  const rpcMatch = env.match(/RPC_URL\s*=\s*([^\r\n]+)/);
  if (!pkMatch || !rpcMatch) {
    console.error('Missing PRIVATE_KEY or RPC_URL in .env');
    process.exit(1);
  }
  const PRIVATE_KEY = pkMatch[1].trim();
  const RPC_URL = rpcMatch[1].trim();

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const balanceWei = await provider.getBalance(wallet.address);
  const balanceEth = ethers.formatEther(balanceWei);

  console.log(`Address: ${wallet.address}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Balance: ${balanceEth} ETH`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});