'use client';

import { useState } from 'react';
import { openContractCall } from '@stacks/connect';
import {
  getInstantWithdrawContractCallOptions,
  getRequestWithdrawalContractCallOptions,
  parseUSDCx,
  formatUSDCx,
  previewWithdraw,
  getExplorerUrl,
} from '@/lib/stacks';

interface WithdrawFormProps {
  userAddress: string | null;
  userShares: bigint;
  onSuccess: () => void;
  isPaused?: boolean;
}

export default function WithdrawForm({ userAddress, userShares, onSuccess, isPaused }: WithdrawFormProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [withdrawType, setWithdrawType] = useState<'request' | 'instant'>('request');
  const [previewAmount, setPreviewAmount] = useState<bigint>(BigInt(0));
  const [txId, setTxId] = useState<string | null>(null);

  const handleAmountChange = async (value: string) => {
    setAmount(value);
    if (value && parseFloat(value) > 0) {
      const sharesBigInt = parseUSDCx(value);
      const assets = await previewWithdraw(sharesBigInt);
      setPreviewAmount(assets);
    } else {
      setPreviewAmount(BigInt(0));
    }
  };

  const handleWithdraw = async () => {
    if (!userAddress || !amount || isPaused) return;

    setIsLoading(true);
    setTxId(null);

    try {
      const sharesBigInt = parseUSDCx(amount);

      if (withdrawType === 'instant') {
        // Calculate net amount after 1% fee
        const grossAmount = previewAmount;
        const fee = grossAmount / BigInt(100);
        const netAmount = grossAmount - fee;
        // Allow 0.5% slippage
        const minAmount = (netAmount * BigInt(995)) / BigInt(1000);

        const options = getInstantWithdrawContractCallOptions(sharesBigInt, minAmount);

        await openContractCall({
          ...options,
          onFinish: (data) => {
            console.log('Instant withdraw transaction:', data);
            setTxId(data.txId);
            setAmount('');
            setPreviewAmount(BigInt(0));
            setTimeout(onSuccess, 3000);
          },
          onCancel: () => {
            console.log('Transaction cancelled');
          },
        });
      } else {
        const options = getRequestWithdrawalContractCallOptions(sharesBigInt);

        await openContractCall({
          ...options,
          onFinish: (data) => {
            console.log('Withdrawal request transaction:', data);
            setTxId(data.txId);
            setAmount('');
            setPreviewAmount(BigInt(0));
            setTimeout(onSuccess, 3000);
          },
          onCancel: () => {
            console.log('Transaction cancelled');
          },
        });
      }
    } catch (error) {
      console.error('Withdraw error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setMaxAmount = () => {
    const maxAmount = Number(userShares) / 1_000_000;
    handleAmountChange(maxAmount.toString());
  };

  const instantFee = previewAmount / BigInt(100);
  const netAmount = withdrawType === 'instant' ? previewAmount - instantFee : previewAmount;
  const isDisabled = !userAddress || !amount || isLoading || isPaused || parseUSDCx(amount) > userShares;

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Withdraw</h3>

      {txId && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
          <p className="text-green-400 text-sm">
            Transaction submitted!{' '}
            <a
              href={getExplorerUrl(txId)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-green-300"
            >
              View on Explorer
            </a>
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Withdraw Type Toggle */}
        <div className="flex bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => setWithdrawType('request')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              withdrawType === 'request'
                ? 'bg-stacks-purple text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Standard (24h)
          </button>
          <button
            onClick={() => setWithdrawType('instant')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              withdrawType === 'instant'
                ? 'bg-stacks-purple text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Instant (1% fee)
          </button>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Shares</span>
            <span className="text-gray-400">
              Balance: {formatUSDCx(userShares)} vUSDCx
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-stacks-purple"
              disabled={!userAddress || isPaused}
            />
            <button
              onClick={setMaxAmount}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stacks-purple hover:text-purple-400"
              disabled={!userAddress || isPaused}
            >
              MAX
            </button>
          </div>
          {amount && parseUSDCx(amount) > userShares && (
            <p className="text-red-400 text-xs mt-1">Insufficient shares</p>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You will receive</span>
            <span className="text-white">
              ~{formatUSDCx(netAmount)} USDCx
            </span>
          </div>
          {withdrawType === 'instant' && previewAmount > BigInt(0) && (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Instant fee (1%)</span>
              <span className="text-yellow-400">-{formatUSDCx(instantFee)} USDCx</span>
            </div>
          )}
          {withdrawType === 'request' && (
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Cooldown period</span>
              <span className="text-gray-300">~24 hours (~144 blocks)</span>
            </div>
          )}
        </div>

        <button
          onClick={handleWithdraw}
          disabled={isDisabled}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : isPaused ? (
            'Vault Paused'
          ) : !userAddress ? (
            'Connect Wallet'
          ) : withdrawType === 'instant' ? (
            'Instant Withdraw'
          ) : (
            'Request Withdrawal'
          )}
        </button>

        {withdrawType === 'request' && (
          <p className="text-xs text-gray-500 text-center">
            After requesting, wait 24 hours then return to process your withdrawal.
          </p>
        )}
      </div>
    </div>
  );
}
