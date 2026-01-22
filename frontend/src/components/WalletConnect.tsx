'use client';

import { useState, useEffect } from 'react';
import { AppConfig, showConnect, UserSession } from '@stacks/connect';

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

interface WalletConnectProps {
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

export default function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  // Check session after mount to avoid hydration mismatch
  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      const userAddress = userData.profile.stxAddress.testnet;
      setIsConnected(true);
      setAddress(userAddress);
      onConnect(userAddress);
    }
  }, [onConnect]);

  const handleConnect = () => {
    showConnect({
      appDetails: {
        name: 'USDCx Vault',
        icon: '/logo.svg',
      },
      redirectTo: '/',
      onFinish: () => {
        const userData = userSession.loadUserData();
        const userAddress = userData.profile.stxAddress.testnet;
        setIsConnected(true);
        setAddress(userAddress);
        onConnect(userAddress);
      },
      userSession,
    });
  };

  const handleDisconnect = () => {
    userSession.signUserOut();
    setIsConnected(false);
    setAddress(null);
    onDisconnect();
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      {isConnected && address ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)] font-mono">
            {truncateAddress(address)}
          </span>
          <button
            onClick={handleDisconnect}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full py-2.5 text-sm rounded-xl bg-[var(--stacks-purple)] text-white font-medium hover:opacity-90 transition-opacity"
        >
          Connect Leather/Xverse
        </button>
      )}
    </>
  );
}
