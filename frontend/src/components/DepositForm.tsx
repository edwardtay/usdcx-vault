'use client';

import { useState } from 'react';
import { openContractCall } from '@stacks/connect';
import {
  getDepositContractCallOptions,
  parseUSDCx,
  formatUSDCx,
  previewDeposit,
  getExplorerUrl,
} from '@/lib/stacks';

interface DepositFormProps {
  userAddress: string | null;
  userBalance: bigint;
  onSuccess: () => void;
  isPaused?: boolean;
}

export default function DepositForm({ userAddress, userBalance, onSuccess, isPaused }: DepositFormProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewShares, setPreviewShares] = useState<bigint>(BigInt(0));
  const [txId, setTxId] = useState<string | null>(null);

  const handleAmountChange = async (value: string) => {
    setAmount(value);
    if (value && parseFloat(value) > 0) {
      const amountBigInt = parseUSDCx(value);
      const shares = await previewDeposit(amountBigInt);
      setPreviewShares(shares);
    } else {
      setPreviewShares(BigInt(0));
    }
  };

  const handleDeposit = async () => {
    if (!userAddress || !amount || isPaused) return;

    setIsLoading(true);
    setTxId(null);

    try {
      const amountBigInt = parseUSDCx(amount);
      // Allow 0.5% slippage on shares
      const minShares = (previewShares * BigInt(995)) / BigInt(1000);

      const options = getDepositContractCallOptions(amountBigInt, minShares);

      await openContractCall({
        ...options,
        onFinish: (data) => {
          console.log('Deposit transaction:', data);
          setTxId(data.txId);
          setAmount('');
          setPreviewShares(BigInt(0));
          // Wait a bit then refresh
          setTimeout(onSuccess, 3000);
        },
        onCancel: () => {
          console.log('Transaction cancelled');
        },
      });
    } catch (error) {
      console.error('Deposit error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setMaxAmount = () => {
    const maxAmount = Number(userBalance) / 1_000_000;
    handleAmountChange(maxAmount.toString());
  };

  const isDisabled = !userAddress || !amount || isLoading || isPaused || parseUSDCx(amount) > userBalance;

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Deposit USDCx</h3>

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
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Amount</span>
            <span className="text-gray-400">
              Balance: {formatUSDCx(userBalance)} USDCx
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
          {amount && parseUSDCx(amount) > userBalance && (
            <p className="text-red-400 text-xs mt-1">Insufficient balance</p>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">You will receive</span>
            <span className="text-white">
              ~{formatUSDCx(previewShares)} vUSDCx
            </span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-gray-400">Exchange rate</span>
            <span className="text-gray-300">
              {previewShares > BigInt(0) && parseUSDCx(amount) > BigInt(0)
                ? `1 USDCx = ${(Number(previewShares) / Number(parseUSDCx(amount))).toFixed(6)} vUSDCx`
                : '1 USDCx = 1 vUSDCx'
              }
            </span>
          </div>
        </div>

        <button
          onClick={handleDeposit}
          disabled={isDisabled}
          className="w-full py-3 bg-stacks-purple hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors"
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
          ) : (
            'Deposit'
          )}
        </button>
      </div>
    </div>
  );
}
