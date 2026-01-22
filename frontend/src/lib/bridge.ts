// xReserve Bridge Integration
// Ethereum USDC → Stacks USDCx via Circle xReserve

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, custom } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

// ============================================
// CONTRACT ADDRESSES
// ============================================

export const BRIDGE_CONTRACTS = {
  mainnet: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
    XRESERVE: '0x8888888199b2Df864bf678259607d6D5EBb4e3Ce' as `0x${string}`,
    STACKS_DOMAIN: 10003, // Stacks domain ID for xReserve (constant across all networks)
  },
  testnet: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`, // Sepolia USDC
    XRESERVE: '0x008888878f94C0d87defdf0B07f46B93C1934442' as `0x${string}`, // Sepolia xReserve
    STACKS_DOMAIN: 10003, // Stacks domain ID (constant across all networks)
  },
};

export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
export const BRIDGE_CONFIG = NETWORK === 'mainnet' ? BRIDGE_CONTRACTS.mainnet : BRIDGE_CONTRACTS.testnet;

// ============================================
// ABIs
// ============================================

export const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const XRESERVE_ABI = [
  {
    name: 'depositToRemote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'value', type: 'uint256' },
      { name: 'remoteDomain', type: 'uint32' },
      { name: 'remoteRecipient', type: 'bytes32' },
      { name: 'localToken', type: 'address' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ type: 'uint64' }],
  },
] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

// C32 alphabet used by Stacks (different from base58!)
const C32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// Decode c32 string to bytes
function c32Decode(str: string): Uint8Array {
  const bytes: number[] = [];

  for (const char of str.toUpperCase()) {
    const value = C32_ALPHABET.indexOf(char);
    if (value === -1) continue; // Skip invalid chars

    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 32;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  return new Uint8Array(bytes.reverse());
}

// Convert Stacks address to bytes32 for xReserve
// Stacks address format: [S/M][P/T] + c32check(version + hash160)
// We encode: version byte + hash160 (20 bytes) = 21 bytes, left-padded to 32 bytes
export function stacksAddressToBytes32(stacksAddress: string): `0x${string}` {
  try {
    // Remove the prefix (ST, SP, SM, SN for testnet/mainnet)
    const prefix = stacksAddress.substring(0, 2);
    const addressBody = stacksAddress.substring(2);

    // Determine version byte from prefix
    let versionByte: number;
    if (prefix === 'SP') versionByte = 22;      // mainnet single-sig
    else if (prefix === 'SM') versionByte = 20; // mainnet multi-sig
    else if (prefix === 'ST') versionByte = 26; // testnet single-sig
    else if (prefix === 'SN') versionByte = 21; // testnet multi-sig
    else throw new Error(`Unknown address prefix: ${prefix}`);

    // Decode the c32 body (contains hash160 + checksum)
    const decoded = c32Decode(addressBody);

    // Take first 20 bytes as hash160 (rest is checksum)
    const hash160 = decoded.slice(0, 20);

    // Build 32-byte output: 11 zero bytes + version (1) + hash160 (20) = 32 bytes
    const bytes32 = new Uint8Array(32);
    bytes32[11] = versionByte;
    bytes32.set(hash160, 12);

    // Convert to hex
    const hex = Array.from(bytes32)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('Stacks address encoded:', stacksAddress, '→', `0x${hex}`);
    return `0x${hex}` as `0x${string}`;
  } catch (error) {
    console.error('Error encoding Stacks address:', error);
    throw error;
  }
}

// Get the chain config
export function getEthChain() {
  // Always use Sepolia for testnet - hardcoded for reliability
  return sepolia;
}

// Create public client for read operations
export function getPublicClient() {
  return createPublicClient({
    chain: getEthChain(),
    transport: http(),
  });
}

// ============================================
// BRIDGE FUNCTIONS
// ============================================

// Get USDC balance on Ethereum
export async function getEthUsdcBalance(address: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();

  try {
    const balance = await client.readContract({
      address: BRIDGE_CONFIG.USDC,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    return balance;
  } catch (error) {
    console.error('Error getting USDC balance:', error);
    return BigInt(0);
  }
}

// Get current allowance
export async function getUsdcAllowance(owner: `0x${string}`): Promise<bigint> {
  const client = getPublicClient();

  try {
    const allowance = await client.readContract({
      address: BRIDGE_CONFIG.USDC,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [owner, BRIDGE_CONFIG.XRESERVE],
    });
    return allowance;
  } catch (error) {
    console.error('Error getting allowance:', error);
    return BigInt(0);
  }
}

// Get bridge fee estimate
export async function getBridgeFee(amount: bigint): Promise<bigint> {
  // xReserve may not have getDepositFee function
  // Use a flat fee estimate of $0.10 (100000 in 6 decimals) + 0.1% of amount
  const flatFee = BigInt(100000); // $0.10
  const percentFee = (amount * BigInt(1)) / BigInt(1000); // 0.1%
  return flatFee + percentFee;
}

// Approve USDC spending
export async function approveUsdc(
  walletClient: any,
  amount: bigint
): Promise<`0x${string}`> {
  const hash = await walletClient.writeContract({
    chain: getEthChain(),
    address: BRIDGE_CONFIG.USDC,
    abi: USDC_ABI,
    functionName: 'approve',
    args: [BRIDGE_CONFIG.XRESERVE, amount],
  });
  return hash;
}

// Bridge USDC to Stacks (deposit to xReserve)
export async function bridgeToStacks(
  walletClient: any,
  amount: bigint,
  stacksRecipient: string,
  maxFee: bigint
): Promise<`0x${string}`> {
  const recipientBytes32 = stacksAddressToBytes32(stacksRecipient);

  const hash = await walletClient.writeContract({
    chain: getEthChain(),
    address: BRIDGE_CONFIG.XRESERVE,
    abi: XRESERVE_ABI,
    functionName: 'depositToRemote',
    args: [
      amount,
      BRIDGE_CONFIG.STACKS_DOMAIN,
      recipientBytes32,
      BRIDGE_CONFIG.USDC,
      maxFee,
      '0x' as `0x${string}`, // empty hook data
    ],
    gas: BigInt(500000), // Explicit gas limit under block cap
  });
  return hash;
}

// ============================================
// BRIDGE STATUS TRACKING
// ============================================

export interface BridgeStatus {
  status: 'pending' | 'attesting' | 'minting' | 'completed' | 'failed';
  ethTxHash?: string;
  stacksTxHash?: string;
  message: string;
  timestamp: Date;
}

// Track bridge transaction status via Stacks API
export async function getBridgeStatus(ethTxHash: string): Promise<BridgeStatus> {
  // In production, this would query the xReserve attestation service
  // For now, we return a placeholder that can be polled

  try {
    const apiUrl = NETWORK === 'mainnet'
      ? 'https://api.mainnet.hiro.so'
      : 'https://api.testnet.hiro.so';

    // Check for recent USDCx mint events (simplified)
    // In production, correlate with eth tx hash via attestation service
    const response = await fetch(
      `${apiUrl}/extended/v1/tx/mempool?limit=20`
    );
    const data = await response.json();

    // For demo purposes
    return {
      status: 'pending',
      ethTxHash,
      message: 'Bridge transaction submitted. Waiting for attestation (~15 min).',
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      status: 'pending',
      ethTxHash,
      message: 'Checking bridge status...',
      timestamp: new Date(),
    };
  }
}

// ============================================
// FORMATTING
// ============================================

export function formatUsdc(amount: bigint): string {
  return formatUnits(amount, 6);
}

export function parseUsdc(amount: string): bigint {
  return parseUnits(amount, 6);
}

// ============================================
// ETHEREUM EXPLORER LINKS
// ============================================

export function getEthExplorerUrl(txHash: string): string {
  return NETWORK === 'mainnet'
    ? `https://etherscan.io/tx/${txHash}`
    : `https://sepolia.etherscan.io/tx/${txHash}`;
}
