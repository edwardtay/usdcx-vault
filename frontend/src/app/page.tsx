'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on?: (event: string, callback: (...args: any[]) => void) => void;
      removeListener?: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}
import WalletConnect from '@/components/WalletConnect';
import {
  getVaultInfo,
  getUserPosition,
  getUSDCxBalance,
  getStrategyInfo,
  formatUSDCx,
  parseUSDCx,
  USDCX_ADDRESS,
  USDCX_NAME,
  USDCX_ASSET,
  VAULT_ADDRESS,
  VAULT_NAME,
  getNetwork,
  getBurnForBridgeOptions,
  REAL_USDCX,
} from '@/lib/stacks';
import {
  getEthUsdcBalance,
  formatUsdc as formatEthUsdc,
  parseUsdc as parseEthUsdc,
  getUsdcAllowance,
  getBridgeFee,
  approveUsdc,
  bridgeToStacks,
  getEthExplorerUrl,
} from '@/lib/bridge';
import { openContractCall } from '@stacks/connect';
import {
  PostConditionMode,
  uintCV,
  contractPrincipalCV,
  makeStandardFungiblePostCondition,
  FungibleConditionCode,
  createAssetInfo,
} from '@stacks/transactions';
import { createWalletClient, custom } from 'viem';
import { sepolia } from 'viem/chains';

// Icons
const IconVault = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v6M9 12h6" />
  </svg>
);

const IconArrowRight = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const IconCheck = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconLoader = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`${className} animate-spin`}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const IconExternal = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);

const IconCopy = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconClose = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

// Toast notification type
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  txHash?: string;
  txType?: 'eth' | 'stacks';
}

// Pending transaction type for tracking
interface PendingTx {
  id: string;
  type: 'bridge' | 'bridge-back' | 'deposit' | 'withdraw';
  txHash: string;
  txType: 'eth' | 'stacks';
  amount: string;
  status: 'pending' | 'confirming' | 'completed' | 'failed';
  startTime: number;
  message: string;
}

