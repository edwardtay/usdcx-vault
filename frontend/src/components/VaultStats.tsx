'use client';

import { formatUSDCx } from '@/lib/stacks';

interface VaultStatsProps {
  totalAssets: number;
  totalShares: number;
  apy: number;
  sharePrice: number;
  isLoading?: boolean;
}

export default function VaultStats({ totalAssets, totalShares, apy, sharePrice, isLoading }: VaultStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-800 rounded-xl p-6 border border-gray-700 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-20 mb-2"></div>
            <div className="h-8 bg-gray-700 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <p className="text-gray-400 text-sm mb-1">Total Value Locked</p>
        <p className="text-2xl font-bold text-white">
          ${formatUSDCx(BigInt(totalAssets))}
        </p>
        <p className="text-xs text-usdc-blue mt-1">USDCx</p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <p className="text-gray-400 text-sm mb-1">Current APY</p>
        <p className="text-2xl font-bold text-green-400">
          {(apy / 100).toFixed(2)}%
        </p>
        <p className="text-xs text-gray-500 mt-1">Annual Yield</p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <p className="text-gray-400 text-sm mb-1">Share Price</p>
        <p className="text-2xl font-bold text-white">
          ${(sharePrice / 1_000_000).toFixed(6)}
        </p>
        <p className="text-xs text-gray-500 mt-1">per vUSDCx</p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <p className="text-gray-400 text-sm mb-1">Total Shares</p>
        <p className="text-2xl font-bold text-white">
          {formatUSDCx(BigInt(totalShares))}
        </p>
        <p className="text-xs text-stacks-purple mt-1">vUSDCx</p>
      </div>
    </div>
  );
}
