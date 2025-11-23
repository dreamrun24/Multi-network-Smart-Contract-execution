/*
  Beginner Guide: ERC721TokenCreator
  - Purpose: Deploy a minimal NFT (ERC‑721‑like) contract, mint a token,
    and read owner, balance, and tokenURI in one page.
  - Quick Steps:
    1) Connect wallet and select a test network.
    2) Fill name, symbol, and admin (your address), then Deploy.
    3) Enter recipient, tokenId, and tokenURI, then Mint.
    4) Use the reads to check owner, balance, and open the tokenURI.
  - Key Functions:
    compileERC721 → compiles Solidity to ABI/bytecode (with fallback precompiled).
    deployContract → deploys contract and stores its address.
    mintNFT → sends mint tx, waits for confirmation, then auto-refreshes reads.
    queryOwnerOf / queryBalanceOf / queryTokenURI → on-chain reads.
  - UX Notes:
    • “View URI” opens the HTTP gateway link in a new tab.
    • Only the contract owner can mint; we pre-check the signer.
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import { BrowserProvider, Contract, ethers } from 'ethers';
import precompiledERC721 from './precompiled/ERC721Minimal.json';

const CONFIRM_TIMEOUT_MS = 35000;
// Dev private key for local Hardhat node (first default account)
const DEV_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Networks (reused from ERC20 creator)
type NetworkKey = 'hoodi' | 'sepolia' | 'holesky' | 'amoy' | 'bscTestnet' | 'fuji' | 'chiado';

const NETWORKS: Record<NetworkKey, {
  chainIdHex: string;
  chainName: string;
  currency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  hoodi: { chainIdHex: '0x7e3c', chainName: 'Ethereum Hoodi (Testnet)', currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.hoodi.xyz'], blockExplorerUrls: ['https://explorer.hoodi.xyz'] },
  sepolia: { chainIdHex: '0xaa36a7', chainName: 'Ethereum Sepolia', currency: { name: 'Sepolia Ether', symbol: 'SEP', decimals: 18 }, rpcUrls: ['https://rpc.sepolia.org'], blockExplorerUrls: ['https://sepolia.etherscan.io'] },
  holesky: { chainIdHex: '0x4268', chainName: 'Ethereum Holesky (Testnet)', currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://ethereum-holesky.publicnode.com', 'https://rpc.holesky.ethpandaops.io'], blockExplorerUrls: ['https://eth-holesky.blockscout.com', 'https://17000.testnet.routescan.io', 'https://holesky.etherscan.io'] },
  amoy: { chainIdHex: '0x13882', chainName: 'Polygon Amoy Testnet', currency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://rpc-amoy.polygon.technology'], blockExplorerUrls: ['https://amoy.polygonscan.com'] },
  bscTestnet: { chainIdHex: '0x61', chainName: 'BNB Smart Chain Testnet', currency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'], blockExplorerUrls: ['https://testnet.bscscan.com'] },
  fuji: { chainIdHex: '0xa869', chainName: 'Avalanche Fuji Testnet', currency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 }, rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'], blockExplorerUrls: ['https://testnet.snowtrace.io'] },
  chiado: { chainIdHex: '0x27d8', chainName: 'Gnosis Chiado', currency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 }, rpcUrls: ['https://rpc.chiadochain.net'], blockExplorerUrls: ['https://gnosis-chiado.blockscout.com'] },
};

function shortAddr(addr?: string) {
  if (!addr) return '';
  return addr.slice(0, 8) + '…' + addr.slice(-4);
}

function explorerFor(key: NetworkKey) {
  return NETWORKS[key].blockExplorerUrls[0] || '';
}

function getInjectedProvider(): any {
  const eth = (window as any).ethereum;
  if (!eth) return null;
  if ((eth as any).providers?.length) {
    const mm = (eth as any).providers.find((p: any) => p.isMetaMask);
    return mm || (eth as any).providers[0];
  }
  return eth;
}

interface ERC721TokenCreatorProps {
  dark: boolean;
}

export default function ERC721TokenCreator({ dark }: ERC721TokenCreatorProps) {
  const [mode, setMode] = useState<'real' | 'local'>('real');
  const [networkKey, setNetworkKey] = useState<NetworkKey>('holesky');
  const [account, setAccount] = useState<string>('');
  const [connected, setConnected] = useState(false);
  // Local signer for Hardhat/Anvil when in local mode
  const [localSigner, setLocalSigner] = useState<any>(null);
  // Add local RPC URL with fallback support
  const [localProviderUrl, setLocalProviderUrl] = useState<string>('http://127.0.0.1:8545');

  // Beginner enhancements
  const [beginnerMode, setBeginnerMode] = useState<boolean>(true);
  const [learnOpen, setLearnOpen] = useState<boolean>(true);
  const [celebrateMsg, setCelebrateMsg] = useState<string>('');

  // NFT configuration
  const [tokenName, setTokenName] = useState<string>('My NFT');
  const [tokenSymbol, setTokenSymbol] = useState<string>('MNFT');
  const [adminAddress, setAdminAddress] = useState<string>('');

  // Contract state
  const [contractAddr, setContractAddr] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<string>('');

  // Mint interaction
  const [mintToAddress, setMintToAddress] = useState<string>('');
  const [tokenId, setTokenId] = useState<string>('1');
  const [tokenURI, setTokenURI] = useState<string>('');
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState<string>('');

  // Read interaction
  const [ownerOfQuery, setOwnerOfQuery] = useState<string>('');
  const [ownerOfResult, setOwnerOfResult] = useState<string>('');
  const [balanceOfQuery, setBalanceOfQuery] = useState<string>('');
  const [balanceOfResult, setBalanceOfResult] = useState<string>('');
  const [tokenUriQuery, setTokenUriQuery] = useState<string>('');
  const [tokenUriResult, setTokenUriResult] = useState<string>('');
  const [tokenUriHttpResult, setTokenUriHttpResult] = useState<string>('');
  const [metadataPreview, setMetadataPreview] = useState<{ name?: string; imageHttp?: string; status?: string }>({});

  const mintRef = useRef<HTMLDivElement | null>(null);

  const provider = useMemo(() => {
    if (typeof window !== 'undefined') {
      if (mode === 'real') {
        const eth = getInjectedProvider();
        if (eth) return new BrowserProvider(eth);
      } else {
        return new ethers.JsonRpcProvider(localProviderUrl);
      }
    }
    return null;
  }, [mode, localProviderUrl]);

  // Auto-dismiss celebration banners
  useEffect(() => {
    if (!celebrateMsg) return;
    const t = setTimeout(() => setCelebrateMsg(''), 3000);
    return () => clearTimeout(t);
  }, [celebrateMsg]);

  // Auto-detect wallet connection
  useEffect(() => {
    if (!provider || mode !== 'real') return;
    const checkConnection = async () => {
      try {
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
          setConnected(true);
          if (!adminAddress) setAdminAddress(accounts[0].address);
        }
      } catch {}
    };
    checkConnection();
  }, [provider, mode, adminAddress]);

  const connectWallet = async () => {
    if (!provider) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }
    try {
      if (mode === 'local') {
        // Ensure local node is reachable with fallback
        const ok = await ensureLocalRpcReachable();
        if (!ok) {
          alert('Local node not reachable. Start Hardhat: npx hardhat node');
          return;
        }
        const wallet = new ethers.Wallet(DEV_PRIVATE_KEY, new ethers.JsonRpcProvider(localProviderUrl) as any);
        setLocalSigner(wallet);
        setAccount(wallet.address);
        setConnected(true);
        if (!adminAddress) setAdminAddress(wallet.address);
        return;
      }
      const eth = getInjectedProvider();
      if (!eth) {
        alert('Wallet not detected');
        return;
      }
      await eth.request({ method: 'eth_requestAccounts' });
      const signer = await (provider as any).getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      setConnected(true);
      if (!adminAddress) setAdminAddress(address);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      const msg = error?.code === 4001 ? 'You rejected the connect request in MetaMask.' : String(error?.message || error);
      alert('Connect error: ' + msg);
    }
  };

  const switchNetwork = async () => {
    if (!provider || mode !== 'real') return;
    const network = NETWORKS[networkKey];
    try {
      const eth = getInjectedProvider();
      if (!eth) throw new Error('Wallet provider missing');
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.chainIdHex }] });
    } catch (error: any) {
      if (error?.code === 4902) {
        try {
          const eth = getInjectedProvider();
          if (!eth) throw new Error('Wallet provider missing');
          await eth.request({ method: 'wallet_addEthereumChain', params: [{
            chainId: network.chainIdHex,
            chainName: network.chainName,
            nativeCurrency: network.currency,
            rpcUrls: network.rpcUrls,
            blockExplorerUrls: network.blockExplorerUrls,
          }] });
        } catch (addErr) {
          console.error('Failed to add chain:', addErr);
        }
      } else {
        console.error('Switch network failed:', error);
      }
    }
  };

  const deployContract = async () => {
    // Prevent duplicate clicks while a deploy is in flight
    if (isDeploying) return;
    if (!provider || !connected) {
      alert('Please connect wallet');
      return;
    }
    if (!isValidName(tokenName) || !isValidSymbol(tokenSymbol) || !isValidAddress(adminAddress)) {
      alert('Please fix input validations for name, symbol, and admin address');
      return;
    }

    setIsDeploying(true);
    setDeployStatus('Preparing deployment...');
    try {
      // Choose signer based on mode
      const signer = mode === 'real'
        ? await (provider as any).getSigner()
        : (localSigner || new ethers.Wallet(DEV_PRIVATE_KEY, provider as any));

      // Chain mismatch detection for real networks only
      if (mode === 'real') {
        try {
          const current = await (provider as any).send('eth_chainId', []);
          const selected = NETWORKS[networkKey].chainIdHex.toLowerCase();
          if (typeof current === 'string' && current.toLowerCase() !== selected) {
            setDeployStatus('Wrong network. Switching...');
            await switchNetwork();
            const after = await (provider as any).send('eth_chainId', []);
            if (typeof after === 'string' && after.toLowerCase() !== selected) {
              setDeployStatus('Please switch your wallet to the selected network.');
              setIsDeploying(false);
              return;
            }
          }
        } catch {}
      } else {
        // Ensure local node is reachable
        try { await (provider as any).getBlockNumber(); } catch {
          setDeployStatus('Local node not reachable. Start Hardhat with: npx hardhat node');
          setIsDeploying(false);
          return;
        }
      }

      // Balance check
      try {
        const bal = await (provider as any).getBalance(await signer.getAddress());
        if (bal === 0n && mode === 'real') {
          setDeployStatus('Insufficient funds on selected network.');
          setIsDeploying(false);
          return;
        }
      } catch {}

      setDeployStatus('Compiling NFT contract...');
      const { abi, bytecode } = await compileERC721();
      if (!bytecode || bytecode === '0x') {
        setDeployStatus('Compiler failed to load. Please retry.');
        setIsDeploying(false);
        return;
      }

      const factory = new ethers.ContractFactory(abi, bytecode, signer);

      // First attempt: let wallet estimate gas
      try {
        setDeployStatus('Confirming transaction...');
        const contract = await factory.deploy(adminAddress, tokenName, tokenSymbol);
        const tx = contract.deploymentTransaction();
        setDeployStatus('Waiting for first confirmation...');
        let receipt;
        try {
          receipt = await (provider as any).waitForTransaction(tx!.hash, 1, CONFIRM_TIMEOUT_MS);
        } catch (e: any) {
          if (String(e?.code).toUpperCase() === 'TIMEOUT') {
            setDeployStatus('⏱️ Confirmation delayed. Proceeding optimistically...');
          } else {
            throw e;
          }
        }
        const addr = receipt?.contractAddress || (contract as any).target || await contract.getAddress();
        setContractAddr(addr);
        setDeployStatus(`Deployed at ${shortAddr(addr)}`);
        setCelebrateMsg(`NFT deployed to ${shortAddr(addr)}`);
        setTimeout(() => {
          mintRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      } catch (primaryErr: any) {
        // Fallback: explicit gas limit
        const msg = String(primaryErr?.message || primaryErr);
        // Handle MetaMask circuit-breaker / RPC rate-limit
        try {
          // Access nested cause if provided by MetaMask
          const broken = (primaryErr?.data?.cause?.isBrokenCircuitError) || /circuit breaker/i.test(String(primaryErr?.message || primaryErr || ''));
          if (broken) {
            setDeployStatus('❌ Wallet RPC temporarily blocked (MetaMask circuit breaker). Switch networks or wait 30–60s, then retry.');
            return;
          }
        } catch {}
        if (msg.toLowerCase().includes('estimate gas') || msg.toLowerCase().includes('gas required exceeds allowance')) {
          try {
            const fallbackGas = 3_000_000n; // conservative fallback
            setDeployStatus('Retrying with fallback gas...');
            const contract = await factory.deploy(adminAddress, tokenName, tokenSymbol, { gasLimit: fallbackGas });
            const tx = contract.deploymentTransaction();
            setDeployStatus('Waiting for first confirmation...');
            let receipt;
            try {
              receipt = await (provider as any).waitForTransaction(tx!.hash, 1, CONFIRM_TIMEOUT_MS);
            } catch (e: any) {
              if (String(e?.code).toUpperCase() === 'TIMEOUT') {
                setDeployStatus('⏱️ Confirmation delayed. Proceeding optimistically...');
              } else {
                throw e;
              }
            }
            const addr = receipt?.contractAddress || (contract as any).target || await contract.getAddress();
            setContractAddr(addr);
            setDeployStatus(`Deployed at ${shortAddr(addr)}`);
            setCelebrateMsg(`NFT deployed to ${shortAddr(addr)}`);
            setTimeout(() => {
              mintRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
          } catch (fallbackErr: any) {
            try {
              const broken = (fallbackErr?.data?.cause?.isBrokenCircuitError) || /circuit breaker/i.test(String(fallbackErr?.message || fallbackErr || ''));
              if (broken) {
                setDeployStatus('❌ Wallet RPC temporarily blocked (MetaMask circuit breaker). Switch networks or wait 30–60s, then retry.');
              } else {
                console.error('Deploy failed (fallback):', fallbackErr);
                setDeployStatus(`Deploy failed: ${String(fallbackErr?.message || fallbackErr)}`);
              }
            } catch {
              console.error('Deploy failed (fallback):', fallbackErr);
              setDeployStatus(`Deploy failed: ${String(fallbackErr?.message || fallbackErr)}`);
            }
          }
        } else {
          console.error('Deploy failed:', primaryErr);
          setDeployStatus(`Deploy failed: ${msg}`);
        }
      }
    } catch (err: any) {
      console.error('Deploy failed:', err);
      setDeployStatus(`Deploy failed: ${String(err?.message || err)}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const mintNFT = async () => {
    if (!provider || !contractAddr) {
      alert('Please deploy the contract first');
      return;
    }
    if (!isValidAddress(mintToAddress) || !isValidTokenId(tokenId) || !isValidTokenURI(tokenURI)) {
      alert('Please fix mint inputs (address, tokenId, tokenURI)');
      return;
    }

    setIsMinting(true);
    setMintStatus('Preparing mint...');
    try {
      const signer = mode === 'real'
        ? await (provider as any).getSigner()
        : (localSigner || new ethers.Wallet(DEV_PRIVATE_KEY, provider as any));
      const contract = new Contract(contractAddr, ERC721_MIN_ABI, signer);

      // Ensure signer is contract owner (mint is owner-only)
      try {
        const ownerAddr = await contract.owner();
        const signerAddr = await signer.getAddress();
        if (ownerAddr.toLowerCase() !== signerAddr.toLowerCase()) {
          setMintStatus('❌ Mint denied: signer is not contract owner');
          setIsMinting(false);
          return;
        }
      } catch {}

      setMintStatus('Sending mint transaction...');
      const tx = await contract.mint(mintToAddress, BigInt(tokenId), tokenURI);
      setMintStatus('Waiting for first confirmation...');
      let rec;
      try {
        rec = await (provider as any).waitForTransaction(tx.hash, 1, CONFIRM_TIMEOUT_MS);
      } catch (e: any) {
        if (String(e?.code).toUpperCase() === 'TIMEOUT') {
          setMintStatus('⏱️ Pending confirmation. Verify on explorer; will update when mined.');
          setIsMinting(false);
          return; // do not claim success
        } else {
          throw e;
        }
      }

      if (rec && (rec as any).status === 0) {
        setMintStatus('❌ Mint reverted. See explorer for details.');
        setIsMinting(false);
        return;
      }

      setMintStatus(`Minted token #${tokenId} to ${shortAddr(mintToAddress)}`);
      setCelebrateMsg(`🎉 Minted NFT #${tokenId}!`);

      // Auto-populate queries with minted values and update results
      setOwnerOfQuery(tokenId);
      setBalanceOfQuery(mintToAddress);
      setTokenUriQuery(tokenId);
      try {
        const read = new Contract(contractAddr, ERC721_MIN_ABI, provider);
        const owner = await read.ownerOf(BigInt(tokenId));
        setOwnerOfResult(owner);
        const bal = await read.balanceOf(mintToAddress);
        setBalanceOfResult(String(bal));
        const uri = await read.tokenURI(BigInt(tokenId));
        setTokenUriResult(uri);
        const httpUri = toHttpUri(uri);
        setTokenUriHttpResult(httpUri);

        // Immediately open in a new tab to give clear feedback
        try {
          const toOpen = httpUri || uri;
          if (toOpen && /^https?:\/\//i.test(toOpen)) {
            window.open(toOpen, '_blank', 'noopener');
          }
        } catch {}

        // Attempt to fetch metadata for preview
        setMetadataPreview({ status: 'Loading...' });
        try {
          const res = await fetch(httpUri);
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            const name = (data && (data.name || data.title)) || '';
            const imageSrc = (data && (data.image || data.image_url || '')) || '';
            const imageHttp = toHttpUri(String(imageSrc));
            setMetadataPreview({ name, imageHttp, status: 'OK' });
          } else {
            setMetadataPreview({ status: 'Not JSON' });
          }
        } catch {
          setMetadataPreview({ status: 'Fetch error' });
        }
      } catch {}
    } catch (err: any) {
      console.error('Mint failed:', err);
      const reason = extractRpcReason(err);
      try {
        const broken = (err?.data?.cause?.isBrokenCircuitError) || /circuit breaker/i.test(String(err?.message || err || ''));
        if (broken) {
          setMintStatus('❌ Wallet RPC temporarily blocked (MetaMask circuit breaker). Switch networks or wait 30–60s, then retry.');
        } else {
          setMintStatus(`Mint failed: ${reason}`);
        }
      } catch {
        setMintStatus(`Mint failed: ${reason}`);
      }
    } finally {
      setIsMinting(false);
    }
  };

  // Auto-switch when network selection changes and wallet is connected (real mode)
  useEffect(() => {
    if (mode === 'real' && connected) {
      switchNetwork().catch(() => {});
    }
  }, [networkKey, mode, connected]);

  // Ensure local RPC is reachable; try localhost fallback if 127.0.0.1 fails
  async function ensureLocalRpcReachable(): Promise<boolean> {
    if (!provider) return false;
    try {
      await (provider as any).getBlockNumber();
      return true;
    } catch {
      try {
        const alt = 'http://localhost:8545';
        if (localProviderUrl !== alt) setLocalProviderUrl(alt);
        const altProvider = new ethers.JsonRpcProvider(alt);
        await (altProvider as any).getBlockNumber();
        return true;
      } catch {
        return false;
      }
    }
  }

  // Extract readable revert reason from RPC errors
  function extractRpcReason(e: any): string {
    try {
      if (e?.reason) return String(e.reason);
      if (e?.shortMessage) return String(e.shortMessage).replace(/^Error:\s*/i, '');
      const msg = String(e?.message || e);
      const m = msg.match(/execution reverted:?\s*(.*)$/i) || msg.match(/reverted:?\s*(.*)$/i);
      return m ? m[1] : msg;
    } catch {
      return 'Error';
    }
  }

  const queryOwnerOf = async () => {
    if (!provider || !contractAddr || !isValidTokenId(ownerOfQuery)) { setOwnerOfResult(''); return; }
    try {
      const contract = new Contract(contractAddr, ERC721_MIN_ABI, provider);
      const owner = await contract.ownerOf(BigInt(ownerOfQuery));
      setOwnerOfResult(owner);
    } catch (err: any) {
      const reason = extractRpcReason(err);
      setOwnerOfResult(reason || 'Not found');
    }
  };

  const queryBalanceOf = async () => {
    if (!provider || !contractAddr || !isValidAddress(balanceOfQuery)) { setBalanceOfResult(''); return; }
    try {
      const contract = new Contract(contractAddr, ERC721_MIN_ABI, provider);
      const bal = await contract.balanceOf(balanceOfQuery);
      setBalanceOfResult(String(bal));
    } catch (err) {
      setBalanceOfResult('Error');
    }
  };

  const queryTokenURI = async () => {
    if (!provider || !contractAddr || !isValidTokenId(tokenUriQuery)) { setTokenUriResult(''); setTokenUriHttpResult(''); setMetadataPreview({}); return; }
    try {
      const contract = new Contract(contractAddr, ERC721_MIN_ABI, provider);
      const uri = await contract.tokenURI(BigInt(tokenUriQuery));
      setTokenUriResult(uri);
      const httpUri = toHttpUri(uri);
      setTokenUriHttpResult(httpUri);

      // Attempt to fetch metadata for preview
      setMetadataPreview({ status: 'Loading...' });
      try {
        const res = await fetch(httpUri);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          const name = (data && (data.name || data.title)) || '';
          const imageSrc = (data && (data.image || data.image_url || '')) || '';
          const imageHttp = toHttpUri(String(imageSrc));
          setMetadataPreview({ name, imageHttp, status: 'OK' });
        } else {
          setMetadataPreview({ status: 'Not JSON' });
        }
      } catch (e) {
        setMetadataPreview({ status: 'Fetch error' });
      }
    } catch (err) {
      setTokenUriResult('Error');
      setTokenUriHttpResult('');
      setMetadataPreview({ status: 'Error' });
    }
  };

  const prefillExamples = () => {
    setTokenName('My Awesome NFT');
    setTokenSymbol('MAFT');
    if (account) setAdminAddress(account);
    setTokenURI('ipfs://bafy.../metadata.json');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {celebrateMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200 px-3 py-1 shadow">
          {celebrateMsg}
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-brand-gradient mb-2">ERC721 NFT Creator</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">Deploy a simple NFT contract, mint tokens, and view ownership</p>
          </div>

          {beginnerMode && (
            <div className="card-base card-shadow p-4 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Learn: What’s an ERC‑721 NFT?</h2>
                <button className="text-sm underline" onClick={() => setLearnOpen(v => !v)}>{learnOpen ? 'Hide' : 'Show'}</button>
              </div>
              {learnOpen && (
                <div className="mt-3 text-sm space-y-2 text-gray-700 dark:text-gray-300">
                  <p>ERC‑721 is the standard for unique tokens (NFTs). Each token has a distinct ID and optional metadata via a token URI.</p>
                  <p>Minting creates new tokens to a wallet. Our minimal contract supports reading ownership and metadata but does not include transfers to keep things beginner‑friendly.</p>
                </div>
              )}
            </div>
          )}

          {/* Wallet connection */}
          <div className="card-base card-shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Wallet Connection</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={beginnerMode} onChange={(e) => setBeginnerMode(e.target.checked)} />
                  Beginner Mode
                </label>
                <div className="flex gap-2">
                  <select className="input-base input-focus-brand text-sm" value={mode} onChange={(e) => setMode(e.target.value as 'real' | 'local')}>
                    <option value="real">MetaMask</option>
                    <option value="local">Local Node</option>
                  </select>
                  {mode === 'real' && (
                    <select className="input-base input-focus-brand text-sm" value={networkKey} onChange={(e) => setNetworkKey(e.target.value as NetworkKey)}>
                      {Object.entries(NETWORKS).map(([key, network]) => (
                        <option key={key} value={key}>{network.chainName}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {connected ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-sm">Connected: {shortAddr(account)}</span>
                </div>
              ) : (
                <button className="btn-base brand-gradient text-white btn-focus-brand" onClick={connectWallet}>Connect Wallet</button>
              )}
              {mode === 'real' && connected && (
                <button className="btn-secondary btn-focus-brand text-sm" onClick={switchNetwork}>Switch to {NETWORKS[networkKey].chainName}</button>
              )}
            </div>
            {beginnerMode && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">Tip: Keep MetaMask and the app on the same network during deploy and mint.</p>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Contract Template */}
            <div className="card-base card-shadow p-6">
              <h2 className="text-xl font-semibold mb-4">ERC721 Contract Template</h2>
              <div className="mb-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3 text-sm mb-3">
                  <p className="font-medium text-blue-800 dark:text-blue-200">📚 What is this?</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">This is a minimal ERC‑721‑like contract with owner‑only mint, ownership tracking, and tokenURI. It omits transfers for simplicity.</p>
                </div>
              </div>
              <textarea className="input-base input-focus-brand w-full h-80 font-mono text-xs p-3" value={ERC721_MINIMAL_SRC} readOnly />
            </div>

            {/* NFT Setup */}
            <div className="space-y-6">
              <div className="card-base card-shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-semibold">NFT Setup</h2>
                  <button className="btn-secondary btn-focus-brand text-sm" onClick={prefillExamples}>Use Examples</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Collection Name<span className="text-gray-500 ml-1">(3–40 chars)</span></label>
                    <input className="input-base input-focus-brand w-full" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
                    {!isValidName(tokenName) && (<p className="text-xs text-red-600 mt-1">Enter 3–40 characters.</p>)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Symbol<span className="text-gray-500 ml-1">(uppercase, 2–10 letters)</span></label>
                    <input className="input-base input-focus-brand w-full" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())} />
                    {!isValidSymbol(tokenSymbol) && (<p className="text-xs text-red-600 mt-1">Use 2–10 uppercase letters.</p>)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Admin/Owner Address</label>
                    <input className="input-base input-focus-brand w-full" value={adminAddress} onChange={(e) => setAdminAddress(e.target.value)} />
                    {!isValidAddress(adminAddress) && (<p className="text-xs text-red-600 mt-1">Enter a valid address.</p>)}
                  </div>
                  <button className="btn-base brand-gradient text-white btn-focus-brand w-full" onClick={deployContract} disabled={isDeploying || !isValidName(tokenName) || !isValidSymbol(tokenSymbol) || !isValidAddress(adminAddress)}>
                    {isDeploying ? 'Deploying…' : (mode === 'real' ? `Deploy to ${NETWORKS[networkKey].chainName}` : 'Deploy to Local Node')}
                  </button>
                  {deployStatus && (
                    <div className={`text-sm rounded-md p-2 ${deployStatus.toLowerCase().includes('failed') ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'}`}>
                      {deployStatus}
                      {contractAddr && (
                        <div className="mt-2">
                          <a href={`${explorerFor(networkKey)}/address/${contractAddr}`} target="_blank" rel="noopener noreferrer" className="underline">View on Explorer</a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Mint & Read */}
              {contractAddr && (
                <div ref={mintRef} className="card-base card-shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">Mint & Read</h2>
                  <div className="space-y-4">
                    {/* Mint NFT */}
                    <div className="border-b pb-4">
                      <h3 className="font-medium mb-3">Mint NFT</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Recipient Address</label>
                          <input className="input-base input-focus-brand w-full" value={mintToAddress} onChange={(e) => setMintToAddress(e.target.value)} />
                          {!isValidAddress(mintToAddress) && (<p className="text-xs text-red-600 mt-1">Enter a valid address.</p>)}
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Token ID</label>
                          <input className="input-base input-focus-brand w-full" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
                          {!isValidTokenId(tokenId) && (<p className="text-xs text-red-600 mt-1">Use a positive integer (e.g., 1).</p>)}
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Token URI<span className="text-gray-500 ml-1">(ipfs:// or https://)</span></label>
                          <input className="input-base input-focus-brand w-full" value={tokenURI} onChange={(e) => setTokenURI(e.target.value)} />
                          {!isValidTokenURI(tokenURI) && (<p className="text-xs text-red-600 mt-1">Start with ipfs:// or https://</p>)}
                        </div>
                        <button className="btn-base success-gradient text-white btn-focus-success w-full" onClick={mintNFT} disabled={isMinting || !isValidAddress(mintToAddress) || !isValidTokenId(tokenId) || !isValidTokenURI(tokenURI)}>
                          {isMinting ? 'Minting…' : 'Mint NFT'}
                        </button>
                        {mintStatus && (
                          <div className={`text-sm rounded-md p-2 ${mintStatus.toLowerCase().includes('failed') ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'}`}>{mintStatus}</div>
                        )}
                      </div>
                    </div>

                    {/* Reads */}
                    <div className="grid md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <h3 className="font-medium mb-2">Owner Of</h3>
                        <input className="input-base input-focus-brand w-full mb-2" placeholder="Token ID" value={ownerOfQuery} onChange={(e) => setOwnerOfQuery(e.target.value)} />
                        <button className="btn-secondary btn-focus-brand w-full" onClick={queryOwnerOf} disabled={!isValidTokenId(ownerOfQuery)}>Check Owner</button>
                        {ownerOfResult && (<div className="text-sm bg-gray-100 dark:bg-gray-700 rounded p-2 mt-2 break-all">Owner: {isValidAddress(ownerOfResult) ? shortAddr(ownerOfResult) : ownerOfResult}</div>)}
                      </div>
                      <div>
                        <h3 className="font-medium mb-2">Balance Of</h3>
                        <input className="input-base input-focus-brand w-full mb-2" placeholder="Wallet Address" value={balanceOfQuery} onChange={(e) => setBalanceOfQuery(e.target.value)} />
                        <button className="btn-secondary btn-focus-brand w-full" onClick={queryBalanceOf} disabled={!isValidAddress(balanceOfQuery)}>Check Balance</button>
                        {balanceOfResult && (<div className="text-sm bg-gray-100 dark:bg-gray-700 rounded p-2 mt-2">Balance: {balanceOfResult}</div>)}
                      </div>
                      <div>
                        <h3 className="font-medium mb-2">Token URI</h3>
                        <input className="input-base input-focus-brand w-full mb-2" placeholder="Token ID" value={tokenUriQuery} onChange={(e) => setTokenUriQuery(e.target.value)} />
                        <button className="btn-secondary btn-focus-brand w-full" onClick={queryTokenURI} disabled={!isValidTokenId(tokenUriQuery)}>View URI</button>
                        {tokenUriResult && (
                          <div className="text-sm bg-gray-100 dark:bg-gray-700 rounded p-2 mt-2 break-all">
                            <div>
                              <a href={(tokenUriHttpResult || tokenUriResult)} target="_blank" rel="noopener noreferrer" className="underline">
                                {tokenUriResult}
                              </a>
                              {tokenUriHttpResult && tokenUriHttpResult !== tokenUriResult && (
                                <span className="text-xs ml-2">(opens via gateway)</span>
                              )}
                            </div>
                            {metadataPreview?.status && (
                              <div className="text-xs mt-1">Metadata: {metadataPreview.status}{metadataPreview.name ? ` • ${metadataPreview.name}` : ''}</div>
                            )}
                            {metadataPreview?.imageHttp && (
                              <img src={metadataPreview.imageHttp} alt={metadataPreview.name || 'NFT image'} className="mt-2 max-h-40 rounded border" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimal ERC-721 ABI for interaction
const ERC721_MIN_ABI = [
  "constructor(address admin, string name, string symbol)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function owner() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function mint(address to, uint256 tokenId, string uri)",
  "function supportsInterface(bytes4) view returns (bool)"
];

function isValidName(name: string): boolean {
  const n = (name || '').trim();
  return n.length >= 3 && n.length <= 40;
}

function isValidSymbol(sym: string): boolean {
  const s = (sym || '').trim();
  return /^[A-Z]{2,10}$/.test(s);
}

function isValidAddress(addr: string): boolean {
  try { return ethers.isAddress((addr || '').trim()); } catch { return false; }
}

function isValidTokenId(id: string): boolean {
  const s = (id || '').trim();
  if (!/^\d+$/.test(s)) return false;
  try { return BigInt(s) > 0n; } catch { return false; }
}

function isValidTokenURI(uri: string): boolean {
  const u = (uri || '').trim();
  return /^https?:\/\//i.test(u) || /^ipfs:\/\//i.test(u);
}

function toHttpUri(uri: string): string {
  const u = (uri || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const m = u.match(/^ipfs:\/\/(.+)$/i);
  if (m) {
    const path = m[1].replace(/^ipfs\//, '');
    return `https://ipfs.io/ipfs/${path}`;
  }
  return '';
}

// Provide compiled artifact for deployment
async function compileERC721(): Promise<{ abi: any; bytecode: string }> {
  try {
    const artifact = precompiledERC721 as any;
    const abi = artifact?.abi ?? ERC721_MIN_ABI;
    const bytecode = artifact?.bytecode ?? '0x';
    if (typeof bytecode === 'string' && bytecode.startsWith('0x') && Array.isArray(abi)) {
      return { abi, bytecode };
    }
  } catch {}
  // Fallback – return minimal ABI and an empty bytecode to surface an error upstream
  return { abi: ERC721_MIN_ABI, bytecode: '0x' };
}

// Minimal ERC-721 contract source for display in the UI
const ERC721_MINIMAL_SRC = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract SimpleNFT {\n    string public name;\n    string public symbol;\n    address public owner;\n\n    mapping(uint256 => address) private _owners;\n    mapping(address => uint256) private _balances;\n    mapping(uint256 => string) private _tokenURIs;\n\n    constructor(address admin, string memory _name, string memory _symbol) {\n        owner = admin;\n        name = _name;\n        symbol = _symbol;\n    }\n\n    modifier onlyOwner() {\n        require(msg.sender == owner, "not owner");\n        _;\n    }\n\n    function balanceOf(address account) public view returns (uint256) {\n        return _balances[account];\n    }\n\n    function ownerOf(uint256 tokenId) public view returns (address) {\n        address o = _owners[tokenId];\n        require(o != address(0), "not minted");\n        return o;\n    }\n\n    function tokenURI(uint256 tokenId) public view returns (string memory) {\n        require(_owners[tokenId] != address(0), "not minted");\n        return _tokenURIs[tokenId];\n    }\n\n    function mint(address to, uint256 tokenId, string memory uri) external onlyOwner {\n        require(to != address(0), "zero address");\n        require(_owners[tokenId] == address(0), "already minted");\n        _owners[tokenId] = to;\n        _balances[to] += 1;\n        _tokenURIs[tokenId] = uri;\n    }\n\n    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {\n        // 0x80ac58cd is the ERC-721 interface id\n        return interfaceId == 0x80ac58cd;\n    }\n}`;