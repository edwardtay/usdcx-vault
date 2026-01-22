'use client';

import { useState, useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import {
  BRIDGE_CONFIG,
  getEthChain,
  getEthUsdcBalance,
  getUsdcAllowance,
  getBridgeFee,
  approveUsdc,
  bridgeToStacks,
  formatUsdc,
  parseUsdc,
  getEthExplorerUrl,
  NETWORK,
} from '@/lib/bridge';

interface BridgeProps {
  stacksAddress?: string;
  onBridgeComplete?: (txHash: string) => void;
}

type BridgeStep = 'connect' | 'input' | 'approve' | 'bridge' | 'pending' | 'complete';

export function Bridge({ stacksAddress, onBridgeComplete }: BridgeProps) {
  const [ethAddress, setEthAddress] = useState<`0x${string}` | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  const [amount, setAmount] = useState('');
  const [bridgeFee, setBridgeFee] = useState<bigint>(BigInt(0));
  const [step, setStep] = useState<BridgeStep>('connect');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if MetaMask is available
  const hasEthereum = typeof window !== 'undefined' && window.ethereum;

  // Connect Ethereum wallet
  async function connectEthWallet() {
    if (!hasEthereum) {
      setError('Please install MetaMask to bridge from Ethereum');
      return;
    }

    try {
      setLoading(true);
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (accounts.length > 0) {
        setEthAddress(accounts[0] as `0x${string}`);
        setStep('input');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }

  // Load balances when connected
  useEffect(() => {
    async function loadBalances() {
      if (!ethAddress) return;

      try {
        const balance = await getEthUsdcBalance(ethAddress);
        setUsdcBalance(balance);

        const allow = await getUsdcAllowance(ethAddress);
        setAllowance(allow);
      } catch (err) {
        console.error('Error loading balances:', err);
      }
    }

    loadBalances();
  }, [ethAddress]);

  // Update fee estimate when amount changes
  useEffect(() => {
    async function updateFee() {
      if (!amount || parseFloat(amount) <= 0) {
        setBridgeFee(BigInt(0));
        return;
      }

      try {
        const amountBigInt = parseUsdc(amount);
        const fee = await getBridgeFee(amountBigInt);
        setBridgeFee(fee);
      } catch (err) {
        console.error('Error getting fee:', err);
      }
    }

    updateFee();
  }, [amount]);

  // Get wallet client for transactions
  function getWalletClient() {
    if (!hasEthereum || !ethAddress) return null;

    return createWalletClient({
      account: ethAddress,
      chain: getEthChain(),
      transport: custom(window.ethereum!),
    });
  }

  // Approve USDC spending
  async function handleApprove() {
    const walletClient = getWalletClient();
    if (!walletClient) return;

    try {
      setLoading(true);
      setError(null);

      const amountBigInt = parseUsdc(amount);
      const hash = await approveUsdc(walletClient, amountBigInt);

      // Wait for approval confirmation
      setStep('approve');
      setTxHash(hash);

      // Poll for confirmation
      const checkApproval = setInterval(async () => {
        const newAllowance = await getUsdcAllowance(ethAddress!);
        if (newAllowance >= amountBigInt) {
          clearInterval(checkApproval);
          setAllowance(newAllowance);
          setStep('bridge');
          setTxHash(null);
        }
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Approval failed');
    } finally {
      setLoading(false);
    }
  }

  // Execute bridge transaction
  async function handleBridge() {
    const walletClient = getWalletClient();
    if (!walletClient || !stacksAddress) return;

    try {
      setLoading(true);
      setError(null);

      const amountBigInt = parseUsdc(amount);
      const maxFee = bridgeFee + (bridgeFee / BigInt(10)); // 10% buffer

      const hash = await bridgeToStacks(
        walletClient,
        amountBigInt,
        stacksAddress,
        maxFee
      );

      setTxHash(hash);
      setStep('pending');

      // Notify parent
      onBridgeComplete?.(hash);

    } catch (err: any) {
      setError(err.message || 'Bridge transaction failed');
    } finally {
      setLoading(false);
    }
  }

  // Check if amount needs approval
  const amountBigInt = amount ? parseUsdc(amount) : BigInt(0);
  const needsApproval = amountBigInt > allowance;

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-2xl p-6 border border-purple-500/30">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Bridge from Ethereum</h3>
          <p className="text-sm text-gray-400">USDC → USDCx via Circle xReserve</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Step: Connect Ethereum Wallet */}
      {step === 'connect' && (
        <div className="text-center py-6">
          <p className="text-gray-400 mb-4">
            Connect your Ethereum wallet to bridge USDC to Stacks
          </p>
          <button
            onClick={connectEthWallet}
            disabled={loading || !hasEthereum}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Connecting...' : !hasEthereum ? 'Install MetaMask' : 'Connect MetaMask'}
          </button>
        </div>
      )}

      {/* Step: Input Amount */}
      {(step === 'input' || step === 'bridge') && ethAddress && (
        <div className="space-y-4">
          {/* Connected Address */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Ethereum Wallet</span>
            <span className="text-purple-400 font-mono">
              {ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}
            </span>
          </div>

          {/* USDC Balance */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">USDC Balance</span>
            <span className="text-white">{formatUsdc(usdcBalance)} USDC</span>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Amount to Bridge</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="10"
                className="w-full bg-black/30 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={() => setAmount(formatUsdc(usdcBalance))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-purple-400 hover:text-purple-300"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-gray-500">Minimum: 10 USDC</p>
          </div>

          {/* Recipient */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Stacks Recipient</span>
            <span className="text-green-400 font-mono text-xs">
              {stacksAddress ? `${stacksAddress.slice(0, 8)}...${stacksAddress.slice(-6)}` : 'Connect Stacks wallet'}
            </span>
          </div>

          {/* Fee Estimate */}
          {bridgeFee > BigInt(0) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Bridge Fee</span>
              <span className="text-yellow-400">~{formatUsdc(bridgeFee)} USDC</span>
            </div>
          )}

          {/* You'll Receive */}
          {amountBigInt > BigInt(0) && (
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-gray-400">You'll Receive</span>
              <span className="text-green-400">
                ~{formatUsdc(amountBigInt - bridgeFee)} USDCx
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 space-y-3">
            {needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={loading || !amount || parseFloat(amount) < 10 || !stacksAddress}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
              >
                {loading ? 'Approving...' : `Approve ${amount || '0'} USDC`}
              </button>
            ) : (
              <button
                onClick={handleBridge}
                disabled={loading || !amount || parseFloat(amount) < 10 || !stacksAddress}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
              >
                {loading ? 'Bridging...' : 'Bridge to Stacks'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step: Approval Pending */}
      {step === 'approve' && txHash && (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 mx-auto border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-yellow-400 font-medium">Approving USDC...</p>
          <a
            href={getEthExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            View on Etherscan →
          </a>
        </div>
      )}

      {/* Step: Bridge Pending */}
      {step === 'pending' && txHash && (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 mx-auto border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-purple-400 font-medium">Bridge in Progress</p>
            <p className="text-sm text-gray-400 mt-1">
              Your USDC is being bridged via Circle xReserve.<br />
              This typically takes ~15 minutes.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <a
              href={getEthExplorerUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-purple-400 hover:text-purple-300"
            >
              View Ethereum TX →
            </a>
          </div>

          {/* Status Steps */}
          <div className="mt-6 text-left space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs">✓</div>
              <span className="text-green-400">USDC deposited to xReserve</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
                <span className="text-xs">2</span>
              </div>
              <span className="text-yellow-400">Waiting for attestation...</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-xs">3</div>
              <span className="text-gray-500">Minting USDCx on Stacks</span>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/20 rounded-xl">
        <p className="text-xs text-blue-300">
          <strong>Powered by Circle xReserve</strong><br />
          Your USDC is held 1:1 in Circle's audited xReserve contract.
          USDCx on Stacks is always fully backed.
        </p>
      </div>
    </div>
  );
}

