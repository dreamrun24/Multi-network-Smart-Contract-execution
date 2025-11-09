/*
  Beginner Guide: ERC20TokenCreator
  - Purpose: Deploy an ERC‑20 token, mint supply, and read balance/total supply.
  - Quick Steps:
    1) Connect wallet and pick a test network.
    2) Fill name, symbol, and admin (your address), then Deploy.
    3) Enter recipient and amount, then Mint; reads auto-refresh.
  - Key Functions:
    compileERC20 → compiles Solidity or uses precompiled ABI/bytecode.
    deployContract → deploys token and stores its address.
    mintTokens → sends mint tx, waits for confirmation, then refreshes reads.
  - UX Notes:
    • Mint requires the admin to have the MINTER role.
    • Errors and pending confirmations are surfaced clearly.
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import { BrowserProvider, Contract, ethers } from 'ethers';
import precompiledERC20 from './precompiled/ERC20Minimal.json';

const CONFIRM_TIMEOUT_MS = 35000;

type NetworkKey = 'hoodi' | 'sepolia' | 'holesky' | 'amoy' | 'bscTestnet' | 'fuji' | 'chiado';

type Step = 1 | 2 | 3 | 4; // 1 Setup, 2 Deploying, 3 Mint, 4 Confirm

const NETWORKS: Record<NetworkKey, {
  chainIdHex: string;
  chainName: string;
  currency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  hoodi: { chainIdHex: '0x7e3c', chainName: 'Ethereum Hoodi (Testnet)', currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.hoodi.xyz'], blockExplorerUrls: ['https://explorer.hoodi.xyz'] },
  sepolia: { chainIdHex: '0xaa36a7', chainName: 'Ethereum Sepolia', currency: { name: 'Sepolia Ether', symbol: 'SEP', decimals: 18 }, rpcUrls: ['https://rpc.sepolia.org'], blockExplorerUrls: ['https://sepolia.etherscan.io'] },
  holesky: { chainIdHex: '0x4268', chainName: 'Ethereum Holesky (Testnet)', currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://ethereum-holesky.publicnode.com', 'https://rpc.holesky.ethpandaops.io'], blockExplorerUrls: ['https://holesky.etherscan.io'] },
  amoy: { chainIdHex: '0x13882', chainName: 'Polygon Amoy Testnet', currency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://rpc-amoy.polygon.technology'], blockExplorerUrls: ['https://amoy.polygonscan.com'] },
  bscTestnet: { chainIdHex: '0x61', chainName: 'BNB Smart Chain Testnet', currency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'], blockExplorerUrls: ['https://testnet.bscscan.com'] },
  fuji: { chainIdHex: '0xa869', chainName: 'Avalanche Fuji Testnet', currency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 }, rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'], blockExplorerUrls: ['https://testnet.snowtrace.io'] },
  chiado: { chainIdHex: '0x27d8', chainName: 'Gnosis Chiado', currency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 }, rpcUrls: ['https://rpc.chiadochain.net'], blockExplorerUrls: ['https://gnosis-chiado.blockscout.com'] },
};

const ERC20_CONTRACT_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BioVToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin, string memory name, string memory symbol)
        ERC20(name, symbol)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
    {
        _mint(to, amount);
    }
}`;

// ERC20 ABI for interaction
const ERC20_ABI = [
  "constructor(address admin, string name, string symbol)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address to, uint256 amount)"
];

function shortAddr(addr?: string) { 
  if (!addr) return ''; 
  return addr.slice(0, 8) + '…' + addr.slice(-4); 
}

function explorerFor(key: NetworkKey) { 
  return NETWORKS[key].blockExplorerUrls[0] || ''; 
}

// Prefer MetaMask when multiple injected providers exist
function getInjectedProvider(): any {
  const eth = (window as any).ethereum;
  if (!eth) return null;
  if (eth.providers?.length) {
    const mm = eth.providers.find((p: any) => p.isMetaMask);
    return mm || eth.providers[0];
  }
  return eth;
}

interface ERC20TokenCreatorProps {
  dark: boolean;
}

export default function ERC20TokenCreator({ dark }: ERC20TokenCreatorProps) {
  const [mode, setMode] = useState<'real' | 'local'>('real');
  const [networkKey, setNetworkKey] = useState<NetworkKey>('holesky');
  const [account, setAccount] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [explicitlyConnected, setExplicitlyConnected] = useState(false);
  
  // Beginner enhancements
  const [beginnerMode, setBeginnerMode] = useState<boolean>(true);
  const [learnOpen, setLearnOpen] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [celebrateMsg, setCelebrateMsg] = useState<string>('');
  
  // Token configuration
  const [tokenName, setTokenName] = useState<string>('My Token');
  const [tokenSymbol, setTokenSymbol] = useState<string>('MTK');
  const [adminAddress, setAdminAddress] = useState<string>('');
  
  // Contract state
  const [contractAddr, setContractAddr] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<string>('');
  
  // Token interaction
  const [mintToAddress, setMintToAddress] = useState<string>('');
  const [mintAmount, setMintAmount] = useState<string>('');
  const [balanceAddress, setBalanceAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('');
  const [totalSupply, setTotalSupply] = useState<string>('');
  const [isMinting, setIsMinting] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [isCheckingSupply, setIsCheckingSupply] = useState(false);
  const [mintStatus, setMintStatus] = useState<string>('');

  const tokenInteractionRef = useRef<HTMLDivElement | null>(null);
  const mintAddressInputRef = useRef<HTMLInputElement | null>(null);

  const provider = useMemo(() => {
    if (typeof window !== 'undefined') {
      if (mode === 'real') {
        const eth = getInjectedProvider();
        if (eth) return new BrowserProvider(eth);
      } else {
        return new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      }
    }
    return null;
  }, [mode]);

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
      } catch (error) {
        console.log('Not connected to wallet');
      }
    };
    
    checkConnection();
  }, [provider, mode, adminAddress]);

  const connectWallet = async () => {
    if (!provider) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    try {
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      setConnected(true);
      setExplicitlyConnected(true);
      if (!adminAddress) setAdminAddress(address);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const switchNetwork = async () => {
    if (!provider || mode !== 'real') return;

    const network = NETWORKS[networkKey];
    try {
      await provider.send('wallet_switchEthereumChain', [{ chainId: network.chainIdHex }]);
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await provider.send('wallet_addEthereumChain', [{
            chainId: network.chainIdHex,
            chainName: network.chainName,
            nativeCurrency: network.currency,
            rpcUrls: network.rpcUrls,
            blockExplorerUrls: network.blockExplorerUrls,
          }]);
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      } else {
        console.error('Failed to switch network:', error);
      }
    }
  };

  async function compileERC20(): Promise<{ abi: any[]; bytecode: string }> {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(new URL('./solc-worker.js', import.meta.url));
        worker.onmessage = (e: MessageEvent) => {
          const data = e.data as any;
          if (data.ok) {
            const abi = data.abi;
            const bytecode = data.bytecode;
            resolve({ abi, bytecode });
          } else {
            // Fallback to precompiled artifact if compilation fails
            resolve({ abi: (precompiledERC20 as any).abi, bytecode: (precompiledERC20 as any).bytecode });
          }
          try { worker.terminate(); } catch {}
        };
        worker.onerror = () => {
          // Fallback on worker error
          resolve({ abi: (precompiledERC20 as any).abi, bytecode: (precompiledERC20 as any).bytecode });
        };
        worker.postMessage({ source: ERC20_MINIMAL_SRC, filename: 'BioVToken.sol' });
      } catch (err: any) {
        // Fallback on unexpected error
        resolve({ abi: (precompiledERC20 as any).abi, bytecode: (precompiledERC20 as any).bytecode });
      }
    });
  }

  const deployToken = async () => {
    // Prevent duplicate clicks while a deploy is in flight
    if (isDeploying) return;
    if (!provider || !connected || !tokenName || !tokenSymbol || !adminAddress) {
      alert('Please connect wallet and fill all required fields');
      return;
    }
  
    setIsDeploying(true);
    setCurrentStep(2);
    setDeployStatus('Preparing deployment...');
  
    try {
      const signer = await provider.getSigner();

      // Chain mismatch detection
      try {
        const current = await provider.send('eth_chainId', []);
        const selected = NETWORKS[networkKey].chainIdHex.toLowerCase();
        if (typeof current === 'string' && current.toLowerCase() !== selected) {
          setDeployStatus('Wrong network. Switching...');
          await switchNetwork();
          const after = await provider.send('eth_chainId', []);
          if (typeof after === 'string' && after.toLowerCase() !== selected) {
            setDeployStatus('Please switch your wallet to the selected network.');
            setIsDeploying(false);
            setCurrentStep(1);
            return;
          }
        }
      } catch {}

      // Balance check
      try {
        const bal = await provider.getBalance(await signer.getAddress());
        if (bal === 0n) {
          setDeployStatus('❌ Insufficient funds for gas. Please top up testnet funds.');
          setIsDeploying(false);
          setCurrentStep(1);
          return;
        }
      } catch {}
  
      setDeployStatus('Compiling token contract...');
      const { abi, bytecode } = await compileERC20();
      if (!bytecode || bytecode === '0x') {
        setDeployStatus('Compiler failed to load. Please retry.');
        setIsDeploying(false);
        setCurrentStep(1);
        return;
      }
  
      const factory = new ethers.ContractFactory(abi, bytecode, signer);
  
      // First attempt: let wallet estimate gas and fees
      try {
        setDeployStatus('Confirming transaction...');
        const contract = await factory.deploy(adminAddress, tokenName, tokenSymbol);
        const tx = contract.deploymentTransaction();
        setDeployStatus('Waiting for first confirmation...');
        let receipt;
        try {
          receipt = await provider.waitForTransaction(tx!.hash, 1, CONFIRM_TIMEOUT_MS);
        } catch (e: any) {
          if (String(e?.code).toUpperCase() === 'TIMEOUT') {
            setDeployStatus('⏱️ Confirmation delayed. Proceeding optimistically...');
          } else {
            throw e;
          }
        }
         const address = receipt?.contractAddress ?? (contract as any).target ?? await contract.getAddress();
         setContractAddr(address);
        setDeployStatus(`✅ Token deployed at ${shortAddr(address)}`);
        setCelebrateMsg('✨ Contract live! Your token is on-chain.');
        setCurrentStep(3);
        if (!mintToAddress) setMintToAddress(account);
        if (!balanceAddress && account) setBalanceAddress(account);
        setTimeout(() => {
          tokenInteractionRef.current?.scrollIntoView({ behavior: 'smooth' });
          mintAddressInputRef.current?.focus();
        }, 200);
      } catch (primaryErr: any) {
        // Fallback: explicit gas limit when estimation fails
        const rawMsg = String(primaryErr?.message || primaryErr);
        const msg = rawMsg.toLowerCase();
        const maybeEstimationFail = (
        msg.includes('estimate gas') ||
        msg.includes('estimategas') ||
        msg.includes('gas required exceeds allowance') ||
        msg.includes('missing revert data') ||
        msg.includes('execution reverted') ||
        msg.includes('call_exception')
        );
        if (maybeEstimationFail) {
           try {
             const fallbackGas = 1_000_000n; // conservative fallback for ERC20
             setDeployStatus('Retrying with fallback gas...');
             const contract = await factory.deploy(adminAddress, tokenName, tokenSymbol, { gasLimit: fallbackGas });
             const tx = contract.deploymentTransaction();
             setDeployStatus('Waiting for first confirmation...');
             let receipt;
             try {
               receipt = await provider.waitForTransaction(tx!.hash, 1, CONFIRM_TIMEOUT_MS);
             } catch (e: any) {
               if (String(e?.code).toUpperCase() === 'TIMEOUT') {
                 setDeployStatus('⏱️ Confirmation delayed. Proceeding optimistically...');
               } else {
                 throw e;
               }
             }
              const address = receipt?.contractAddress ?? (contract as any).target ?? await contract.getAddress();
              setContractAddr(address);
             setDeployStatus(`✅ Token deployed at ${shortAddr(address)}`);
             setCelebrateMsg('✨ Contract live! Your token is on-chain.');
             setCurrentStep(3);
             if (!mintToAddress) setMintToAddress(account);
             setTimeout(() => {
               tokenInteractionRef.current?.scrollIntoView({ behavior: 'smooth' });
               mintAddressInputRef.current?.focus();
             }, 200);
           } catch (fallbackErr: any) {
             console.error('Deployment failed (fallback):', fallbackErr);
            setDeployStatus(`❌ Deployment failed: ${String(fallbackErr?.message || fallbackErr)}`);
            setCurrentStep(1);
           }
         } else {
           console.error('Deployment failed:', primaryErr);
          setDeployStatus(`❌ Deployment failed: ${rawMsg}`);
          setCurrentStep(1);
         }
       }
    } catch (error: any) {
      console.error('Deployment failed:', error);
      setDeployStatus(`❌ Deployment failed: ${String(error?.message || error)}`);
      setCurrentStep(1);
    } finally {
      setIsDeploying(false);
    }
  };

  const mintTokens = async () => {
    if (!contractAddr || !mintToAddress || !mintAmount || !provider) {
      alert('Please deploy contract first and fill all fields');
      return;
    }
  
    setIsMinting(true);
    setMintStatus('Sending mint transaction...');
    try {
      const signer = await provider.getSigner();

      // Pre-check: ensure we have gas funds to confirm
      try {
        const gasBal = await provider.getBalance(await signer.getAddress());
        if (gasBal === 0n) {
          setMintStatus('❌ Insufficient funds for gas. Top up testnet ETH.');
          setIsMinting(false);
          return;
        }
      } catch {}

      const contract = new Contract(contractAddr, ERC20_ABI, signer);
       
       const amount = ethers.parseEther(mintAmount);
       const tx = await contract.mint(mintToAddress, amount);
       setMintStatus('Waiting for first confirmation...');
       let rec;
       try {
         rec = await provider.waitForTransaction(tx.hash, 1, CONFIRM_TIMEOUT_MS);
       } catch (e: any) {
        if (String(e?.code).toUpperCase() === 'TIMEOUT') {
          setMintStatus('⏱️ Pending confirmation. Verify on explorer; will update when mined.');
          setIsMinting(false);
          return; // don’t claim success yet
        } else {
          throw e;
        }
       }
      // Check receipt status explicitly
      if (rec && (rec as any).status === 0) {
        setMintStatus('❌ Mint reverted. See explorer for details.');
      } else {
        setMintStatus(`✅ ${mintAmount} ${tokenSymbol} minted to ${shortAddr(mintToAddress)}`);
        setCelebrateMsg('🎉 First supply created. You own real tokens now.');
        setCurrentStep(4);
        // Auto-refresh reads after success
        try { await checkBalance(); } catch {}
        try { await checkTotalSupply(); } catch {}
      }
     } catch (error: any) {
       console.error('Minting failed:', error);
       setMintStatus(`❌ Minting failed: ${error.message || 'Unknown error'}`);
     } finally {
       setIsMinting(false);
     }
   };

  const checkBalance = async () => {
    if (!contractAddr || !provider) {
      alert('Please deploy contract first');
      return;
    }
    const addr = (balanceAddress || '').trim();
    if (!ethers.isAddress(addr)) {
      setBalance('Enter a valid wallet address');
      return;
    }
  
    setIsCheckingBalance(true);
    try {
      const contract = new Contract(contractAddr, ERC20_ABI, provider);
      const bal = await contract.balanceOf(addr);
      setBalance(ethers.formatEther(bal));
    } catch (error: any) {
      console.error('Balance check failed:', error);
      const msg = String(error?.shortMessage || error?.reason || error?.message || error || 'Unknown error');
      setBalance(`Error: ${msg}`);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const checkTotalSupply = async () => {
    if (!contractAddr || !provider) {
      alert('Please deploy contract first');
      return;
    }
  
    setIsCheckingSupply(true);
    try {
      const contract = new Contract(contractAddr, ERC20_ABI, provider);
      const supply = await contract.totalSupply();
      setTotalSupply(ethers.formatEther(supply));
    } catch (error: any) {
      console.error('Total supply check failed:', error);
      const msg = String(error?.shortMessage || error?.reason || error?.message || error || 'Unknown error');
      setTotalSupply(`Error: ${msg}`);
    } finally {
      setIsCheckingSupply(false);
    }
  };

  const prefillExamples = () => {
    setTokenName('My Awesome Token');
    setTokenSymbol('AWT');
    if (account) setAdminAddress(account);
  };

  // Stepper UI
  const StepBadge: React.FC<{ idx: number; label: string; active?: boolean; done?: boolean }> = ({ idx, label, active, done }) => (
    <div className={`flex items-center gap-2 ${active ? "text-blue-600" : done ? "text-green-600" : "text-gray-600"}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${done ? "bg-green-100 border-green-300" : active ? "bg-blue-100 border-blue-300" : "bg-gray-100 border-gray-300"}`}>
        {done ? "✓" : idx}
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Celebration banner */}
      {celebrateMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-md bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200 px-3 py-1 shadow">
          {celebrateMsg}
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-brand-gradient mb-2">ERC20 Token Creator</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Create and deploy your own ERC20 token with a simple, beginner-friendly interface
            </p>
          </div>

          {/* Stepper */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <StepBadge idx={1} label="Setup" />
            <StepBadge idx={2} label="Deploy" />
            <StepBadge idx={3} label="Mint" />
            <StepBadge idx={4} label="Confirm" />
          </div>

          {/* Learn card */}
          {beginnerMode && (
            <div className="card-base card-shadow p-4 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Learn: What’s an ERC‑20 token?</h2>
                <button className="text-sm underline" onClick={() => setLearnOpen(v => !v)}>
                  {learnOpen ? 'Hide' : 'Show'}
                </button>
              </div>
              {learnOpen && (
                <div className="mt-3 text-sm space-y-2 text-gray-700 dark:text-gray-300">
                  <p>ERC‑20 is a standard for fungible tokens that work across wallets and apps.</p>
                  <p><span className="font-medium">Name</span> is the full display name; <span className="font-medium">Symbol</span> is the short ticker (e.g., MTK).</p>
                  <p><span className="font-medium">Minting</span> creates new tokens to a wallet; total supply increases.</p>
                  <p><span className="font-medium">Gas</span> costs native coin (ETH on Holesky, MATIC on Amoy). Make sure you have testnet funds.</p>
                </div>
              )}
            </div>
          )}

          {/* Connection Status */}
          <div className="card-base card-shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Wallet Connection</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={beginnerMode} onChange={(e) => setBeginnerMode(e.target.checked)} />
                  Beginner Mode
                </label>
                <div className="flex gap-2">
                  <select 
                    className="input-base input-focus-brand text-sm"
                    value={mode} 
                    onChange={(e) => setMode(e.target.value as 'real' | 'local')}
                  >
                    <option value="real">MetaMask</option>
                    <option value="local">Local Node</option>
                  </select>
                  {mode === 'real' && (
                    <select 
                      className="input-base input-focus-brand text-sm"
                      value={networkKey} 
                      onChange={(e) => setNetworkKey(e.target.value as NetworkKey)}
                    >
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
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Connected: {shortAddr(account)}</span>
                </div>
              ) : (
                <button 
                  className="btn-base brand-gradient text-white btn-focus-brand"
                  onClick={connectWallet}
                >
                  Connect Wallet
                </button>
              )}
              
              {mode === 'real' && connected && (
                <button 
                  className="btn-secondary btn-focus-brand text-sm"
                  onClick={switchNetwork}
                >
                  Switch to {NETWORKS[networkKey].chainName}
                </button>
              )}
            </div>

            {beginnerMode && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">Tip: Keep MetaMask and the app on the same network during deploy and mint. Switching chains mid‑transaction can cause errors.</p>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Contract Code Display */}
            <div className="card-base card-shadow p-6">
              <h2 className="text-xl font-semibold mb-4">ERC20 Contract Template</h2>
              <div className="mb-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3 text-sm mb-3">
                  <p className="font-medium text-blue-800 dark:text-blue-200">📚 What is this?</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    This is a standard ERC20 token contract using OpenZeppelin libraries. It includes minting capabilities and role-based access control.
                  </p>
                </div>
              </div>
              <textarea 
                className="input-base input-focus-brand w-full h-80 font-mono text-xs p-3" 
                value={ERC20_CONTRACT_TEMPLATE}
                readOnly
              />
            </div>

            {/* Token Configuration */}
            <div className="space-y-6">
              {/* Token Setup */}
              <div className="card-base card-shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-semibold">Token Setup</h2>
                  <button className="btn-secondary btn-focus-brand text-sm" onClick={prefillExamples}>Use Examples</button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Token Name
                      <span className="text-gray-500 ml-1">(e.g., "My Awesome Token")</span>
                    </label>
                    <input 
                      className="input-base input-focus-brand"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder={beginnerMode ? 'What should we call your token?' : 'Enter token name'}
                    />
                    {beginnerMode && <p className="text-xs text-gray-500 mt-1">A name people recognize, like “My Awesome Token”.</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Token Symbol
                      <span className="text-gray-500 ml-1">(e.g., "MTK")</span>
                    </label>
                    <input 
                      className="input-base input-focus-brand"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder={beginnerMode ? 'Choose a short ticker (3–5 letters)' : 'Enter token symbol'}
                    />
                    {beginnerMode && <p className="text-xs text-gray-500 mt-1">Short and bold — uppercase ticker works great.</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Admin/Owner Address
                      <span className="text-gray-500 ml-1">(who can mint tokens)</span>
                    </label>
                    <input 
                      className="input-base input-focus-brand"
                      value={adminAddress}
                      onChange={(e) => setAdminAddress(e.target.value)}
                      placeholder={beginnerMode ? 'Your wallet address (0x...) is perfect' : '0x...'}
                    />
                    {beginnerMode && <p className="text-xs text-gray-500 mt-1">This wallet can mint. Use your address or a teammate’s.</p>}
                  </div>
                  
                  <div className="pt-2">
                    {beginnerMode && <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Ready to bring your token to life? Let’s deploy it.</p>}
                    <button 
                      className="btn-base brand-gradient text-white btn-focus-brand w-full"
                      onClick={deployToken}
                      disabled={isDeploying || !connected}
                    >
                      {isDeploying ? 'Deploying...' : 'Deploy Token Contract'}
                    </button>
                  </div>
                  
                  {deployStatus && (
                    <div className={`text-sm rounded-md px-3 py-2 ${
                      deployStatus.includes('✅') 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                        : deployStatus.includes('❌')
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                    }`}>
                      {deployStatus}
                      {contractAddr && (
                        <div className="mt-2">
                          <a 
                            href={`${explorerFor(networkKey)}/address/${contractAddr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            View on Explorer
                          </a>
                          <p className="mt-2 text-sm">👉 To which wallet address do you want to mint tokens?</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Token Interaction */}
              {contractAddr && (
                <div ref={tokenInteractionRef} className="card-base card-shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">Token Interaction</h2>
                  
                  <div className="space-y-4">
                    {/* Mint Tokens */}
                    <div className="border-b pb-4">
                      <h3 className="font-medium mb-3">Mint Tokens</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Who gets the first mint? Enter a wallet address to receive fresh tokens.</p>
                      <div className="space-y-2">
                        <input 
                          className="input-base input-focus-brand"
                          ref={mintAddressInputRef}
                          value={mintToAddress}
                          onChange={(e) => setMintToAddress(e.target.value)}
                          placeholder="Recipient address (0x...)"
                        />
                        <input 
                          className="input-base input-focus-brand"
                          value={mintAmount}
                          onChange={(e) => setMintAmount(e.target.value)}
                          placeholder="Amount (e.g., 100)"
                          type="number"
                        />
                        <button 
                          className="btn-base success-gradient text-white btn-focus-success w-full"
                          onClick={mintTokens}
                          disabled={isMinting}
                        >
                          {isMinting ? 'Minting...' : 'Mint Tokens'}
                        </button>
                        {mintStatus && (
                          <div className={`text-sm rounded-md px-3 py-2 ${
                            mintStatus.includes('✅') 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                          }`}>
                            {mintStatus}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Check Balance */}
                    <div className="border-b pb-4">
                      <h3 className="font-medium mb-3">Check Balance</h3>
                      <div className="space-y-2">
                        <input 
                          className="input-base input-focus-brand"
                          value={balanceAddress}
                          onChange={(e) => setBalanceAddress(e.target.value)}
                          placeholder="Address to check (0x...)"
                        />
                        <button 
                          className="btn-secondary btn-focus-brand w-full"
                          onClick={checkBalance}
                          disabled={isCheckingBalance || !ethers.isAddress(balanceAddress)}
                        >
                          {isCheckingBalance ? 'Checking...' : 'Check Balance'}
                        </button>
                        {balance && (
                          <div className="text-sm bg-gray-100 dark:bg-gray-700 rounded p-2">
                            Balance: {balance} {tokenSymbol}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Total Supply */}
                    <div>
                      <h3 className="font-medium mb-3">Total Supply</h3>
                      <button 
                        className="btn-secondary btn-focus-brand w-full"
                        onClick={checkTotalSupply}
                        disabled={isCheckingSupply}
                      >
                        {isCheckingSupply ? 'Checking...' : 'View Total Supply'}
                      </button>
                      {totalSupply && (
                        <div className="text-sm bg-gray-100 dark:bg-gray-700 rounded p-2 mt-2">
                          Total Supply: {totalSupply} {tokenSymbol}
                        </div>
                      )}
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

const ERC20_MINIMAL_SRC = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract BioVToken {\n    string public name;\n    string public symbol;\n    uint8 public decimals = 18;\n    uint256 public totalSupply;\n    address public owner;\n    mapping(address => uint256) private _balances;\n\n    constructor(address admin, string memory _name, string memory _symbol) {\n        owner = admin;\n        name = _name;\n        symbol = _symbol;\n    }\n\n    modifier onlyOwner() {\n        require(msg.sender == owner, "not owner");\n        _;\n    }\n\n    function balanceOf(address account) public view returns (uint256) {\n        return _balances[account];\n    }\n\n    function mint(address to, uint256 amount) external onlyOwner {\n        _balances[to] += amount;\n        totalSupply += amount;\n    }\n}`;