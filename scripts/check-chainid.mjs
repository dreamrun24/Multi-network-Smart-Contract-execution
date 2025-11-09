/*
 Multi Network Smart Contract Studio – scripts/check-chainid.mjs
 Purpose: Print the chain ID of the target RPC for quick verification.
 Usage:
 - Set RPC_URL in env or edit script, then run:
 - `node scripts/check-chainid.mjs`
*/
import 'dotenv/config';

const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) {
  console.error('Missing RPC_URL in .env');
  process.exit(1);
}

const payload = {
  jsonrpc: '2.0',
  id: 1,
  method: 'eth_chainId',
  params: [],
};

async function main() {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('RPC request failed:', res.status, res.statusText);
    process.exit(1);
  }
  const data = await res.json();
  const hex = data?.result;
  if (!hex) {
    console.error('Unexpected RPC response:', data);
    process.exit(1);
  }
  const dec = parseInt(hex, 16);
  console.log('RPC URL:', rpcUrl);
  console.log('eth_chainId (hex):', hex);
  console.log('eth_chainId (dec):', dec);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});