'use client';

import { useState } from 'react';
import { openContractCall } from '@stacks/connect';
import { PostConditionMode } from '@stacks/transactions';
import { USDCX_ADDRESS, USDCX_NAME, getNetwork } from '@/lib/stacks';

interface FaucetProps {
  userAddress: string | null;
  onSuccess: () => void;
}

export default function Faucet({ userAddress, onSuccess }: FaucetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleFaucet = async () => {
    if (!userAddress) return;

    setIsLoading(true);

    try {
      await openContractCall({
        contractAddress: USDCX_ADDRESS,
        contractName: USDCX_NAME,
        functionName: 'faucet',
        functionArgs: [],
        network: getNetwork(),
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Faucet transaction:', data);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
          onSuccess();
        },
        onCancel: () => {
          console.log('Transaction cancelled');
        },
      });
    } catch (error) {
      console.error('Faucet error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-usdc-blue/20 to-stacks-purple/20 rounded-xl p-6 border border-usdc-blue/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Need Test USDCx?</h3>
          <p className="text-sm text-gray-400">
            Get 10,000 USDCx from our testnet faucet
          </p>
        </div>
        <button
          onClick={handleFaucet}
          disabled={!userAddress || isLoading}
          className="px-6 py-3 bg-usdc-blue hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-all transform hover:scale-105"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Claiming...
            </span>
          ) : showSuccess ? (
            <span className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Claimed!
            </span>
          ) : (
            'Get USDCx'
          )}
        </button>
      </div>
    </div>
  );
}
