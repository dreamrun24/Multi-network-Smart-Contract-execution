const CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_message",
        "type": "string"
      }
    ],
    "name": "setMessage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMessage",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

let provider;
let signer;
let contract;
let deployedAddress = "";
let defaultTestnetAddress = "";
const HOODI_CHAIN_ID = 32316; // Ethereum Hoodi chain id
const HOODI_CHAIN_ID_HEX = '0x7e3c'; // 32316 in hex
const HOODI_PARAMS = {
  chainId: HOODI_CHAIN_ID_HEX,
  chainName: 'Ethereum Hoodi (Testnet)',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.hoodi.xyz'],
  blockExplorerUrls: ['https://explorer.hoodi.xyz'],
};

// Additional EVM test networks
const NETWORKS = {
  hoodi: {
    key: 'hoodi',
    decimalChainId: HOODI_CHAIN_ID,
    params: HOODI_PARAMS
  },
  sepolia: {
    key: 'sepolia',
    decimalChainId: 11155111,
    params: {
      chainId: '0xaa36a7',
      chainName: 'Ethereum Sepolia',
      nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://ethereum-sepolia.publicnode.com'],
      blockExplorerUrls: ['https://sepolia.etherscan.io']
    }
  },
  amoy: {
    key: 'amoy',
    decimalChainId: 80002,
    params: {
      chainId: '0x13882',
      chainName: 'Polygon Amoy',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://polygon-amoy-bor-rpc.publicnode.com'],
      blockExplorerUrls: ['https://amoy.polygonscan.com']
    }
  },
  bsctest: {
    key: 'bsctest',
    decimalChainId: 97,
    params: {
      chainId: '0x61',
      chainName: 'BNB Smart Chain Testnet',
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
      blockExplorerUrls: ['https://testnet.bscscan.com']
    }
  },
  fuji: {
    key: 'fuji',
    decimalChainId: 43113,
    params: {
      chainId: '0xa869',
      chainName: 'Avalanche Fuji Testnet',
      nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
      rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
      blockExplorerUrls: ['https://testnet.snowtrace.io']
    }
  },
  chiado: {
    key: 'chiado',
    decimalChainId: 10200,
    params: {
      chainId: '0x27d8',
      chainName: 'Gnosis Chiado',
      nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
      rpcUrls: ['https://rpc.chiadochain.net'],
      blockExplorerUrls: ['https://gnosis-chiado.blockscout.com']
    }
  }
};

async function ensureHoodiNetwork(browserProvider) {
  const net = await browserProvider.getNetwork();
  const current = Number(net.chainId ?? 0n);
  if (current === HOODI_CHAIN_ID) return true;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HOODI_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchErr) {
    // If chain not added, add it and try again
    if (switchErr && switchErr.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [HOODI_PARAMS],
        });
        return true;
      } catch (addErr) {
        showNotification('Please add Hoodi in MetaMask manually.', 'error');
        return false;
      }
    }
    showNotification('Switch to Ethereum Hoodi in MetaMask.', 'error');
    return false;
  }
}

function showNotification(message, type = "info") {
  const notification = document.getElementById('notification');
  const emoji = type === 'success' ? '🚀 ' : type === 'error' ? '❌ ' : 'ℹ️ ';
  notification.innerText = `${emoji}${message}`;
  notification.style.color = '#fff';
  notification.style.background = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
  notification.style.borderRadius = '10px';
  notification.style.padding = '8px 12px';
  notification.style.display = 'inline-block';
  notification.style.fontWeight = '700';
  setTimeout(() => { 
    notification.innerText = ""; 
    notification.style.display = 'none';
    notification.style.background = 'transparent';
  }, 3500);
}

let selectedNetworkKey = 'hoodi';

function getExplorerBase() {
  const base = (NETWORKS[selectedNetworkKey]?.params?.blockExplorerUrls?.[0]) || '';
  return (base || '').replace(/\/+$/, '');
}

function addressUrl(addr) {
  const base = getExplorerBase();
  return base ? `${base}/address/${addr}` : '';
}

