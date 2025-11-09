/*
 Multi Network Smart Contract Studio – TabbedApp.tsx
 Purpose: Hosts the three main tabs and manages switching between them.
 Quick overview:
 - Tab: Smart Contract Playground – compile/deploy a simple contract in-browser.
 - Tab: ERC20 Token Creator – configure, deploy, and mint ERC-20 tokens.
 - Tab: ERC721 NFT Creator – deploy a minimal NFT contract and mint tokens.
 Notes:
 - Keeps state minimal; individual tabs manage their own logic and network.
 - Beginners can use this as a hub to explore each module.
*/
import { useState } from 'react';
import './index.css';
import Playground from './Playground';
import ERC20TokenCreator from './ERC20TokenCreator';
import ERC721TokenCreator from './ERC721TokenCreator';

type TabType = 'playground' | 'token-creator' | 'nft-creator';

export default function TabbedApp() {
  const [activeTab, setActiveTab] = useState<TabType>('playground');
  const [dark, setDark] = useState(false);

  // Apply dark mode to document root
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header with Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Title */}
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-brand-gradient">
                Multi Network Smart Contract Studio
              </h1>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center space-x-1">
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'playground'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab('playground')}
              >
                Smart Contract Playground
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'token-creator'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab('token-creator')}
              >
                ERC20 Token Creator
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'nft-creator'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab('nft-creator')}
              >
                ERC721 NFT Creator
              </button>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex items-center space-x-2">
              <button
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setDark(!dark)}
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'playground' && <Playground />}
        {activeTab === 'token-creator' && <ERC20TokenCreator dark={dark} />}
        {activeTab === 'nft-creator' && <ERC721TokenCreator dark={dark} />}
      </div>
    </div>
  );
}