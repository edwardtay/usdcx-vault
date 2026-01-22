'use client';

import { formatUSDCx, VaultTransaction, getExplorerUrl } from '@/lib/stacks';

interface TransactionHistoryProps {
  transactions: VaultTransaction[];
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return (
          <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0 0l-6-6m6 6l6-6" />
            </svg>
          </div>
        );
      case 'withdraw':
      case 'instant-withdraw':
        return (
          <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 0l6 6m-6-6l-6 6" />
            </svg>
          </div>
        );
      case 'request-withdrawal':
        return (
          <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-stacks-purple/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-stacks-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
            Pending
          </span>
        );
      case 'success':
        return (
          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
            Confirmed
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500">No transactions yet</p>
          <p className="text-sm text-gray-600">Your activity will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>

      <div className="space-y-3">
        {transactions.map((tx) => (
          <div
            key={tx.txId}
            className="flex items-center justify-between p-3 bg-gray-900 rounded-lg hover:bg-gray-850 transition-colors"
          >
            <div className="flex items-center gap-3">
              {getTypeIcon(tx.type)}
              <div>
                <p className="text-white font-medium capitalize">{tx.type.replace('-', ' ')}</p>
                <p className="text-xs text-gray-500">
                  {tx.timestamp.toLocaleDateString()} {tx.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className={`font-medium ${tx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                {tx.type === 'deposit' ? '+' : '-'}{formatUSDCx(tx.amount)} USDCx
              </p>
              <div className="flex items-center gap-2 justify-end">
                {getStatusBadge(tx.status)}
                {tx.txId && (
                  <a
                    href={getExplorerUrl(tx.txId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stacks-purple hover:underline"
                  >
                    View
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