function txUrl(hash) {
  const base = getExplorerBase();
  return base ? `${base}/tx/${hash}` : '';
}

function setExplorerLinks({ address, txHash }) {
  const el = document.getElementById('explorerLinks');
  const base = getExplorerBase();
  const explorerName = (() => {
    try {
      const host = new URL(base || 'http://example.com').host || '';
      if (host.includes('etherscan')) return 'Etherscan';
      if (host.includes('polygonscan')) return 'Polygonscan';
      if (host.includes('bscscan')) return 'BscScan';
      if (host.includes('snowtrace')) return 'Snowtrace';
      if (host.includes('blockscout')) return 'Blockscout';
      if (host.includes('pk910')) return 'Explorer';
      return 'Explorer';
    } catch { return 'Explorer'; }
  })();
  const parts = [];
  if (address) {
    const url = addressUrl(address);
    if (url) {
      parts.push(`<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;margin-right:8px;background:#111827;color:#fff;padding:6px 10px;border-radius:8px;text-decoration:none;">View Contract on ${explorerName}</a>`);
    }
  }
  if (txHash) {
    const url = txUrl(txHash);
    if (url) {
      parts.push(`<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;margin-right:8px;background:#4f46e5;color:#fff;padding:6px 10px;border-radius:8px;text-decoration:none;">View Transaction on ${explorerName}</a>`);
    }
  }
  el.innerHTML = parts.join('');
}

async function ensureSelectedNetwork(browserProvider) {
  const net = await browserProvider.getNetwork();
  const current = Number(net.chainId ?? 0n);
  const target = NETWORKS[selectedNetworkKey];
  if (!target) return true;
  if (current === target.decimalChainId) return true;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: target.params.chainId }],
    });
    return true;
  } catch (switchErr) {
    if (switchErr && switchErr.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [target.params],
        });
        return true;
      } catch (addErr) {
        showNotification(`Please add ${target.params.chainName} in MetaMask manually.`, 'error');
        return false;
      }
    }
    showNotification(`Switch to ${target.params.chainName} in MetaMask.`, 'error');
    return false;
  }
}

function updateContractAddress(address, mode) {
  const section = document.getElementById('contractAddressSection');
  if (address) {
    const link = addressUrl(address);
    const modeLabel = (mode === 'simulation' ? 'Simulation' : 'Testnet');
    const addrHtml = link
      ? `Contract deployed at: <a href="${link}" target="_blank" rel="noopener">${address}</a> (${modeLabel})`
      : `Contract deployed at: ${address} (${modeLabel})`;
    section.innerHTML = `${addrHtml} <button id="copyAddressBtn" style="margin-left:8px;background:#111827;color:#fff;padding:4px 8px;border-radius:6px;">Copy</button>`;
    const copyBtn = document.getElementById('copyAddressBtn');
    if (copyBtn) copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(address);
        showNotification('Address copied to clipboard.', 'success');
      } catch {
        showNotification('Copy failed. Please copy manually.', 'error');
      }
    };
    setExplorerLinks({ address });
  } else {
    section.innerText = "";
    setExplorerLinks({});
  }
}

