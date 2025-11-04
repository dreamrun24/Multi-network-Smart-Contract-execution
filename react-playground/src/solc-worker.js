// Web Worker to compile Solidity using solc-js without blocking the UI thread
/* eslint-disable no-restricted-globals */

// Attempt to load solc from multiple CDNs to avoid corporate/firewall blocks
const SOLC_URLS = [
  // Prefer locally hosted UMD wrapper first (works offline)
  '/solc-0.8.20.js',
  // Local soljson (binary); requires wrapper from above. Keep as backup.
  '/soljson-v0.8.20+commit.a1b79de6.js',
  // Public mirrors
  'https://binaries.soliditylang.org/bin/soljson-v0.8.20+commit.a1b79de6.js',
  'https://cdn.jsdelivr.net/npm/solc@0.8.20/solc.js',
  'https://unpkg.com/solc@0.8.20/solc.js'
];

function wrapSoljsonIfAvailable() {
  try {
    if (typeof solc !== 'undefined') return true;
    // If we loaded a bare soljson build, create a minimal wrapper
    if (typeof Module !== 'undefined' && typeof Module.cwrap === 'function') {
      const compileFn = Module.cwrap('solidity_compile', 'string', ['string']);
      // Expose the same API shape used by the app
      self.solc = { compile: (inputStr) => compileFn(inputStr) };
      return true;
    }
  } catch {}
  return false;
}

function ensureSolcLoaded() {
  if (typeof solc !== 'undefined') return true;
  for (const url of SOLC_URLS) {
    try {
      importScripts(url);
      if (typeof solc !== 'undefined' || wrapSoljsonIfAvailable()) return true;
    } catch (err) {
      // continue to next URL
    }
  }
  return typeof solc !== 'undefined' || wrapSoljsonIfAvailable();
}

self.onmessage = function (e) {
  if (!ensureSolcLoaded()) {
    self.postMessage({ ok: false, error: 'Failed to load solc compiler from CDNs' });
    return;
  }
  const source = (e.data && e.data.source) || '';
  const filename = (e.data && e.data.filename) || 'Contract.sol';
  const input = {
    language: 'Solidity',
    sources: {
      [filename]: { content: source }
    },
    settings: {
      optimizer: { enabled: false, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };
  try {
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const contracts = output.contracts && output.contracts[filename];
    if (!contracts) throw new Error('No contracts compiled');
    const names = Object.keys(contracts);
    if (!names.length) throw new Error('No contract found in source');
    const first = contracts[names[0]];
    const abi = first.abi;
    const bytecodeObj = first.evm && first.evm.bytecode && first.evm.bytecode.object;
    if (!abi || !bytecodeObj) throw new Error('Compilation failed to produce ABI/bytecode');
    const bytecode = bytecodeObj.startsWith('0x') ? bytecodeObj : ('0x' + bytecodeObj);
    self.postMessage({ ok: true, abi, bytecode });
  } catch (err) {
    self.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
  }
};