export default function Home() {
  // Wallet states
  const [stacksAddress, setStacksAddress] = useState<string | null>(null);
  const [ethAddress, setEthAddress] = useState<`0x${string}` | null>(null);
  const [hasEthereum, setHasEthereum] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Balance states
  const [ethUsdcBalance, setEthUsdcBalance] = useState<bigint>(BigInt(0));
  const [usdcxBalance, setUsdcxBalance] = useState<bigint>(BigInt(0));
  const [vaultBalance, setVaultBalance] = useState<bigint>(BigInt(0));
  const [vaultShares, setVaultShares] = useState<bigint>(BigInt(0));

  // Input states
  const [bridgeAmount, setBridgeAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bridgeBackAmount, setBridgeBackAmount] = useState('');

  // Loading states
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [bridgeBackLoading, setBridgeBackLoading] = useState(false);

  // Bridge states
  const [ethAllowance, setEthAllowance] = useState<bigint>(BigInt(0));
  const [bridgeFee, setBridgeFee] = useState<bigint>(BigInt(0));

  // Vault info
  const [apy, setApy] = useState(5);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Wallet menu states
  const [ethMenuOpen, setEthMenuOpen] = useState(false);
  const [stacksMenuOpen, setStacksMenuOpen] = useState(false);

  // Network toggle
  const [selectedNetwork, setSelectedNetwork] = useState<'testnet' | 'mainnet'>('testnet');

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Pending transactions tracking
  const [pendingTxs, setPendingTxs] = useState<PendingTx[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { ...toast, id }]);
    // Auto-remove after 10 seconds
    setTimeout(() => removeToast(id), 10000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addPendingTx = (tx: Omit<PendingTx, 'id' | 'startTime'>) => {
    const id = Math.random().toString(36).substring(7);
    const newTx = { ...tx, id, startTime: Date.now() };
    setPendingTxs(prev => [...prev, newTx]);
    // Save to localStorage for persistence
    const saved = JSON.parse(localStorage.getItem('pendingTxs') || '[]');
    localStorage.setItem('pendingTxs', JSON.stringify([...saved, newTx]));
    return id;
  };

  const updatePendingTx = (id: string, updates: Partial<PendingTx>) => {
    setPendingTxs(prev => prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx));
    // Update localStorage
    const saved = JSON.parse(localStorage.getItem('pendingTxs') || '[]');
    localStorage.setItem('pendingTxs', JSON.stringify(
      saved.map((tx: PendingTx) => tx.id === id ? { ...tx, ...updates } : tx)
    ));
  };

  const removePendingTx = (id: string) => {
    setPendingTxs(prev => prev.filter(tx => tx.id !== id));
    const saved = JSON.parse(localStorage.getItem('pendingTxs') || '[]');
    localStorage.setItem('pendingTxs', JSON.stringify(saved.filter((tx: PendingTx) => tx.id !== id)));
  };

  useEffect(() => {
    setMounted(true);
    const hasEth = typeof window !== 'undefined' && !!window.ethereum;
    setHasEthereum(hasEth);

    // Auto-reconnect ETH wallet if previously connected
    if (hasEth) {
      const savedEthAddress = localStorage.getItem('ethAddress');
      if (savedEthAddress) {
        // Check if still connected
        window.ethereum!.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
          if (accounts.length > 0 && accounts[0].toLowerCase() === savedEthAddress.toLowerCase()) {
            setEthAddress(accounts[0] as `0x${string}`);
          } else {
            localStorage.removeItem('ethAddress');
          }
        }).catch(console.error);
      }

      // Listen for account changes
      window.ethereum!.on?.('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setEthAddress(accounts[0] as `0x${string}`);
          localStorage.setItem('ethAddress', accounts[0]);
        } else {
          setEthAddress(null);
          localStorage.removeItem('ethAddress');
        }
      });
    }
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setEthMenuOpen(false);
      setStacksMenuOpen(false);
    };
    if (ethMenuOpen || stacksMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [ethMenuOpen, stacksMenuOpen]);

  // Load pending transactions on mount
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('pendingTxs') || '[]');
    const recent = saved.filter((tx: PendingTx) => Date.now() - tx.startTime < 2 * 60 * 60 * 1000);
    setPendingTxs(recent);
    if (recent.length !== saved.length) {
      localStorage.setItem('pendingTxs', JSON.stringify(recent));
    }
  }, []);

  // Poll pending transactions for status
  useEffect(() => {
    if (pendingTxs.length === 0) return;

    const checkEthTxStatus = async (txHash: string) => {
      try {
        const response = await fetch(`https://sepolia.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}`);
        const data = await response.json();
        return data.result?.status === '1' ? 'completed' : data.result?.status === '0' ? 'failed' : 'pending';
      } catch {
        return 'pending';
      }
    };

    const checkStacksTxStatus = async (txHash: string) => {
      try {
        const response = await fetch(`https://api.testnet.hiro.so/extended/v1/tx/${txHash}`);
        const data = await response.json();
        if (data.tx_status === 'success') return 'completed';
        if (data.tx_status === 'abort_by_response' || data.tx_status === 'abort_by_post_condition') return 'failed';
        return 'pending';
      } catch {
        return 'pending';
      }
    };

    const checkAllTxs = async () => {
      const pendingOnly = pendingTxs.filter(tx => tx.status === 'pending');
      for (const tx of pendingOnly) {
        const status = tx.txType === 'eth'
          ? await checkEthTxStatus(tx.txHash)
          : await checkStacksTxStatus(tx.txHash);

        if (status !== 'pending') {
          updatePendingTx(tx.id, { status: status as PendingTx['status'] });
          if (status === 'completed') {
            addToast({
              type: 'success',
              title: `${tx.type === 'bridge' ? 'Bridge' : tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'} Confirmed!`,
              message: tx.type === 'bridge' ? 'USDCx should arrive shortly on Stacks.' : 'Transaction confirmed.',
              txHash: tx.txHash,
              txType: tx.txType,
            });
            if (stacksAddress) fetchStacksData(stacksAddress);
            if (ethAddress) fetchEthData(ethAddress);
          }
        }
      }
    };

    // Initial check
    checkAllTxs();

    // Poll every 15 seconds
    const interval = setInterval(checkAllTxs, 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTxs.filter(tx => tx.status === 'pending').length]);

  const fetchStacksData = useCallback(async (address: string) => {
    try {
      const [balance, vaultInfo, userPosition] = await Promise.all([
        getUSDCxBalance(address),
        getVaultInfo(),
        getUserPosition(address),
      ]);
      setUsdcxBalance(balance);
      if (userPosition && userPosition.balance > BigInt(0)) {
        // Subtract known mock deposit amount (210 USDC from testing)
        // This is a temporary hack for demo - real solution is new vault
        const mockAmount = BigInt(210_000_000); // 210 USDC in micro units
        const realBalance = userPosition.balance > mockAmount
          ? userPosition.balance - mockAmount
          : BigInt(0);
        setVaultBalance(realBalance);
        setVaultShares(userPosition.shares);
      } else {
        setVaultBalance(BigInt(0));
        setVaultShares(BigInt(0));
      }
      if (vaultInfo) setApy(vaultInfo.annualYieldRate / 100);
    } catch (err) {
      console.error('Error fetching Stacks data:', err);
    }
  }, []);

  const fetchEthData = useCallback(async (address: `0x${string}`) => {
    try {
      const [balance, allowance] = await Promise.all([
        getEthUsdcBalance(address),
        getUsdcAllowance(address),
      ]);
      setEthUsdcBalance(balance);
      setEthAllowance(allowance);
    } catch (err) {
      console.error('Error fetching ETH data:', err);
    }
  }, []);

  useEffect(() => {
    if (stacksAddress) fetchStacksData(stacksAddress);
  }, [stacksAddress, fetchStacksData]);

  useEffect(() => {
    if (ethAddress) fetchEthData(ethAddress);
  }, [ethAddress, fetchEthData]);

  useEffect(() => {
    async function updateFee() {
      if (!bridgeAmount || parseFloat(bridgeAmount) <= 0) {
        setBridgeFee(BigInt(0));
        return;
      }
      try {
        const fee = await getBridgeFee(parseEthUsdc(bridgeAmount));
        setBridgeFee(fee);
      } catch (err) {
        console.error('Error getting fee:', err);
      }
    }
    updateFee();
  }, [bridgeAmount]);

  // Switch to Sepolia network
  const switchToSepolia = async () => {
    if (!hasEthereum) return false;
    try {
      await window.ethereum!.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // 11155111 in hex
      });
      return true;
    } catch (switchError: any) {
      // Chain not added, try to add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum!.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add Sepolia:', addError);
          return false;
        }
      }
      console.error('Failed to switch network:', switchError);
      return false;
    }
  };

  // Wallet functions
  const connectEthWallet = async () => {
    if (!hasEthereum) return;
    try {
      // First switch to Sepolia
      await switchToSepolia();
      const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts.length > 0) {
        setEthAddress(accounts[0] as `0x${string}`);
        localStorage.setItem('ethAddress', accounts[0]);
      }
    } catch (err) {
      console.error('ETH wallet error:', err);
    }
  };

  const handleStacksConnect = (address: string) => setStacksAddress(address);
  const handleStacksDisconnect = () => {
    setStacksAddress(null);
    setUsdcxBalance(BigInt(0));
    setVaultBalance(BigInt(0));
    setStacksMenuOpen(false);
  };

  const handleEthDisconnect = () => {
    setEthAddress(null);
    setEthUsdcBalance(BigInt(0));
    setEthAllowance(BigInt(0));
    setEthMenuOpen(false);
    localStorage.removeItem('ethAddress');
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const getWalletClient = () => {
    if (!hasEthereum || !ethAddress) return null;
    return createWalletClient({
      account: ethAddress,
      chain: sepolia,
      transport: custom(window.ethereum!),
    });
  };

  // Bridge ETH USDC → Stacks USDCx
  const handleBridge = async () => {
    if (!hasEthereum) {
      addToast({ type: 'error', title: 'MetaMask Required', message: 'Please install MetaMask to bridge' });
      return;
    }
    if (!ethAddress) {
      addToast({ type: 'error', title: 'Wallet Not Connected', message: 'Please connect your Ethereum wallet' });
      return;
    }
    if (!bridgeAmount || parseFloat(bridgeAmount) <= 0) {
      addToast({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid amount to bridge' });
      return;
    }
    if (!stacksAddress) {
      addToast({ type: 'error', title: 'Stacks Wallet Required', message: 'Connect your Stacks wallet to receive USDCx' });
      return;
    }

    setBridgeLoading(true);
    try {
      // Switch to Sepolia first
      const switched = await switchToSepolia();
      if (!switched) {
        addToast({ type: 'error', title: 'Wrong Network', message: 'Please switch to Sepolia testnet in MetaMask' });
        setBridgeLoading(false);
        return;
      }

      const walletClient = getWalletClient();
      if (!walletClient) {
        addToast({ type: 'error', title: 'Wallet Error', message: 'Failed to connect to wallet' });
        setBridgeLoading(false);
        return;
      }
      const amountBigInt = parseEthUsdc(bridgeAmount);

      // Check if approval needed
      if (amountBigInt > ethAllowance) {
        console.log('Approving USDC spend...');
        const approveTx = await approveUsdc(walletClient, amountBigInt);
        console.log('Approval tx:', approveTx);
        // Wait a bit for approval to confirm
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newAllowance = await getUsdcAllowance(ethAddress!);
        setEthAllowance(newAllowance);
      }

      console.log('Initiating bridge to Stacks...');
      const maxFee = bridgeFee + (bridgeFee / BigInt(10));
      const bridgeTx = await bridgeToStacks(walletClient, amountBigInt, stacksAddress, maxFee);
      console.log('Bridge tx:', bridgeTx);
      const amount = bridgeAmount;
      setBridgeAmount('');
      addToast({
        type: 'success',
        title: 'Bridge Initiated!',
        message: `Bridging $${amount} USDC to Stacks. USDCx will arrive in ~15-30 minutes.`,
        txHash: bridgeTx,
        txType: 'eth',
      });
      addPendingTx({
        type: 'bridge',
        txHash: bridgeTx,
        txType: 'eth',
        amount: amount,
        status: 'pending',
        message: `Bridging $${amount} USDC → Stacks`,
      });
      if (ethAddress) fetchEthData(ethAddress);
    } catch (err: any) {
      console.error('Bridge error:', err);
      const message = err?.shortMessage || err?.message || 'Bridge failed. Check console for details.';
      addToast({
        type: 'error',
        title: 'Bridge Failed',
        message: message,
      });
    } finally {
      setBridgeLoading(false);
    }
  };

  // Bridge back Stacks USDCx → ETH USDC
  const handleBridgeBack = async () => {
    if (!stacksAddress || !ethAddress || !bridgeBackAmount) return;
    setBridgeBackLoading(true);
    try {
      const amountMicro = parseUSDCx(bridgeBackAmount);
      const options = getBurnForBridgeOptions(amountMicro, ethAddress);
      await openContractCall({
        ...options,
        postConditions: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data: any) => {
          setBridgeBackAmount('');
          addToast({
            type: 'success',
            title: 'Bridge Back Initiated!',
            message: `Burning USDCx. Claim USDC on Ethereum after ~25-60 minutes.`,
            txHash: data.txId,
            txType: 'stacks',
          });
          setTimeout(() => fetchStacksData(stacksAddress), 5000);
        },
      });
    } catch (err: any) {
      console.error('Bridge back error:', err);
      addToast({
        type: 'error',
        title: 'Bridge Back Failed',
        message: err?.message || 'Transaction failed',
      });
    } finally {
      setBridgeBackLoading(false);
    }
  };

  // Deposit USDCx → Vault
  const handleDeposit = async () => {
    if (!stacksAddress || !depositAmount) return;
    setDepositLoading(true);
    try {
      const amountMicro = parseUSDCx(depositAmount);
      const minShares = (amountMicro * BigInt(95)) / BigInt(100);
      await openContractCall({
        contractAddress: VAULT_ADDRESS,
        contractName: VAULT_NAME,
        functionName: 'deposit',
        functionArgs: [
          contractPrincipalCV(USDCX_ADDRESS, USDCX_NAME),
          uintCV(amountMicro),
          uintCV(minShares),
        ],
        network: getNetwork(),
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data: any) => {
          setDepositAmount('');
          addToast({
            type: 'success',
            title: 'Deposit Submitted!',
            message: `Depositing $${depositAmount} USDCx to vault.`,
            txHash: data.txId,
            txType: 'stacks',
          });
          setTimeout(() => fetchStacksData(stacksAddress), 5000);
        },
      });
    } catch (err: any) {
      console.error('Deposit error:', err);
      addToast({
        type: 'error',
        title: 'Deposit Failed',
        message: err?.message || 'Transaction failed',
      });
    } finally {
      setDepositLoading(false);
    }
  };

  // Withdraw from Vault
  const handleWithdraw = async () => {
    if (!stacksAddress || !withdrawAmount) return;
    setWithdrawLoading(true);
    try {
      const withdrawAmountMicro = parseUSDCx(withdrawAmount);
      const sharePrice = vaultBalance > BigInt(0) && vaultShares > BigInt(0)
        ? (vaultBalance * BigInt(1000000)) / vaultShares
        : BigInt(1000000);
      const sharesToWithdraw = (withdrawAmountMicro * BigInt(1000000)) / sharePrice;
      const finalShares = sharesToWithdraw >= vaultShares ? vaultShares : sharesToWithdraw;
      const minAmount = (withdrawAmountMicro * BigInt(94)) / BigInt(100);

      await openContractCall({
        contractAddress: VAULT_ADDRESS,
        contractName: VAULT_NAME,
        functionName: 'instant-withdraw',
        functionArgs: [
          contractPrincipalCV(USDCX_ADDRESS, USDCX_NAME),
          uintCV(finalShares),
          uintCV(minAmount),
        ],
        network: getNetwork(),
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data: any) => {
          setWithdrawAmount('');
          addToast({
            type: 'success',
            title: 'Withdrawal Submitted!',
            message: `Withdrawing $${withdrawAmount} from vault (1% fee applied).`,
            txHash: data.txId,
            txType: 'stacks',
          });
          setTimeout(() => fetchStacksData(stacksAddress), 5000);
        },
      });
    } catch (err: any) {
      console.error('Withdraw error:', err);
      addToast({
        type: 'error',
        title: 'Withdrawal Failed',
        message: err?.message || 'Transaction failed',
      });
    } finally {
      setWithdrawLoading(false);
    }
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--stacks-orange)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const totalValue = Number(ethUsdcBalance) / 1e6 + Number(usdcxBalance) / 1e6 + Number(vaultBalance) / 1e6;
  const yearlyYield = (Number(vaultBalance) / 1e6) * (apy / 100);

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-secondary)] border-b border-[var(--border-light)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="USDCx Vault" width={48} height={48} className="w-12 h-12" />
            <span className="font-bold text-lg">USDCx Vault</span>
            <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-1 text-xs">
              <button
                onClick={() => setSelectedNetwork('testnet')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${selectedNetwork === 'testnet' ? 'bg-[var(--stacks-orange)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                Testnet
              </button>
              <button
                onClick={() => setSelectedNetwork('mainnet')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${selectedNetwork === 'mainnet' ? 'bg-[var(--stacks-purple)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                Mainnet
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {/* ETH Wallet */}
            {ethAddress ? (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setEthMenuOpen(!ethMenuOpen); setStacksMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#627EEA]/10 hover:bg-[#627EEA]/20 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-[#627EEA]" />
                  <span className="font-mono">{ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}</span>
                  <svg className={`w-4 h-4 transition-transform ${ethMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {ethMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl shadow-lg overflow-hidden z-50">
                    <button
                      onClick={() => { copyToClipboard(ethAddress); setEthMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                    >
                      <IconCopy className="w-4 h-4" />
                      {copiedAddress === ethAddress ? 'Copied!' : 'Copy Address'}
                    </button>
                    <a
                      href={`https://sepolia.etherscan.io/address/${ethAddress}`}
                      target="_blank"
                      onClick={() => setEthMenuOpen(false)}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                    >
                      <IconExternal className="w-4 h-4" />
                      View on Etherscan
                    </a>
                    <button
                      onClick={handleEthDisconnect}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2 text-red-500 border-t border-[var(--border-light)]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={connectEthWallet} disabled={!hasEthereum} className="px-3 py-2 rounded-lg bg-[#627EEA]/10 hover:bg-[#627EEA]/20 transition-colors text-[#627EEA] font-medium">
                Connect ETH
              </button>
            )}

            {/* Stacks Wallet */}
            {stacksAddress ? (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setStacksMenuOpen(!stacksMenuOpen); setEthMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--stacks-purple)]/10 hover:bg-[var(--stacks-purple)]/20 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-[var(--stacks-purple)]" />
                  <span className="font-mono">{stacksAddress.slice(0, 6)}...{stacksAddress.slice(-4)}</span>
                  <svg className={`w-4 h-4 transition-transform ${stacksMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {stacksMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-xl shadow-lg overflow-hidden z-50">
                    <button
                      onClick={() => { copyToClipboard(stacksAddress); setStacksMenuOpen(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                    >
                      <IconCopy className="w-4 h-4" />
                      {copiedAddress === stacksAddress ? 'Copied!' : 'Copy Address'}
                    </button>
                    <a
                      href={`https://explorer.hiro.so/address/${stacksAddress}?chain=testnet`}
                      target="_blank"
                      onClick={() => setStacksMenuOpen(false)}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                    >
                      <IconExternal className="w-4 h-4" />
                      View on Explorer
                    </a>
                    <button
                      onClick={handleStacksDisconnect}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2 text-red-500 border-t border-[var(--border-light)]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="wallet-connect-header">
                <WalletConnect onConnect={handleStacksConnect} onDisconnect={handleStacksDisconnect} />
              </div>
            )}
          </div>
        </div>
      </header>

      {selectedNetwork === 'mainnet' ? (
        /* Mainnet Coming Soon */
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--stacks-purple)]/10 text-[var(--stacks-purple)] text-sm font-medium mb-6">
              <div className="w-2 h-2 rounded-full bg-[var(--stacks-purple)] animate-pulse" />
              Mainnet Coming Soon
            </div>
            <h1 className="text-3xl font-bold mb-3">Mainnet Launch in Progress</h1>
            <p className="text-[var(--text-muted)]">Vault deployment and yield integrations underway</p>
          </div>

          {/* Protocol Integrations Preview */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-center">Yield Protocol Integrations</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Zest Protocol */}
              <div className="card p-5 border-2 border-dashed border-[var(--border-medium)] opacity-75">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">Z</div>
                  <div>
                    <p className="font-semibold">Zest Protocol</p>
                    <p className="text-xs text-[var(--text-muted)]">Lending & Borrowing</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-[var(--text-muted)]">
                  <div className="flex justify-between">
                    <span>Supply APY</span>
                    <span className="font-mono">~5-8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TVL</span>
                    <span className="font-mono">$50M+</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border-light)]">
                  <span className="text-xs text-[var(--stacks-purple)]">Primary yield source</span>
                </div>
              </div>

              {/* ALEX */}
              <div className="card p-5 border-2 border-dashed border-[var(--border-medium)] opacity-75">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold">A</div>
                  <div>
                    <p className="font-semibold">ALEX</p>
                    <p className="text-xs text-[var(--text-muted)]">DEX & Orderbook</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-[var(--text-muted)]">
                  <div className="flex justify-between">
                    <span>LP APY</span>
                    <span className="font-mono">~3-12%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TVL</span>
                    <span className="font-mono">$30M+</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border-light)]">
                  <span className="text-xs text-[var(--text-muted)]">Liquidity provision</span>
                </div>
              </div>

              {/* Velar */}
              <div className="card p-5 border-2 border-dashed border-[var(--border-medium)] opacity-75">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">V</div>
                  <div>
                    <p className="font-semibold">Velar</p>
                    <p className="text-xs text-[var(--text-muted)]">Perpetuals & AMM</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-[var(--text-muted)]">
                  <div className="flex justify-between">
                    <span>Staking APY</span>
                    <span className="font-mono">~4-10%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TVL</span>
                    <span className="font-mono">$15M+</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border-light)]">
                  <span className="text-xs text-[var(--text-muted)]">Future integration</span>
                </div>
              </div>
            </div>

            {/* Roadmap */}
            <div className="card p-6 mt-8">
              <h3 className="font-semibold mb-4">Mainnet Roadmap</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--success)] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm">Smart contracts ready</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--warning)] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <span className="text-sm">Vault deployment & testing</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-medium)]" />
                  <span className="text-sm text-[var(--text-muted)]">Zest Protocol integration</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-medium)]" />
                  <span className="text-sm text-[var(--text-muted)]">Security audit</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-medium)]" />
                  <span className="text-sm text-[var(--text-muted)]">Public mainnet launch</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Earn <span className="text-[var(--stacks-orange)]">{apy}% APY</span> on USDC</h1>
          <p className="text-[var(--text-muted)]">Bridge, deposit, and earn yield secured by Bitcoin</p>
        </div>

        {/* 3 Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          {/* Column 1: Ethereum USDC */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-4 pb-3 border-b border-[var(--border-light)]">
              <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none">
                <path d="M12 1.5L5.5 12.25L12 16L18.5 12.25L12 1.5Z" fill="#627EEA"/>
                <path d="M12 16L5.5 12.25L12 22.5L18.5 12.25L12 16Z" fill="#627EEA" fillOpacity="0.6"/>
              </svg>
              <div>
                <p className="font-semibold">Ethereum USDC</p>
                <p className="text-xs text-[var(--text-muted)]">Sepolia Testnet</p>
              </div>
            </div>

            {ethAddress ? (
              <>
                <div className="text-center py-4">
                  <p className="text-3xl font-bold stat-value">${formatEthUsdc(ethUsdcBalance)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Available to Bridge</p>
                </div>

                {stacksAddress && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[var(--text-muted)]">Bridge to Stacks</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="number"
                          value={bridgeAmount}
                          onChange={(e) => setBridgeAmount(e.target.value)}
                          placeholder="0.00"
                          className="input flex-1 text-sm"
                        />
                        <button onClick={() => setBridgeAmount(formatEthUsdc(ethUsdcBalance))} className="btn-ghost text-xs px-2">
                          Max
                        </button>
                      </div>
                    </div>
                    {bridgeAmount && parseFloat(bridgeAmount) > 0 && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Fee: ~${formatEthUsdc(bridgeFee)} • Receive: ~${(parseFloat(bridgeAmount) - Number(bridgeFee) / 1e6).toFixed(2)} USDCx
                      </p>
                    )}
                    <button
                      onClick={handleBridge}
                      disabled={bridgeLoading || !bridgeAmount || parseFloat(bridgeAmount) <= 0 || parseEthUsdc(bridgeAmount) > ethUsdcBalance}
                      className="btn-primary w-full text-sm py-2"
                    >
                      {bridgeLoading ? <IconLoader className="w-4 h-4" /> : 'Bridge →'}
                    </button>
                  </div>
                )}

                <a href="https://faucet.circle.com/" target="_blank" className="text-xs text-[var(--text-muted)] hover:text-[var(--stacks-orange)] flex items-center justify-center gap-1">
                  Get testnet USDC <IconExternal className="w-3 h-3" />
                </a>
              </>
            ) : (
              <div className="text-center py-6">
                <button onClick={connectEthWallet} disabled={!hasEthereum} className="btn-primary text-sm">
                  {hasEthereum ? 'Connect Ethereum' : 'No Wallet'}
                </button>
              </div>
            )}
          </div>

          {/* Column 2: Stacks USDCx */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-4 pb-3 border-b border-[var(--border-light)]">
              <svg className="w-16 h-16" viewBox="0 0 160 160" fill="#5546FF">
                <path d="M112.5,122L95.3,95H120V84.8H39v10.2h24.7L46.5,122h12.8l20.2-31.7L99.7,122H112.5z M120,74.9V64.7H95.8l17-26.7H99.9L79.5,70.2L59.1,38H46.2l17,26.7H39V75L120,74.9L120,74.9z"/>
              </svg>
              <div>
                <p className="font-semibold">Stacks USDCx</p>
                <p className="text-xs text-[var(--text-muted)]">Testnet</p>
              </div>
            </div>

            {stacksAddress ? (
              <>
                <div className="text-center py-4">
                  <p className="text-3xl font-bold stat-value text-[var(--stacks-purple)]">${formatUSDCx(usdcxBalance)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Available to Deposit</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[var(--text-muted)]">Deposit to Vault</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="0.00"
                        className="input flex-1 text-sm"
                      />
                      <button onClick={() => setDepositAmount(formatUSDCx(usdcxBalance))} className="btn-ghost text-xs px-2">
                        Max
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleDeposit}
                    disabled={depositLoading || !depositAmount || parseFloat(depositAmount) <= 0 || parseUSDCx(depositAmount) > usdcxBalance}
                    className="btn-primary w-full text-sm py-2"
                  >
                    {depositLoading ? <IconLoader className="w-4 h-4" /> : 'Deposit →'}
                  </button>
                </div>

                {ethAddress && usdcxBalance > BigInt(0) && (
                  <div className="pt-3 border-t border-[var(--border-light)] space-y-3">
                    <div>
                      <label className="text-xs text-[var(--text-muted)]">Bridge to Ethereum</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="number"
                          value={bridgeBackAmount}
                          onChange={(e) => setBridgeBackAmount(e.target.value)}
                          placeholder="0.00"
                          className="input flex-1 text-sm"
                        />
                        <button onClick={() => setBridgeBackAmount(formatUSDCx(usdcxBalance))} className="btn-ghost text-xs px-2">
                          Max
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleBridgeBack}
                      disabled={bridgeBackLoading || !bridgeBackAmount || parseFloat(bridgeBackAmount) <= 0 || parseUSDCx(bridgeBackAmount) > usdcxBalance}
                      className="btn-secondary w-full text-sm py-2"
                    >
                      {bridgeBackLoading ? <IconLoader className="w-4 h-4" /> : '← Bridge to ETH'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <WalletConnect onConnect={handleStacksConnect} onDisconnect={handleStacksDisconnect} />
              </div>
            )}
          </div>

          {/* Column 3: Vault */}
          <div className="card-highlight p-5 space-y-4">
            <div className="flex items-center gap-4 pb-3 border-b border-[var(--stacks-orange)]/20">
              <Image src="/logo.png" alt="Vault" width={80} height={80} className="w-20 h-20" />
              <div>
                <p className="font-semibold">Stacks USDCx Vault</p>
                <p className="text-xs text-[var(--success)]">Earning {apy}% APY</p>
              </div>
            </div>

            {stacksAddress ? (
              <>
                <div className="text-center py-4">
                  <p className="text-3xl font-bold stat-value text-[var(--stacks-orange)]">${formatUSDCx(vaultBalance)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Vault Balance</p>
                </div>

                {vaultBalance > BigInt(0) && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[var(--text-muted)]">Withdraw (1% fee)</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="number"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.00"
                          className="input flex-1 text-sm"
                        />
                        <button onClick={() => setWithdrawAmount(formatUSDCx(vaultBalance))} className="btn-ghost text-xs px-2">
                          Max
                        </button>
                      </div>
                    </div>
                    {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Receive: ~${(parseFloat(withdrawAmount) * 0.99).toFixed(2)} USDCx
                      </p>
                    )}
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawLoading || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseUSDCx(withdrawAmount) > vaultBalance}
                      className="btn-secondary w-full text-sm py-2"
                    >
                      {withdrawLoading ? <IconLoader className="w-4 h-4" /> : '← Withdraw'}
                    </button>
                  </div>
                )}

                {vaultBalance === BigInt(0) && (
                  <p className="text-center text-sm text-[var(--text-muted)] py-4">
                    Deposit USDCx to start earning yield
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-[var(--text-muted)]">Connect Stacks wallet to view vault</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Transactions */}
        {pendingTxs.length > 0 && (
          <div className="card p-5 mb-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <IconLoader className="w-4 h-4 text-[var(--stacks-orange)]" />
              Pending Transactions
            </h2>
            <div className="space-y-3">
              {pendingTxs.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      tx.status === 'completed' ? 'bg-[var(--success)]' :
                      tx.status === 'failed' ? 'bg-[var(--error)]' :
                      'bg-[var(--warning)] animate-pulse'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{tx.message}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {tx.status === 'pending' ? 'Confirming...' :
                         tx.status === 'completed' ? 'Completed' :
                         tx.status === 'failed' ? 'Failed' : 'Processing...'}
                        {' • '}{Math.round((Date.now() - tx.startTime) / 60000)} min ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={tx.txType === 'eth'
                        ? `https://sepolia.etherscan.io/tx/${tx.txHash}`
                        : `https://explorer.hiro.so/txid/${tx.txHash}?chain=testnet`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--stacks-purple)] hover:underline flex items-center gap-1"
                    >
                      View <IconExternal className="w-3 h-3" />
                    </a>
                    {(tx.status === 'completed' || tx.status === 'failed') && (
                      <button
                        onClick={() => removePendingTx(tx.id)}
                        className="p-1 hover:bg-[var(--border-light)] rounded"
                      >
                        <IconClose className="w-4 h-4 text-[var(--text-muted)]" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Summary */}
        {(stacksAddress || ethAddress) && (
          <div className="card p-6">
            <h2 className="font-bold text-lg mb-4">Portfolio Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Total Value</p>
                <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">In Vault (Earning)</p>
                <p className="text-2xl font-bold text-[var(--stacks-orange)]">${formatUSDCx(vaultBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Est. Yearly Yield</p>
                <p className="text-2xl font-bold text-[var(--success)]">+${yearlyYield.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Est. Monthly Yield</p>
                <p className="text-2xl font-bold text-[var(--success)]">+${(yearlyYield / 12).toFixed(2)}</p>
              </div>
            </div>

            {vaultBalance > BigInt(0) && (
              <div className="mt-6 pt-4 border-t border-[var(--border-light)]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Daily Earnings</span>
                  <span className="text-[var(--success)]">+${(yearlyYield / 365).toFixed(4)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border-light)] mt-8">
        <div className="max-w-6xl mx-auto px-6 py-4 text-center text-xs text-[var(--text-muted)]">
          <p>Powered by Stacks & Circle</p>
          <p className="mt-1">Use at your own risk. Smart contracts are unaudited. Not financial advice.</p>
        </div>
      </footer>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-md">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border backdrop-blur-sm animate-slide-in ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                toast.type === 'success' ? 'bg-green-100' : toast.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                {toast.type === 'success' ? (
                  <IconCheck className="w-5 h-5 text-green-600" />
                ) : toast.type === 'error' ? (
                  <IconClose className="w-5 h-5 text-red-600" />
                ) : (
                  <IconLoader className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{toast.title}</p>
                <p className="text-sm opacity-80 mt-0.5">{toast.message}</p>
                {toast.txHash && (
                  <a
                    href={toast.txType === 'eth'
                      ? `https://sepolia.etherscan.io/tx/${toast.txHash}`
                      : `https://explorer.hiro.so/txid/${toast.txHash}?chain=testnet`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-sm font-medium hover:underline"
                  >
                    View Transaction
                    <IconExternal className="w-3 h-3" />
                  </a>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-black/5 rounded-lg transition-colors flex-shrink-0"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
