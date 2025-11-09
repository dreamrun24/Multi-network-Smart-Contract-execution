
# Multi Network Smart Contract Studio

A beginner‑friendly, end‑to‑end playground to learn blockchain development. Write contracts, deploy locally or to testnets, and interact with ERC‑20 and ERC‑721 templates from a clean UI.

## Features
- Smart Contract Playground: edit, deploy, and test a simple getter–setter contract.
- ERC20 Token Creator: configure name/symbol/admin, deploy, and mint tokens.
- ERC721 NFT Creator: deploy a minimal owner‑only mint contract and view tokenURI.
- Beginner Mode tips and guardrails for safer first deployments.
- Works with MetaMask and multiple networks (local Hardhat, Ethereum testnets).

## Requirements
- Node.js 
- npm
- MetaMask (browser extension)
- Hardhat (installed via `npm i -D hardhat`)
- Testnet funds (e.g., Holesky faucet) if deploying to public networks

## Quick Start
1. Install dependencies: `npm install` and `cd react-playground && npm install`.
2. Start the frontend: `cd react-playground && npm run dev`.
3. Open the app (shown in the terminal) and connect MetaMask.
4. Choose a network (Local Hardhat or a testnet) and follow the tab instructions.

## Local Development (Recommended)
- Start Hardhat node: `npx hardhat node` (new terminal).
- Frontend dev server: `cd react-playground && npm run dev`.
- Optional contract deploys (scripts):
  - `npx ts-node scripts/deploy-local-ethers.ts`
  - `node scripts/deploy-local-ethers.mjs`

## Testnet Deployment
- Create `.env` with `RPC_URL` and `PRIVATE_KEY` (use a test wallet only).
- Run:
  - `node scripts/check-chainid.mjs` to verify RPC.
  - `node scripts/deploy-testnet-ethers.mjs` or
  - `npx hardhat run scripts/deploy-testnet.ts --network <network>`.
- Copy deployed addresses into the UI when applicable.

## Tabs and How To Use Them
- Smart Contract Playground
  - Edit the SimpleStorage contract on the right.
  - Select a network, connect wallet, and click Deploy.
  - Use the input at the bottom to call `setMessage`; read with `getMessage`.

- ERC20 Token Creator
  - Fill in Token Name and Symbol.
  - Set the Admin/Owner address (wallet that can mint).
  - Click Deploy Token Contract, then use the Mint section to create tokens.

- ERC721 NFT Creator
  - Set collection name and symbol.
  - Admin/Owner address controls minting.
  - Deploy, then mint a token with a `tokenURI` (ipfs:// or https://).
  - Use Owner/Balance/TokenURI read panels to verify after confirmation.

## Scripts (Backend Utilities)
Each script now includes a header explaining purpose and usage.
- `scripts/deploy-local-ethers.*`: deploy to local Hardhat using Ethers.
- `scripts/deploy-testnet-ethers.mjs`: deploy to public testnets using Ethers.
- `scripts/deploy-testnet.ts`: Hardhat‑native deploy to a selected testnet.
- `scripts/check-chainid.mjs`: print RPC chain ID.
- `scripts/print-address-and-balance.mjs`: show address balance.
- `scripts/send-op-tx.ts`: send a sample transaction (OP chain example).

## Repo Structure
- `contracts/` – Solidity contracts used by the app and scripts.
- `react-playground/` – Vite + React frontend (three tabs).
- `scripts/` – Deployment and utility scripts.
- `hardhat.config.ts` – Hardhat configuration.

## Notes
- Keep MetaMask and the app on the same network during deploy/mint.
- Beginner Mode adds UI tips and avoids advanced features.
- Use testnets only; never use real funds for experiments.

---
This project is part of the “Multi Network Smart Contract Studio”. Contributions and improvements are welcome.
