# React Frontend – Multi Network Smart Contract Studio

This is the Vite + React app that powers the three tabs:
- Smart Contract Playground
- ERC20 Token Creator
- ERC721 NFT Creator

## Requirements
- Node.js 18+
- npm
- MetaMask installed in your browser

## Install & Run
```bash
cd react-playground
npm install
npm run dev
```
Open the local URL shown in the terminal (e.g., `http://127.0.0.1:5173/`).

## Using the Tabs
- Smart Contract Playground: choose a network, connect wallet, deploy the sample contract, and call `setMessage`/`getMessage`.
- ERC20 Token Creator: fill name/symbol/admin and deploy; use the UI to mint tokens.
- ERC721 NFT Creator: set collection name/symbol/admin; deploy and mint an NFT with a tokenURI.

## Notes
- Keep your MetaMask network in sync with the app’s selected network.
- Beginner Mode shows tips, uses owner‑only minting, and avoids advanced features.
- For testnets, ensure your wallet has faucet funds before deploying or minting.
