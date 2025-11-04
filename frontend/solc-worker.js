// Web Worker to compile Solidity using solc-js without blocking the UI thread
// Loads solc wrapper and compiles the source sent from the main thread.

/* eslint-disable no-restricted-globals */

// Load solc-js in the worker. Using unpkg wrapper provides compile() API.
importScripts('https://unpkg.com/solc@0.8.20/solc.js');

self.onmessage = function (e) {
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