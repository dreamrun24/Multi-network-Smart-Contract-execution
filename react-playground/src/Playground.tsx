/*
  Beginner Guide: Smart Contract Playground
  - Purpose: Deploy a minimal contract (SimpleStorage) and interact with it.
  - Quick Steps:
    1) Connect wallet and select a test network.
    2) Deploy SimpleStorage (stores a string message).
    3) Use Set to change the message; use Get to read it.
  - Key Functions:
    compile → compiles Solidity to ABI/bytecode (with fallback precompiled).
    deploy → deploys the contract and saves the address.
    setMessage/getMessage → write/read calls to the chain.
  - UX Notes:
    • Faucet links are provided for testnet funds.
    • Errors show readable messages when RPC reverts occur.
*/
import { useEffect, useMemo, useState } from 'react';
import './index.css';
import { BrowserProvider, Contract, ethers } from 'ethers';
import precompiledSimpleStorage from './precompiled/SimpleStorage.json';

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
  holesky: { chainIdHex: '0x4268', chainName: 'Ethereum Holesky (Testnet)', currency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://ethereum-holesky.publicnode.com', 'https://rpc.holesky.ethpandaops.io'], blockExplorerUrls: ['https://holesky.etherscan.io'] },
  amoy: { chainIdHex: '0x13882', chainName: 'Polygon Amoy Testnet', currency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://rpc-amoy.polygon.technology'], blockExplorerUrls: ['https://amoy.polygonscan.com'] },
  bscTestnet: { chainIdHex: '0x61', chainName: 'BNB Smart Chain Testnet', currency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'], blockExplorerUrls: ['https://testnet.bscscan.com'] },
  fuji: { chainIdHex: '0xa869', chainName: 'Avalanche Fuji Testnet', currency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 }, rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'], blockExplorerUrls: ['https://testnet.snowtrace.io'] },
  chiado: { chainIdHex: '0x27d8', chainName: 'Gnosis Chiado', currency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 }, rpcUrls: ['https://rpc.chiadochain.net'], blockExplorerUrls: ['https://gnosis-chiado.blockscout.com'] },
};

// Add multiple faucet options per network (primary first, then alternatives)
const FAUCETS: Record<NetworkKey, string[]> = {
  hoodi: [],
  sepolia: [
    'https://faucet.sepolia.dev',
    'https://www.alchemy.com/faucets/ethereum-sepolia',
    'https://www.infura.io/faucet/sepolia',
    'https://faucets.chain.link/sepolia',
    'https://faucet.quicknode.com/ethereum/sepolia',
  ],
  holesky: [
    'https://faucet.holesky.ethpandaops.io',
    'https://holesky-faucet.pk910.de',
    'https://ethglobal.com/faucet/holesky-17000',
  ],
  amoy: [
    'https://faucet.polygon.technology',
    'https://www.alchemy.com/faucets/polygon-amoy',
    'https://faucet.quicknode.com/polygon/amoy',
  ],
  bscTestnet: ['https://testnet.bnbchain.org/faucet-smart'],
  fuji: ['https://faucet.avax.network'],
  chiado: ['https://gnosisfaucet.com'],
};
const SIMPLE_STORAGE_SRC = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract SimpleStorage {\n    string private message = "Hello";\n    function setMessage(string memory _message) public {\n        message = _message;\n    }\n    function getMessage() public view returns (string memory) {\n        return message;\n    }\n}`;

function shortAddr(addr?: string) { if (!addr) return ''; return addr.slice(0, 8) + '…' + addr.slice(-4); }
function explorerFor(key: NetworkKey) { return NETWORKS[key].blockExplorerUrls[0] || ''; }

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

export default function Playground() {
  const [mode, setMode] = useState<'real' | 'local'>('real');
  const [networkKey, setNetworkKey] = useState<NetworkKey>('hoodi');
  const [account, setAccount] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [explicitlyConnected, setExplicitlyConnected] = useState(false);
  const [contractAddr, setContractAddr] = useState<string>('');
  const [abi, setAbi] = useState<any[]>([]);
  const [bytecode, setBytecode] = useState<string>('');
  const [compileStatus, setCompileStatus] = useState<string>('Ready');
  const [compileError, setCompileError] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [newMessage, setNewMessage] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [allowEdit, setAllowEdit] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [sourceCode, setSourceCode] = useState<string>(SIMPLE_STORAGE_SRC);
  const [localSigner, setLocalSigner] = useState<any>(null);
  const [hideFallbackBanner, setHideFallbackBanner] = useState(false);

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



  async function compileSource(): Promise<{ abi: any[]; bytecode: string }> {
    return new Promise((resolve) => {
      const worker = new Worker(new URL('./solc-worker.js', import.meta.url));
      setCompileError('');
      setCompileStatus('Compiling…');
  
      const resolveWithPrecompiled = () => {
        try { worker.terminate(); } catch {}
        setAbi((precompiledSimpleStorage as any).abi);
        setBytecode((precompiledSimpleStorage as any).bytecode);
        setCompileStatus('Using precompiled artifact');
        resolve({ abi: (precompiledSimpleStorage as any).abi, bytecode: (precompiledSimpleStorage as any).bytecode });
      };
  
      const timeout = setTimeout(resolveWithPrecompiled, 20000);
  
      worker.onmessage = (e: MessageEvent) => {
        clearTimeout(timeout);
        const data = e.data as any;
        if (data.ok) {
          setAbi(data.abi);
          setBytecode(data.bytecode);
          setCompileStatus('Compiled successfully');
          try { worker.terminate(); } catch {}
          resolve({ abi: data.abi, bytecode: data.bytecode });
        } else {
          // Fall back to local precompiled artifacts on any compiler error
          resolveWithPrecompiled();
        }
      };
  
      worker.postMessage({ source: sourceCode, filename: 'SimpleStorage.sol' });
    });
  }

  useEffect(() => {
    compileSource().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Reset connection if mode changes or wallet missing
    if (mode === 'real') {
      const eth = getInjectedProvider();
      if (!eth) {
        setAccount('');
        setConnected(false);
        setExplicitlyConnected(false);
      }
    } else {
      setAccount('');
      setConnected(false);
      setExplicitlyConnected(false);
    }
  }, [mode]);

  async function connectWallet() {
    try {
      if (mode === 'local') {
        if (!provider) throw new Error('Local RPC not available');
        try { await (provider as any).getBlockNumber(); } catch {
          alert('Local node not reachable. Start Hardhat with: npx hardhat node');
          return;
        }
        const devPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
        const wallet = new ethers.Wallet(devPrivateKey, provider as any);
        setLocalSigner(wallet);
        setAccount(wallet.address);
        setConnected(true);
        return;
      }
      const eth = getInjectedProvider();
      if (!eth) throw new Error('Wallet not detected');
      // Always request accounts explicitly to require a user-initiated connect
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      const addr = accounts?.[0];
      if (!addr) throw new Error('No account returned');
      setAccount(addr);
      setConnected(true);
      setExplicitlyConnected(true);
    } catch (e: any) {
      console.error('Connect error', e);
      const msg = e?.code === 4001 ? 'You rejected the connect request in MetaMask.' : (e?.message || String(e));
      alert('Connect error: ' + msg);
    }
  }

  async function ensureNetwork(key: NetworkKey) {
    if (mode === 'local') return; // No chain switching for local mode
    if (!provider) return; const eth = getInjectedProvider(); const chainId = NETWORKS[key].chainIdHex;
    if (!eth) throw new Error('Wallet missing');
    try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] }); }
    catch (err: any) { if (err?.code === 4902) { await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId, chainName: NETWORKS[key].chainName, nativeCurrency: NETWORKS[key].currency, rpcUrls: NETWORKS[key].rpcUrls, blockExplorerUrls: NETWORKS[key].blockExplorerUrls }] }); } else { throw err; } }
  }

  async function deploy() {
    try {
      if (!provider) throw new Error('Provider missing');
      setIsDeploying(true);
      if (mode === 'local') {
        try { await (provider as any).getBlockNumber(); } catch {
          alert('Local node not reachable. Start Hardhat with: npx hardhat node');
          setIsDeploying(false);
          return;
        }
      } else {
        await ensureNetwork(networkKey);
      }
      const { abi: compiledAbi, bytecode: compiledBytecode } = await compileSource();
      if (!compiledBytecode || !compiledAbi.length) throw new Error('Compile failed');
      const devPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const signer = mode === 'real' ? await (provider as any).getSigner() : (localSigner || new ethers.Wallet(devPrivateKey, provider as any));
  
      // Preflight for real networks: estimate gas and check balance to avoid RPC -32603
      if (mode === 'real') {
        try {
          const factory = new ethers.ContractFactory(compiledAbi, compiledBytecode, signer);
          const txReq = factory.getDeployTransaction();
          const estimate = await (provider as any).estimateGas(txReq);
          const feeData = await (provider as any).getFeeData();
          const gasPrice: bigint = (feeData.maxFeePerGas ?? feeData.gasPrice ?? ethers.parseUnits('1', 'gwei')) as bigint;
          const needed = estimate * gasPrice;
          const addr = await signer.getAddress();
          const balance = await (provider as any).getBalance(addr);
          if (balance < needed) {
            console.warn(`Preflight shows low balance (${formatEthWei(balance)} < ~${formatEthWei(needed)}). Continuing to MetaMask; its estimator is often more accurate.`);
          }
        } catch (pfErr: any) {
          // Continue even if preflight fails; MetaMask may still estimate successfully
          console.warn('Preflight failed', pfErr);
        }
      }
  
      const factory = new ethers.ContractFactory(compiledAbi, compiledBytecode, signer);
      const contract = await factory.deploy();
      await contract.waitForDeployment();
      const addr = await contract.getAddress();
      setContractAddr(addr);
      const c = new Contract(addr, compiledAbi, signer);
      const current = await c.getMessage();
      setMessage(current);
    } catch (e: any) { alert('Deploy error: ' + extractRpcReason(e)); } finally { setIsDeploying(false); }
  }

  async function updateMsg() {
    try {
      if (!provider) throw new Error('Provider missing');
      if (!contractAddr) throw new Error('Deploy first');
      setIsUpdating(true);
      if (mode === 'local') {
        try { await (provider as any).getBlockNumber(); } catch {
          alert('Local node not reachable. Start Hardhat with: npx hardhat node');
          setIsUpdating(false);
          return;
        }
      }
      const devPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const signer = mode === 'real' ? await (provider as any).getSigner() : (localSigner || new ethers.Wallet(devPrivateKey, provider as any));
      const c = new Contract(contractAddr, abi, signer);
      const tx = await c.setMessage(newMessage || '');
      await tx.wait();
      const current = await c.getMessage();
      setMessage(current);
      setNewMessage('');
    }
    catch (e: any) { alert('Update error: ' + e.message); } finally { setIsUpdating(false); }
  }

  const explorer = explorerFor(networkKey);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 bg-grid">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-gradient title-glow">Multi Network Smart Contract Playground</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Learn blockchain development by writing, deploying, and testing smart contracts.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <section className="card-base card-shadow card-hover p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold mb-1"><span className="heading-dot-brand"></span>Setup &amp; Test Your Contract</h2>
            <p className="text-base font-medium text-gray-700 dark:text-gray-200 mb-4">Step 1: How do you want to test?</p>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2"><span className="font-medium">Choose your testing mode.</span><span className="badge-neutral">{mode === 'real' ? 'Real' : 'Local'}</span></div>
              <select className="input-base input-focus-brand" value={mode} onChange={(e) => setMode(e.target.value as 'real' | 'local')}>
                <option value="real">Real Blockchain (Test Networks)</option>
                <option value="local">Local Simulation (Hardhat/Ganache)</option>
              </select>
            </div>
  
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2"><span className="font-medium">Step 2: Connect the wallet</span><span className="badge-success">{connected && explicitlyConnected ? 'Connected' : ''}</span></div>
              <button onClick={connectWallet} disabled={!provider} className="btn-base btn-focus-brand brand-gradient text-white hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60">Connect Wallet <span className="inline-flex items-center justify-center text-xs w-5 h-5 rounded-full bg-white/20">i</span></button>
              {!provider && mode === 'real' && (<p className="mt-2 text-xs text-red-600">No wallet detected. Install MetaMask and reload.</p>)}
              {connected && explicitlyConnected && (<p className="mt-2 text-sm">Connected: {shortAddr(account)} on {mode === 'real' ? NETWORKS[networkKey].chainName : 'Local Hardhat Node'}</p>)}
            </div>
  
            <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-700 rounded-md p-3 text-sm dark:text-gray-100">
              <p className="font-semibold flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500"></span>
                What is a Wallet?
              </p>
              <p className="mt-1">
                A wallet is your digital crypto account. It keeps your keys, shows your balance,
                and lets you approve transactions on the selected network. Keep your recovery
                phrase safe.
              </p>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2"><span className="font-medium">Step 3: Choose a Blockchain Network</span><span className="badge-neutral">{NETWORKS[networkKey].chainName}</span></div>
              <select className="input-base input-focus-brand" value={networkKey} onChange={(e) => setNetworkKey(e.target.value as NetworkKey)} disabled={mode === 'local'}>
                <option value="hoodi">Ethereum Hoodi (Testnet)</option>
                <option value="sepolia">Ethereum Sepolia</option>
                <option value="holesky">Ethereum Holesky (Testnet)</option>
                <option value="amoy">Polygon Amoy</option>
                <option value="bscTestnet">BNB Smart Chain Testnet</option>
                <option value="fuji">Avalanche Fuji</option>
                <option value="chiado">Gnosis Chiado</option>
              </select>
              <div className="mt-2 text-sm rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-100 px-3 py-2">Selected: {NETWORKS[networkKey].chainName}</div>
              {mode === 'real' && (
                <div>
                  <button
                    type="button"
                    className="mt-2 btn-base btn-focus-success success-gradient text-white hover:opacity-90 btn-glow-success disabled:opacity-60"
                    onClick={(e) => {
                      e.preventDefault();
                      const url = FAUCETS[networkKey][0];
                      if (url) window.open(url, '_blank');
                    }}
                    disabled={FAUCETS[networkKey].length === 0}
                  >
                    Fund Testnet
                  </button>
                  {FAUCETS[networkKey].length === 0 && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      Faucet unavailable for this network. Use Sepolia, Amoy, Fuji, or Local mode.
                    </div>
                  )}
                  {FAUCETS[networkKey].length > 1 && (
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      Alternatives:
                      <ul className="list-disc pl-5 mt-1">
                        {FAUCETS[networkKey].slice(1).map((link) => (
                          <li key={link}>
                            <a className="text-indigo-600 hover:underline" href={link} target="_blank" rel="noreferrer">{link}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
  
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2"><span className="font-medium">Step 4: Deploy Contract</span><span className="badge-success">{contractAddr ? 'Deployed' : ''}</span></div>
              <button onClick={deploy} disabled={isDeploying} className="w-full btn-base btn-focus-success success-gradient text-white hover:opacity-90 disabled:opacity-60">{isDeploying ? 'Deploying…' : (mode === 'real' ? `Step 4: Deploy Contract to ${NETWORKS[networkKey].chainName}` : 'Step 4: Deploy Contract to Local Hardhat Node')}</button>
              {contractAddr && (
                <div className="mt-2 text-sm flex items-center gap-2">
                  <a className="text-indigo-600 hover:underline" href={`${explorer}/address/${contractAddr}`} target="_blank" rel="noreferrer">{contractAddr}</a>
                  <button className="btn-secondary btn-sm btn-focus-brand" onClick={() => navigator.clipboard.writeText(contractAddr)}>Copy</button>
                  {mode === 'real' && (
                    <a className="btn-base btn-focus-brand brand-gradient text-white hover:opacity-90" href={`${explorer}/address/${contractAddr}`} target="_blank" rel="noreferrer">View Contract on Etherscan</a>
                  )}
                </div>
              )}
            </div>
  
            <div className="mb-2">
              <p className="text-sm">Stored message: <span className="font-mono">{message || 'Hello'}</span></p>
              <div className="mt-2 flex gap-2">
                <input className="flex-1 input-base input-focus-brand" placeholder="Enter new message" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                <button onClick={updateMsg} disabled={!contractAddr || isUpdating} className="btn-secondary btn-focus-brand disabled:opacity-60">{isUpdating ? 'Updating…' : 'Update Message'}</button>
              </div>
            </div>
  
  
          </section>
  
          <section className="card-base card-shadow p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your Smart Contract Code</h2>
              <label className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={allowEdit} onChange={() => setAllowEdit((v) => !v)} />
                Allow Editing
                <span className="inline-flex items-center justify-center text-xs w-5 h-5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300">i</span>
              </label>
            </div>
  
            <div className="mt-3">
              <div className="mb-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700 rounded-md p-3 text-sm dark:text-gray-100">
                <p className="font-semibold flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-blue-500"></span>
                  What is this contract?
                </p>
                <p className="mt-1">
                  This is a <span className="font-semibold">SimpleStorage</span> contract that stores text on the blockchain. The
                  <code className="font-mono"> setMessage()</code> function saves your message, and
                  <code className="font-mono"> getMessage()</code> reads it back. Think of it like a digital sticky note
                  that lives forever on the blockchain!
                </p>
              </div>
              <div className="mb-2 flex gap-2">
                <button className="btn-secondary btn-sm btn-focus-brand" onClick={() => setSourceCode(SIMPLE_STORAGE_SRC)}>Undo Changes</button>
                <button className="btn-secondary btn-sm btn-focus-brand" onClick={() => navigator.clipboard.writeText(sourceCode)}>Copy Code</button>
                <button className="btn-secondary btn-sm btn-focus-brand" onClick={() => setShowTips((v) => !v)}>{showTips ? 'Hide Tips' : 'Show Tips'}</button>
              </div>
              {showTips && (
                <div className="mb-3 bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 text-sm">
                  <p className="font-medium">Tips</p>
                  <ul className="mt-1 list-disc pl-5">
                    <li>Allow Editing to modify the SimpleStorage contract.</li>
                    <li>Connect your wallet, then pick a test network.</li>
                    <li>Click Deploy to publish your contract and test get/set.</li>
                  </ul>
                </div>
              )}
              <textarea className="input-base input-focus-brand w-full h-72 font-mono text-sm p-3" value={sourceCode} onChange={(e) => allowEdit && setSourceCode(e.target.value)} readOnly={!allowEdit} />
              {compileError && (
                <div className="mt-3 text-sm rounded-md bg-red-100 text-red-800 px-3 py-2">Compiler error: {compileError}</div>
              )}
              {!compileError && compileStatus === 'Compiler error' && (
                <div className="mt-3 text-sm rounded-md bg-red-100 text-red-800 px-3 py-2">Compiler timeout.</div>
              )}
              {false && (
                <div className="mt-3 text-sm rounded-md bg-yellow-100 text-yellow-800 px-3 py-2 flex items-center justify-between">
                  <span>Using local ABI/bytecode fallback. Edits compile once the Solidity compiler loads.</span>
                  <button className="text-xs text-yellow-900 underline ml-3" onClick={() => setHideFallbackBanner(true)}>Hide</button>
                </div>
              )}
              <p className="text-xs mt-2 text-gray-500">Deploy compiles your edits in-browser and deploys to the selected network.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function formatMaticWei(wei: bigint) {
  try { return (Number(wei) / 1e18).toFixed(6) + ' MATIC'; } catch { return wei.toString() + ' wei'; }
}

function formatEthWei(wei: bigint) {
  try { return (Number(wei) / 1e18).toFixed(6) + ' ETH'; } catch { return wei.toString() + ' wei'; }
}

function extractRpcReason(e: any): string {
  const parts = [
    e?.shortMessage,
    e?.message,
    e?.reason,
    e?.info?.error?.message,
    e?.info?.error?.data?.message,
    e?.error?.message,
    e?.response?.error?.message,
  ].filter(Boolean);
  const msg = parts[0] || 'Unknown error';
  const lower = msg.toLowerCase();
  const code = (e?.code ?? e?.info?.error?.code);
  if (lower.includes('could not coalesce error')) return 'RPC returned an opaque error, often insufficient funds or gas estimation failure.';
  if (code === -32603 || lower.includes('internal json-rpc error')) return 'Internal JSON-RPC error (-32603). This usually indicates insufficient funds or a failed gas estimate.';
  if (lower.includes('insufficient funds')) return 'Insufficient funds for gas. Fund the testnet native currency (e.g., ETH).';
  if (lower.includes('nonce')) return 'Account nonce issue. Try resetting account in MetaMask.';
  if (lower.includes('replacement transaction underpriced')) return 'Replacement tx underpriced. Wait or raise gas.';
  return msg;
}