window.onload = () => {
  const networkModeSelect = document.getElementById('networkMode');
  let currentMode = networkModeSelect.value;
  const networkSelectRow = document.getElementById('testnetNetworkRow');
  const networkSelect = document.getElementById('testnetNetwork');
  const testnetSection = document.getElementById('testnetContractSection');
  const addrInput = document.getElementById('contractAddressInput');
  const deployBtn = document.getElementById('deployButton');
  const hint = document.getElementById('contractHint');
  const setBtn = document.getElementById('setMessageButton');
  const getBtn = document.getElementById('getMessageButton');
  const editToggle = document.getElementById('editModeToggle');
  const editor = document.getElementById('sampleContract');
  const themeToggle = document.getElementById('themeToggle');
  const step1 = document.getElementById('step1Check');
  const step2 = document.getElementById('step2Check');
  const step3 = document.getElementById('step3Check');
  const step4 = document.getElementById('step4Check');
  const tipBox = document.getElementById('tipBox');
  const toggleTipsBtn = document.getElementById('toggleTipsBtn');
  const networkStatus = document.getElementById('networkStatus');
  const progressBar = document.getElementById('progressBarInner');
  const progressLabel = document.getElementById('progressLabel');
  const stepDone = { 1: false, 2: false, 3: false, 4: false };

  function updateProgress() {
    const total = 4;
    const completed = [1,2,3,4].reduce((acc, n) => acc + (stepDone[n] ? 1 : 0), 0);
    const pct = Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressLabel) progressLabel.textContent = `Step ${completed} of ${total}`;
  }
  let isWalletConnected = false;
  // Theme toggle
  (function initTheme(){
    try {
      const saved = localStorage.getItem('ui:theme') || 'light';
      if (saved === 'dark') document.body.classList.add('dark');
      if (themeToggle) themeToggle.checked = saved === 'dark';
    } catch {}
    if (themeToggle) {
      themeToggle.onchange = () => {
        const dark = !!themeToggle.checked;
        document.body.classList.toggle('dark', dark);
        try { localStorage.setItem('ui:theme', dark ? 'dark' : 'light'); } catch {}
      };
    }
  })();

  // Step progress helpers
  function setStepComplete(stepNum, done = true) {
    const el = stepNum === 1 ? step1 : stepNum === 2 ? step2 : stepNum === 3 ? step3 : step4;
    if (!el) return;
    el.style.display = done ? 'inline' : 'none';
    stepDone[stepNum] = !!done;
    updateProgress();
  }
  // Initialize Step 1 as selected by default
  setStepComplete(1, true);
  updateProgress();

  // Tips toggle
  if (toggleTipsBtn && tipBox) {
    toggleTipsBtn.onclick = () => {
      const shown = tipBox.style.display !== 'none';
      tipBox.style.display = shown ? 'none' : 'block';
      toggleTipsBtn.textContent = shown ? 'Show Tips' : 'Hide Tips';
    };
  }

  function updateNetworkStatus() {
    if (!networkStatus) return;
    const chainName = NETWORKS[selectedNetworkKey]?.params?.chainName || 'Selected Network';
    const modeLabel = currentMode === 'simulation' ? 'Local' : 'Testnet';
    networkStatus.textContent = `🌐 Selected: ${chainName} (${modeLabel})`;
  }
  updateNetworkStatus();
  // Edit Mode toggle
  if (editToggle && editor) {
    const applyEditState = () => {
      const on = !!editToggle.checked;
      editor.readOnly = !on;
      editor.style.background = on ? '#f9fafb' : '#f3f4f6';
    };
    editToggle.onchange = applyEditState;
    applyEditState();
  }

  // Auto-resize the Solidity editor to show as much code as possible
  function sizeEditorToContent() {
    if (!editor) return;
    const max = Math.max(380, Math.floor(window.innerHeight * 0.70));
    const min = Math.max(220, Math.floor(window.innerHeight * 0.34));
    editor.style.height = 'auto';
    const desired = Math.min(max, editor.scrollHeight + 8);
    editor.style.height = Math.max(min, desired) + 'px';
    editor.style.overflowY = editor.scrollHeight > desired ? 'auto' : 'hidden';
  }
  if (editor) {
    sizeEditorToContent();
    editor.addEventListener('input', sizeEditorToContent);
    window.addEventListener('resize', sizeEditorToContent);
    // In case fonts load later and change scrollHeight
    setTimeout(sizeEditorToContent, 60);
  }

  // Worker-based Solidity compilation (avoids main-thread WASM limits)
  let solcWorker;
  function getSolcWorker() {
    if (!solcWorker) {
      solcWorker = new Worker('solc-worker.js');
    }
    return solcWorker;
  }

  async function compileContractFromEditor() {
    const source = (editor?.value || '').trim();
    if (!source) throw new Error('Contract source is empty');
    const worker = getSolcWorker();
    const errorsBox = document.getElementById('compileErrors');
    if (errorsBox) { errorsBox.style.display = 'none'; errorsBox.innerText = ''; }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (errorsBox) { errorsBox.style.display = 'block'; errorsBox.innerText = 'Compiler timeout.'; }
        reject(new Error('Compiler timeout'));
      }, 20000);
      const onMessage = (ev) => {
        const data = ev.data || {};
        worker.removeEventListener('message', onMessage);
        clearTimeout(timeout);
        if (data.ok) {
          if (errorsBox) { errorsBox.style.display = 'none'; errorsBox.innerText = ''; }
          resolve({ abi: data.abi, bytecode: data.bytecode });
        } else {
          const msg = data.error || 'Compilation failed';
          if (errorsBox) { errorsBox.style.display = 'block'; errorsBox.innerText = msg; }
          reject(new Error(msg));
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({ source, filename: 'SimpleStorage.sol' });
    });
  }

  // Extract initial message text from the editor source
  function parseInitialMessageFromSource(src) {
    if (!src) return null;
    const m = src.match(/string\s+private\s+message\s*=\s*"([^"]*)"/);
    return m ? m[1] : null;
  }

  // Try compiling in-browser; if it fails, fall back to local artifact
  async function getAbiBytecodeWithFallback() {
    try {
      const res = await compileContractFromEditor();
      return { ...res, usedFallback: false };
    } catch (e) {
      try {
        showNotification('Compiler error. Using fallback artifact to deploy.', 'info');
        const resp = await fetch('artifacts/SimpleStorage.json');
        const json = await resp.json();
        if (!json?.abi || !json?.bytecode) throw e;
        return { abi: json.abi, bytecode: json.bytecode, usedFallback: true };
      } catch (inner) {
        // Propagate the original compile error when artifact is unavailable
        throw e;
      }
    }
  }
  async function isContractAddress(address) {
    try {
      const code = await provider.getCode(address);
      return !!code && code !== '0x' && code !== '0x0';
    } catch {
      return false;
    }
  }

  // Load default testnet address from config.json (optional)
  (async () => {
    try {
      const res = await fetch('config.json');
      if (res.ok) {
        const cfg = await res.json();
        defaultTestnetAddress = (cfg?.testnetContractAddress || '').trim();
      }
    } catch {}
  })();

  function updateActionButtons() {
    const disabled = !contract;
    if (setBtn) setBtn.disabled = disabled;
    if (getBtn) getBtn.disabled = disabled;
  }

  async function ensureContractConnectedOrPrompt() {
    if (contract) return true;
    if (currentMode !== 'testnet') return !!contract;
    if (!signer) {
      showNotification('Connect MetaMask first.', 'info');
      return false;
    }
    const val = (window.prompt('Paste Hoodi contract address:') || '').trim();
    if (!val) { showNotification('No address entered.', 'error'); return false; }
    try {
      if (!ethers.isAddress(val)) throw new Error('Invalid address');
      deployedAddress = val;
      contract = new ethers.Contract(deployedAddress, CONTRACT_ABI, signer);
      updateContractAddress(deployedAddress, 'testnet');
      showNotification('Connected to testnet contract.', 'success');
      refreshUI();
      updateActionButtons();
      return true;
    } catch (e) {
      contract = undefined;
      updateContractAddress('', 'testnet');
      showNotification('Invalid address or connection issue.', 'error');
      refreshUI();
      updateActionButtons();
      return false;
    }
  }

  function refreshUI() {
    if (currentMode === 'testnet') {
      if (networkSelectRow) networkSelectRow.style.display = 'block';
    } else {
      if (networkSelectRow) networkSelectRow.style.display = 'none';
    }
    updateActionButtons();
  }

  async function autoDeployTestnetContract() {
    try {
      const { abi, bytecode, usedFallback } = await getAbiBytecodeWithFallback();
      const factory = new ethers.ContractFactory(abi, bytecode, signer);
      showNotification('Deploying contract to Hoodi... Approve in MetaMask.', 'info');
      const deployed = await factory.deploy();
      await deployed.waitForDeployment();
      const addr = await deployed.getAddress();
      deployedAddress = addr;
      contract = new ethers.Contract(deployedAddress, abi, signer);
      updateContractAddress(deployedAddress, 'testnet');
      setExplorerLinks({ address: deployedAddress });
      try { localStorage.setItem(`${selectedNetworkKey}:testnet:contract`, deployedAddress); } catch {}
      showNotification('Contract deployed to Hoodi!', 'success');
      refreshUI();
      updateActionButtons();
      // If we used fallback artifacts, apply the editor's initial message via a transaction
      try {
        if (usedFallback) {
          const initText = parseInitialMessageFromSource(editor?.value || '');
          if (initText != null) {
            const tx = await contract.setMessage(initText);
            await tx.wait();
            showNotification('Applied your editor message to the contract.', 'success');
          }
        }
      } catch {}
      await fetchAndDisplayMessage();
    } catch (err) {
      const msg = err?.message || String(err);
      const lower = msg.toLowerCase();
      if (lower.includes('insufficient funds')) {
        showNotification('Insufficient testnet funds. Click “Fund Testnet”, then retry.', 'error');
      } else if (lower.includes('user rejected') || lower.includes('denied')) {
        showNotification('Transaction rejected in wallet. Please approve the deploy.', 'error');
      } else if (lower.includes('network') && lower.includes('chain')) {
        showNotification('Wrong network in MetaMask. Switch to the selected testnet.', 'error');
      } else if (lower.includes('compile')) {
        showNotification('Compilation failed. Fix code in editor and retry.', 'error');
      } else {
        showNotification('Auto-deploy failed: ' + msg, 'error');
      }
      refreshUI();
      updateActionButtons();
    }
  }

  networkModeSelect.onchange = () => {
    currentMode = networkModeSelect.value;
    showNotification(`Mode switched to ${currentMode === 'simulation' ? 'Simulation' : 'Testnet'} Mode.`);
    updateContractAddress("", currentMode);
    const wa = document.getElementById('walletAddress');
    wa.innerText = "";
    wa.classList.remove('connected');
    contract = undefined;
    isWalletConnected = false;
    const faucet = document.getElementById('faucetSection');
    if (faucet) faucet.style.display = currentMode === 'testnet' ? 'block' : 'none';
    refreshUI();
    // Update step badges
    setStepComplete(1, true);
    setStepComplete(2, currentMode === 'simulation');
    setStepComplete(3, false);
    setStepComplete(4, false);
    updateNetworkStatus();
  };

  networkSelect.onchange = () => {
    selectedNetworkKey = networkSelect.value;
    setExplorerLinks({ address: deployedAddress });
    updateFaucetLink();
    const deployBtnText = document.getElementById('deployButton');
    const chainName = NETWORKS[selectedNetworkKey]?.params?.chainName || 'Selected Network';
    if (deployBtnText) deployBtnText.textContent = `Step 4: Deploy Contract to ${chainName}`;
    setStepComplete(3, true);
    updateNetworkStatus();
  };

  function celebrateDeploy() {
    try {
      const d = document.getElementById('deployButton');
      if (d) {
        d.classList.remove('glow-once');
        void d.offsetWidth; // restart animation
        d.classList.add('glow-once');
        setTimeout(() => d.classList.remove('glow-once'), 1000);
      }
      const addrBox = document.getElementById('contractAddressSection');
      if (addrBox) {
        addrBox.classList.add('fade-in');
        setTimeout(() => addrBox.classList.remove('fade-in'), 800);
      }
    } catch {}
  }

  const copyBtn = document.getElementById('copyContractBtn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        const text = document.getElementById('sampleContract').value || '';
        await navigator.clipboard.writeText(text);
        showNotification('Contract copied to clipboard.', 'success');
      } catch {
        showNotification('Copy failed. Select and copy manually.', 'error');
      }
    };
  }

  const resetBtn = document.getElementById('resetContractBtn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      const textarea = document.getElementById('sampleContract');
      textarea.value = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract SimpleStorage {\n    string private message = \"Hello\";\n\n    function setMessage(string memory _message) public {\n        message = _message;\n    }\n\n    function getMessage() public view returns (string memory) {\n        return message;\n    }\n}`;
      showNotification('Sample contract reset.', 'success');
    };
  }

  // Advanced Editor button removed from UI

  if (addrInput) {
    addrInput.oninput = async () => {
      refreshUI();
      try {
        if (currentMode === 'testnet' && signer) {
          const val = (addrInput.value || '').trim();
          if (val && ethers.isAddress(val)) {
            deployedAddress = val;
            if (await isContractAddress(deployedAddress)) {
              contract = new ethers.Contract(deployedAddress, CONTRACT_ABI, signer);
              updateContractAddress(deployedAddress, 'testnet');
              showNotification('Contract address set.', 'success');
            } else {
              contract = undefined;
              updateContractAddress('', 'testnet');
              showNotification('That address is a wallet (not a contract).', 'error');
            }
            try { localStorage.setItem(`${selectedNetworkKey}:testnet:contract`, deployedAddress); } catch {}
            if (typeof testnetSection !== 'undefined' && testnetSection) testnetSection.style.display = 'none';
          } else {
            contract = undefined;
            updateContractAddress('', 'testnet');
          }
          updateActionButtons();
        }
      } catch (e) {
        contract = undefined;
        updateActionButtons();
        showNotification('Invalid address or connection issue.', 'error');
      }
    };
  }
  refreshUI();
  // Show or hide faucet in initial mode
  const faucetInit = document.getElementById('faucetSection');
  if (faucetInit) faucetInit.style.display = currentMode === 'testnet' ? 'block' : 'none';

  // Deploy Smart Contract from editor (MetaMask on testnet or local node)
  const deployBtnEl = document.getElementById('deployButton');
  if (deployBtnEl) deployBtnEl.onclick = async () => {
    try {
      // button spinner
      deployBtnEl.disabled = true;
      const prevText = deployBtnEl.textContent;
      deployBtnEl.textContent = 'Deploying… ⏳';
      showNotification('Preparing deployment...', 'info');
      const { abi, bytecode, usedFallback } = await getAbiBytecodeWithFallback();

      if (currentMode === 'testnet') {
        if (!window.ethereum) return showNotification('MetaMask not found.', 'error');
        provider = new ethers.BrowserProvider(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        signer = await provider.getSigner();
        const onNet = await ensureSelectedNetwork(provider);
        if (!onNet) return;

        const factory = new ethers.ContractFactory(abi, bytecode, signer);
        const deployed = await factory.deploy();
        showNotification('Deploying contract... Approve in MetaMask.', 'info');
        await deployed.waitForDeployment();
        const addr = await deployed.getAddress();
        deployedAddress = addr;
        updateContractAddress(deployedAddress, 'testnet');
        const addrEl = document.getElementById('contractAddressInput');
        if (addrEl) addrEl.value = deployedAddress;
        contract = new ethers.Contract(deployedAddress, abi, signer);
        const chainName = NETWORKS[selectedNetworkKey]?.params?.chainName || 'Selected Network';
        showNotification('Contract Deployed Successfully 🚀', 'success');
        celebrateDeploy();
        setExplorerLinks({ address: deployedAddress });
        try { localStorage.setItem(`${selectedNetworkKey}:testnet:contract`, deployedAddress); } catch {}
      } else {
        provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        let localSigner;
        try {
          const accounts = await provider.listAccounts();
          localSigner = provider.getSigner(accounts[0] || 0);
        } catch {
          const devPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
          localSigner = new ethers.Wallet(devPrivateKey, provider);
      }
      signer = localSigner;
      const factory = new ethers.ContractFactory(abi, bytecode, signer);
      const deployed = await factory.deploy();
      showNotification('Deploying contract to local node...', 'info');
      await deployed.waitForDeployment();
      const addr = await deployed.getAddress();
      deployedAddress = addr;
      updateContractAddress(deployedAddress, 'simulation');
      contract = new ethers.Contract(deployedAddress, abi, signer);
      showNotification('Contract Deployed Successfully 🚀', 'success');
      celebrateDeploy();
      try { localStorage.setItem('local:contract', deployedAddress); } catch {}
      }
      updateActionButtons();
      setStepComplete(4, true);
      // If we used fallback artifacts, apply the editor's initial message via a transaction
      try {
        if (usedFallback) {
          const initText = parseInitialMessageFromSource(editor?.value || '');
          if (initText != null) {
            const tx = await contract.setMessage(initText);
            await tx.wait();
            showNotification('Applied your editor message to the contract.', 'success');
          }
        }
      } catch {}
      await fetchAndDisplayMessage();
    } catch (err) {
      const msg = err?.message || String(err);
      const lower = msg.toLowerCase();
      if (lower.includes('insufficient funds')) {
        showNotification('Transaction failed: insufficient testnet funds. Click “Fund Testnet”.', 'error');
      } else if (lower.includes('user rejected') || lower.includes('denied')) {
        showNotification('Transaction rejected in wallet. Please approve the deploy.', 'error');
      } else if (lower.includes('compile')) {
        showNotification('Compilation failed. Check the code above and retry.', 'error');
      } else if (lower.includes('network') && lower.includes('chain')) {
        showNotification('Wrong network in MetaMask. Switch to the selected testnet.', 'error');
      } else {
        showNotification('Transaction Failed: ' + msg, 'error');
      }
      console.error('Deploy error:', msg);
      updateActionButtons();
    }
    finally {
      // restore button
      if (deployBtnEl) {
        deployBtnEl.disabled = false;
        const chainName = NETWORKS[selectedNetworkKey]?.params?.chainName || 'Selected Network';
        deployBtnEl.textContent = `Step 4: Deploy Contract to ${chainName}`;
      }
    }
  };

  // Faucet helper
  function faucetUrlFor(key) {
    switch (key) {
      case 'hoodi': return 'https://hoodi-faucet.pk910.de';
      case 'sepolia': return 'https://faucetlink.to/ethereum/sepolia';
      case 'amoy': return 'https://faucet.polygon.technology/';
      case 'bsctest': return 'https://testnet.bnbchain.org/faucet-smart';
      case 'fuji': return 'https://faucet.avax.network/';
      case 'chiado': return 'https://faucet.chiadochain.net/';
      default: return '';
    }
  }

  // Initialize deploy button label with current network name
  (function initDeployLabel(){
    const btn = document.getElementById('deployButton');
    const chainName = NETWORKS[selectedNetworkKey]?.params?.chainName || 'Selected Network';
    if (btn) btn.textContent = `Step 4: Deploy Contract to ${chainName}`;
  })();
  function updateFaucetLink() {
    const btn = document.getElementById('fundTestnetBtn');
    const hint = document.getElementById('faucetHint');
    if (!btn || !hint) return;
    const url = faucetUrlFor(selectedNetworkKey);
    btn.disabled = !url;
    hint.innerText = url ? 'Opens the faucet for the selected network.' : 'No faucet available for this network.';
  }
  updateFaucetLink();
  const fundBtn = document.getElementById('fundTestnetBtn');
  if (fundBtn) {
    fundBtn.onclick = () => {
      const url = faucetUrlFor(selectedNetworkKey);
      if (!url) return showNotification('No faucet available for this network.', 'error');
      window.open(url, '_blank', 'noopener');
      showNotification('Opening faucet in a new tab.', 'info');
    };
  }

  document.getElementById('connectButton').onclick = async () => {
    if (currentMode === 'simulation') {
      showNotification('Simulation mode does not require MetaMask.', 'info');
      const waSim = document.getElementById('walletAddress');
      waSim.innerText = 'Connected: Local Hardhat Node';
      waSim.classList.add('connected');
      try {
        provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        let localSigner;
        try {
          const accounts = await provider.listAccounts();
          localSigner = provider.getSigner(accounts[0] || 0);
        } catch {
          const devPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
          localSigner = new ethers.Wallet(devPrivateKey, provider);
        }
        signer = localSigner;
        // If a local address was saved, connect to it
        try {
          const saved = localStorage.getItem('local:contract') || '';
          if (saved && ethers.isAddress(saved)) {
            deployedAddress = saved;
            contract = new ethers.Contract(deployedAddress, CONTRACT_ABI, signer);
            updateContractAddress(deployedAddress, 'simulation');
            showNotification('Connected to saved local contract.', 'success');
          }
        } catch {}
        showNotification('Connected to local node.', 'success');
      } catch (err) {
        showNotification('Simulation connection failed.', 'error');
      }
      updateActionButtons();
    } else {
      if (window.ethereum) {
        try {
          provider = new ethers.BrowserProvider(window.ethereum);
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          signer = await provider.getSigner();
          const addr = await signer.getAddress();
          // Auto-detect MetaMask network and sync the selector
          try {
            const net = await provider.getNetwork();
            const cid = Number(net.chainId ?? 0n);
            const match = Object.values(NETWORKS).find(n => n.decimalChainId === cid);
            if (match) {
              selectedNetworkKey = match.key;
              networkSelect.value = selectedNetworkKey;
              showNotification(`Detected MetaMask network: ${match.params.chainName}`, 'success');
            } else {
              showNotification('Unsupported network detected. Switch to a supported testnet.', 'error');
            }
          } catch {}
          const chainName = NETWORKS[selectedNetworkKey]?.params?.chainName || 'Selected Network';
          const wa = document.getElementById('walletAddress');
          wa.innerText = `Connected: ${addr} on ${chainName}`;
          wa.classList.add('connected');
          setStepComplete(2, true);

      // Ensure MetaMask is on the selected network
      const onNet = await ensureSelectedNetwork(provider);
      if (!onNet) return;
      setStepComplete(3, true);
      updateNetworkStatus();

          // Always deploy a fresh contract from the editor for clarity
          isWalletConnected = true;
          contract = undefined;
          updateContractAddress('', 'testnet');
          await autoDeployTestnetContract();
          refreshUI();
          updateActionButtons();
          await fetchAndDisplayMessage();
          setStepComplete(4, true);
        } catch (err) {
          showNotification('MetaMask connection failed: ' + (err?.message || String(err)), 'error');
          updateActionButtons();
          isWalletConnected = false;
          refreshUI();
        }
      } else {
        showNotification('MetaMask not found.', 'error');
      }
    }
  };

  // Removed Connect Contract Address button and its logic

  async function fetchAndDisplayMessage() {
    if (!contract) return;
    try {
      const msg = await contract.getMessage();
      const md = document.getElementById('messageDisplay');
      md.style.display = 'block';
      md.innerText = `Stored message: ${msg}`;
      showNotification('Message retrieved!', 'success');
    } catch (err) {
      const md = document.getElementById('messageDisplay');
      md.style.display = 'none';
      md.innerText = '';
      showNotification('Error: ' + (err?.message || String(err)), 'error');
    }
  }

  const setMessageBtnEl = document.getElementById('setMessageButton');
  if (setMessageBtnEl) setMessageBtnEl.onclick = async () => {
    if (!contract) return showNotification('Contract not connected.', 'error');
    const newMsgInput = document.getElementById('newMessage');
    const newMsg = newMsgInput ? newMsgInput.value : '';
    let prevText = setMessageBtnEl.textContent;
    try {
      // spinner
      setMessageBtnEl.disabled = true;
      setMessageBtnEl.textContent = 'Updating… ⏳';
      let tx;
      if (currentMode === 'simulation') {
        tx = await contract.setMessage(newMsg);
        showNotification('Transaction sent. Waiting for confirmation...', 'info');
        const receipt = await tx.wait();
        setExplorerLinks({ txHash: tx.hash, address: deployedAddress });
      } else {
        tx = await contract.connect(signer).setMessage(newMsg);
        showNotification('Transaction sent. Waiting for confirmation...', 'info');
        const receipt = await tx.wait();
        setExplorerLinks({ txHash: tx.hash, address: deployedAddress });
      }
      showNotification('Transaction Successful ✅', 'success');
      document.getElementById('status').innerText = 'Message updated!';
      await fetchAndDisplayMessage();
    } catch (err) {
      showNotification('Transaction Failed.', 'error');
      console.error('SetMessage error:', err?.message || err);
    } finally {
      setMessageBtnEl.disabled = false;
      setMessageBtnEl.textContent = prevText || 'Update Message';
    }
  };

  // Refresh link removed from UI per request
};