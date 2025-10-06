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
const HOODI_CHAIN_ID = 560048; // Ethereum Hoodi chain id
const HOODI_CHAIN_ID_HEX = '0x88bb0'; // 560048 in hex
const HOODI_PARAMS = {
  chainId: HOODI_CHAIN_ID_HEX,
  chainName: 'Ethereum Hoodi',
  nativeCurrency: { name: 'HodETH', symbol: 'HodETH', decimals: 18 },
  rpcUrls: ['https://ethereum-hoodi-rpc.publicnode.com'],
  blockExplorerUrls: ['https://explorer.pk910.de/?chain=ethereum-hoodi'],
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
  notification.innerText = message;
  notification.style.color = type === "success" ? "#059669" : type === "error" ? "#dc2626" : "#2563eb";
  notification.style.fontWeight = "600";
  setTimeout(() => { notification.innerText = ""; }, 4000);
}

function updateContractAddress(address, mode) {
  const section = document.getElementById('contractAddressSection');
  if (address) {
    section.innerText = `Contract deployed at: ${address} (${mode === 'simulation' ? 'Simulation' : 'Testnet'})`;
  } else {
    section.innerText = "";
  }
}

window.onload = () => {
  const networkModeSelect = document.getElementById('networkMode');
  let currentMode = networkModeSelect.value;
  const testnetSection = document.getElementById('testnetContractSection');
  const addrInput = document.getElementById('contractAddressInput');
  const deployBtn = document.getElementById('deployButton');
  const hint = document.getElementById('contractHint');
  const setBtn = document.getElementById('setMessageButton');
  const getBtn = document.getElementById('getMessageButton');
  let isWalletConnected = false;
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
    setBtn.disabled = disabled;
    getBtn.disabled = disabled;
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
    // Hide testnet address section for a simulation-like UI
    testnetSection.style.display = 'none';
    // Always hide deploy button in Testnet (MetaMask) mode
    deployBtn.style.display = 'none';
    // Remove hint text for a cleaner Testnet experience
    hint.innerText = '';
    updateActionButtons();
  }

  async function autoDeployTestnetContract() {
    try {
      const res = await fetch('artifacts/SimpleStorage.json');
      if (!res.ok) throw new Error('Artifact not found.');
      const artifact = await res.json();
      const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
      showNotification('Deploying contract to Hoodi... Approve in MetaMask.', 'info');
      const deployed = await factory.deploy();
      await deployed.waitForDeployment();
      const addr = await deployed.getAddress();
      deployedAddress = addr;
      contract = new ethers.Contract(deployedAddress, CONTRACT_ABI, signer);
      updateContractAddress(deployedAddress, 'testnet');
      try { localStorage.setItem('hoodi:testnet:contract', deployedAddress); } catch {}
      showNotification('Contract deployed to Hoodi!', 'success');
      refreshUI();
      updateActionButtons();
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('insufficient funds')) {
        showNotification('Insufficient HodETH to deploy. Please fund wallet.', 'error');
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
    document.getElementById('walletAddress').innerText = "";
    contract = undefined;
    isWalletConnected = false;
    refreshUI();
  };

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
          try { localStorage.setItem('hoodi:testnet:contract', deployedAddress); } catch {}
          testnetSection.style.display = 'none';
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
  refreshUI();

  // Deploy SimpleStorage directly to Hoodi using MetaMask
  document.getElementById('deployButton').onclick = async () => {
    if (currentMode !== 'testnet') {
      return showNotification('Switch to Testnet Mode to deploy.', 'info');
    }
    if (!window.ethereum) {
      return showNotification('MetaMask not found.', 'error');
    }
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      signer = await provider.getSigner();

      const onHoodi = await ensureHoodiNetwork(provider);
      if (!onHoodi) return;

      showNotification('Preparing deployment...', 'info');
      const res = await fetch('artifacts/SimpleStorage.json');
      if (!res.ok) throw new Error('Artifact not found.');
      const artifact = await res.json();

      const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
      const deployed = await factory.deploy();
      showNotification('Deploying contract... Approve in MetaMask.', 'info');
      await deployed.waitForDeployment();
      const addr = await deployed.getAddress();

      deployedAddress = addr;
      updateContractAddress(deployedAddress, 'testnet');
      document.getElementById('contractAddressInput').value = deployedAddress;
      contract = new ethers.Contract(deployedAddress, CONTRACT_ABI, signer);
      showNotification('Contract deployed to Hoodi!', 'success');
      updateActionButtons();
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('insufficient funds')) {
        showNotification('Insufficient HodETH. Please fund your wallet.', 'error');
      } else {
        showNotification('Deploy failed: ' + msg, 'error');
      }
      updateActionButtons();
    }
  };

  document.getElementById('connectButton').onclick = async () => {
    if (currentMode === 'simulation') {
      showNotification('Simulation mode does not require MetaMask.', 'info');
      document.getElementById('walletAddress').innerText = 'Simulation Mode (Hardhat Local Node)';
      // Connect directly to the already deployed local contract
      try {
        deployedAddress = CONTRACT_ADDRESS;
        updateContractAddress(deployedAddress, 'simulation');
        provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        // Use Hardhat local Account #0 for development only
        const devPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const localSigner = new ethers.Wallet(devPrivateKey, provider);
        contract = new ethers.Contract(deployedAddress, CONTRACT_ABI, localSigner);
        showNotification('Connected to local node and contract.', 'success');
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
          document.getElementById('walletAddress').innerText = `Connected: ${addr}`;

          // Ensure MetaMask is on the Hoodi network
          const onHoodi = await ensureHoodiNetwork(provider);
          if (!onHoodi) return;

          // Connect to an already deployed testnet contract
          isWalletConnected = true;
          // Try to auto-load a previously saved address from localStorage
          try {
            const saved = localStorage.getItem('hoodi:testnet:contract') || '';
            if (saved && ethers.isAddress(saved)) {
              deployedAddress = saved;
              if (await isContractAddress(deployedAddress)) {
                contract = new ethers.Contract(deployedAddress, CONTRACT_ABI, signer);
                updateContractAddress(deployedAddress, 'testnet');
                showNotification('Connected to saved testnet contract.', 'success');
              } else {
                showNotification('Saved address is not a contract. Deploying...', 'error');
                contract = undefined;
                updateContractAddress('', 'testnet');
                await autoDeployTestnetContract();
              }
            } else if (defaultTestnetAddress && ethers.isAddress(defaultTestnetAddress)) {
              deployedAddress = defaultTestnetAddress;
              if (await isContractAddress(deployedAddress)) {
                contract = new ethers.Contract(deployedAddress, CONTRACT_ABI, signer);
                updateContractAddress(deployedAddress, 'testnet');
                showNotification('Connected to default testnet contract.', 'success');
              } else {
                showNotification('Default address is not a contract. Deploying...', 'error');
                contract = undefined;
                updateContractAddress('', 'testnet');
                await autoDeployTestnetContract();
              }
            } else {
              contract = undefined;
              updateContractAddress('', 'testnet');
              // If nothing is saved or configured, auto-deploy a fresh contract once
              await autoDeployTestnetContract();
            }
          } catch {}
          refreshUI();
          updateActionButtons();
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

  document.getElementById('setMessageButton').onclick = async () => {
    if (!contract) return showNotification('Contract not connected.', 'error');
    const newMsg = document.getElementById('newMessage').value;
    try {
      let tx;
      if (currentMode === 'simulation') {
        tx = await contract.setMessage(newMsg);
        showNotification('Transaction sent. Waiting for confirmation...', 'info');
        await tx.wait();
      } else {
        tx = await contract.connect(signer).setMessage(newMsg);
        showNotification('Transaction sent. Waiting for confirmation...', 'info');
        await tx.wait();
      }
      showNotification('Message updated!', 'success');
      document.getElementById('status').innerText = 'Message updated!';
    } catch (err) {
      showNotification('Error: ' + err.message, 'error');
    }
  };

  document.getElementById('getMessageButton').onclick = async () => {
    if (!contract) return showNotification('Contract not connected.', 'error');
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
      showNotification('Error: ' + err.message, 'error');
    }
  };
};