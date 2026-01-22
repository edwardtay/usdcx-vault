import { StacksMainnet, StacksTestnet } from '@stacks/network';
import {
  callReadOnlyFunction,
  cvToJSON,
  uintCV,
  principalCV,
  contractPrincipalCV,
  PostConditionMode,
  makeContractSTXPostCondition,
  FungibleConditionCode,
  createAssetInfo,
  makeContractFungiblePostCondition,
  makeStandardFungiblePostCondition,
} from '@stacks/transactions';

// ============================================
// CONTRACT CONFIGURATION
// ============================================

// Network: 'mainnet' | 'testnet'
export const NETWORK_TYPE = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

// Contract addresses
export const CONTRACTS = {
  mainnet: {
    // Update VAULT_ADDRESS after mainnet deployment
    VAULT_ADDRESS: 'SP_YOUR_DEPLOYED_VAULT_ADDRESS',
    VAULT_NAME: 'usdcx-vault-mainnet',
    // Real USDCx on mainnet (Circle bridged)
    USDCX_ADDRESS: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE',
    USDCX_NAME: 'usdcx',
    USDCX_ASSET: 'usdcx-token',
    // No strategy for mainnet yet - yield is added manually or via Zest later
    STRATEGY_ADDRESS: '',
    STRATEGY_NAME: '',
  },
  testnet: {
    VAULT_ADDRESS: 'ST2ZBRP21Z92YFT212XHZGF2G48HCPGBC8HBB8838',
    VAULT_NAME: 'usdcx-vault-v2',
    // Real USDCx (Circle xReserve bridged)
    USDCX_ADDRESS: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    USDCX_NAME: 'usdcx',
    USDCX_ASSET: 'usdcx-token',
    // Mock yield strategy for testnet demo
    STRATEGY_ADDRESS: 'ST2ZBRP21Z92YFT212XHZGF2G48HCPGBC8HBB8838',
    STRATEGY_NAME: 'mock-yield-strategy',
  },
};

export const getContractConfig = () => {
  return NETWORK_TYPE === 'mainnet' ? CONTRACTS.mainnet : CONTRACTS.testnet;
};

export const { VAULT_ADDRESS, VAULT_NAME, USDCX_ADDRESS, USDCX_NAME, USDCX_ASSET, STRATEGY_ADDRESS, STRATEGY_NAME } = getContractConfig() as {
  VAULT_ADDRESS: string;
  VAULT_NAME: string;
  USDCX_ADDRESS: string;
  USDCX_NAME: string;
  USDCX_ASSET: string;
  STRATEGY_ADDRESS: string;
  STRATEGY_NAME: string;
};

// ============================================
// NETWORK CONFIGURATION
// ============================================

export const getNetwork = () => {
  if (NETWORK_TYPE === 'mainnet') {
    return new StacksMainnet();
  }
  return new StacksTestnet();
};

export const getExplorerUrl = (txId: string) => {
  const base = NETWORK_TYPE === 'mainnet'
    ? 'https://explorer.stacks.co/txid'
    : 'https://explorer.hiro.so/txid';
  return `${base}/${txId}?chain=${NETWORK_TYPE}`;
};

export const getApiUrl = () => {
  return NETWORK_TYPE === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
};

// ============================================
// READ-ONLY CONTRACT CALLS
// ============================================

export async function getVaultInfo() {
  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: VAULT_ADDRESS,
      contractName: VAULT_NAME,
      functionName: 'get-vault-info',
      functionArgs: [],
      network,
      senderAddress: VAULT_ADDRESS,
    });

    const json = cvToJSON(result);
    if (json.success && json.value) {
      const data = json.value.value;
      // Handle both testnet (accumulated-yield) and mainnet (total-yield-earned) field names
      const yieldField = data['accumulated-yield'] || data['total-yield-earned'];
      const lastUpdateField = data['last-yield-update'] || data['last-harvest-block'];
      return {
        totalShares: BigInt(data['total-shares'].value),
        totalAssets: BigInt(data['total-assets'].value),
        accumulatedYield: BigInt(yieldField?.value || 0),
        annualYieldRate: Number(data['annual-yield-rate'].value),
        isPaused: data['is-paused'].value,
        lastYieldUpdate: Number(lastUpdateField?.value || 0),
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching vault info:', error);
    return null;
  }
}

export async function getUserPosition(userAddress: string) {
  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: VAULT_ADDRESS,
      contractName: VAULT_NAME,
      functionName: 'get-user-position',
      functionArgs: [principalCV(userAddress)],
      network,
      senderAddress: VAULT_ADDRESS,
    });

    const json = cvToJSON(result);
    if (json.value) {
      const data = json.value;
      return {
        shares: BigInt(data.shares.value),
        balance: BigInt(data.balance.value),
        depositBlock: Number(data['deposit-block'].value),
        blocksSinceDeposit: Number(data['blocks-since-deposit'].value),
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user position:', error);
    return null;
  }
}

export async function getUserShares(userAddress: string) {
  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: VAULT_ADDRESS,
      contractName: VAULT_NAME,
      functionName: 'get-user-shares',
      functionArgs: [principalCV(userAddress)],
      network,
      senderAddress: VAULT_ADDRESS,
    });

    const json = cvToJSON(result);
    return BigInt(json.value);
  } catch (error) {
    console.error('Error fetching user shares:', error);
    return BigInt(0);
  }
}

export async function getSharePrice() {
  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: VAULT_ADDRESS,
      contractName: VAULT_NAME,
      functionName: 'get-share-price',
      functionArgs: [],
      network,
      senderAddress: VAULT_ADDRESS,
    });

    const json = cvToJSON(result);
    return BigInt(json.value);
  } catch (error) {
    console.error('Error fetching share price:', error);
    return BigInt(1000000); // Default 1:1
  }
}

export async function previewDeposit(amount: bigint) {
  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: VAULT_ADDRESS,
      contractName: VAULT_NAME,
      functionName: 'preview-deposit',
      functionArgs: [uintCV(amount)],
      network,
      senderAddress: VAULT_ADDRESS,
    });

    const json = cvToJSON(result);
    return BigInt(json.value);
  } catch (error) {
    console.error('Error previewing deposit:', error);
    return amount;
  }
}

export async function previewWithdraw(shares: bigint) {
  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: VAULT_ADDRESS,
      contractName: VAULT_NAME,
      functionName: 'preview-withdraw',
      functionArgs: [uintCV(shares)],
      network,
      senderAddress: VAULT_ADDRESS,
    });

    const json = cvToJSON(result);
    return BigInt(json.value);
  } catch (error) {
    console.error('Error previewing withdraw:', error);
    return shares;
  }
}

export async function getWithdrawalRequest(userAddress: string) {
  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: VAULT_ADDRESS,
      contractName: VAULT_NAME,
      functionName: 'get-withdrawal-request',
      functionArgs: [principalCV(userAddress)],
      network,
      senderAddress: VAULT_ADDRESS,
    });

    const json = cvToJSON(result);
    if (json.value) {
      const data = json.value.value;
      return {
        shares: BigInt(data.shares.value),
        requestBlock: Number(data['request-block'].value),
        processed: data.processed.value,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching withdrawal request:', error);
    return null;
  }
}

export async function canProcessWithdrawal(userAddress: string) {
  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: VAULT_ADDRESS,
      contractName: VAULT_NAME,
      functionName: 'can-process-withdrawal',
      functionArgs: [principalCV(userAddress)],
      network,
      senderAddress: VAULT_ADDRESS,
    });

    const json = cvToJSON(result);
    return json.value === true;
  } catch (error) {
    console.error('Error checking withdrawal status:', error);
    return false;
  }
}

// ============================================
// STRATEGY HELPERS
// ============================================

export async function getStrategyInfo() {
  // No strategy configured
  if (!STRATEGY_ADDRESS || !STRATEGY_NAME) {
    return {
      name: 'Manual Yield',
      apy: 500,
      totalDeposited: BigInt(0),
      pendingYield: BigInt(0),
      lastHarvestBlock: 0,
    };
  }

  const network = getNetwork();

  try {
    const result = await callReadOnlyFunction({
      contractAddress: STRATEGY_ADDRESS,
      contractName: STRATEGY_NAME,
      functionName: 'get-strategy-info',
      functionArgs: [],
      network,
      senderAddress: STRATEGY_ADDRESS,
    });

    const json = cvToJSON(result);
    if (json.success && json.value) {
      const data = json.value.value;
      return {
        name: data.name?.value || 'Yield Strategy',
        apy: Number(data.apy?.value || 500),
        totalDeposited: BigInt(data['total-deposited']?.value || 0),
        pendingYield: BigInt(data['pending-yield']?.value || 0),
        lastHarvestBlock: Number(data['last-harvest-block']?.value || 0),
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching strategy info:', error);
    return {
      name: 'Yield Strategy',
      apy: 500,
      totalDeposited: BigInt(0),
      pendingYield: BigInt(0),
      lastHarvestBlock: 0,
    };
  }
}

// ============================================
// USDCx TOKEN HELPERS
// ============================================

export async function getUSDCxBalance(userAddress: string) {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(
      `${apiUrl}/extended/v1/address/${userAddress}/balances`
    );
    const data = await response.json();

    // Real USDCx token key format: ADDRESS.CONTRACT::ASSET_NAME
    const tokenKey = `${USDCX_ADDRESS}.${USDCX_NAME}::${USDCX_ASSET}`;
    const balance = data.fungible_tokens?.[tokenKey]?.balance || '0';

    return BigInt(balance);
  } catch (error) {
    console.error('Error fetching USDCx balance:', error);
    return BigInt(0);
  }
}

// ============================================
// CONTRACT CALL HELPERS
// ============================================

export function getDepositContractCallOptions(amount: bigint, minShares: bigint) {
  return {
    contractAddress: VAULT_ADDRESS,
    contractName: VAULT_NAME,
    functionName: 'deposit',
    functionArgs: [
      contractPrincipalCV(USDCX_ADDRESS, USDCX_NAME),
      uintCV(amount),
      uintCV(minShares),
    ],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      makeStandardFungiblePostCondition(
        '', // sender - will be filled by wallet
        FungibleConditionCode.Equal,
        amount,
        createAssetInfo(USDCX_ADDRESS, USDCX_NAME, USDCX_ASSET)
      ),
    ],
    network: getNetwork(),
  };
}

export function getInstantWithdrawContractCallOptions(shares: bigint, minAmount: bigint) {
  // Mainnet uses 'withdraw', testnet uses 'instant-withdraw'
  const functionName = NETWORK_TYPE === 'mainnet' ? 'withdraw' : 'instant-withdraw';

  return {
    contractAddress: VAULT_ADDRESS,
    contractName: VAULT_NAME,
    functionName,
    functionArgs: [
      contractPrincipalCV(USDCX_ADDRESS, USDCX_NAME),
      uintCV(shares),
      uintCV(minAmount),
    ],
    postConditionMode: PostConditionMode.Allow, // Allow because vault transfers out
    network: getNetwork(),
  };
}

export function getRequestWithdrawalContractCallOptions(shares: bigint) {
  return {
    contractAddress: VAULT_ADDRESS,
    contractName: VAULT_NAME,
    functionName: 'request-withdrawal',
    functionArgs: [uintCV(shares)],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [],
    network: getNetwork(),
  };
}

export function getProcessWithdrawalContractCallOptions() {
  return {
    contractAddress: VAULT_ADDRESS,
    contractName: VAULT_NAME,
    functionName: 'process-withdrawal',
    functionArgs: [contractPrincipalCV(USDCX_ADDRESS, USDCX_NAME)],
    postConditionMode: PostConditionMode.Allow,
    network: getNetwork(),
  };
}

export function getFaucetContractCallOptions() {
  return {
    contractAddress: USDCX_ADDRESS,
    contractName: USDCX_NAME,
    functionName: 'faucet',
    functionArgs: [],
    postConditionMode: PostConditionMode.Allow,
    network: getNetwork(),
  };
}

// ============================================
// BRIDGE BACK (Stacks → ETH) - Burn USDCx
// ============================================

// Real USDCx contract for bridge operations (not mock)
// Uses current network's USDCx address
export const REAL_USDCX = {
  ADDRESS: USDCX_ADDRESS,
  NAME: USDCX_NAME,
  ASSET: USDCX_ASSET,
};

// Convert Ethereum address to bytes for burn function
export function ethAddressToBuffer(ethAddress: string): Uint8Array {
  // Remove 0x prefix and convert to bytes
  const hex = ethAddress.replace('0x', '');
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Get burn options for bridging USDCx back to Ethereum
// Calls the burn function on the real USDCx contract
export function getBurnForBridgeOptions(amount: bigint, ethRecipient: string) {
  // Import bufferCV for the eth address
  const { bufferCV } = require('@stacks/transactions');

  return {
    contractAddress: REAL_USDCX.ADDRESS,
    contractName: REAL_USDCX.NAME,
    functionName: 'burn',
    functionArgs: [
      uintCV(amount),
      bufferCV(ethAddressToBuffer(ethRecipient)),
    ],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      // User must burn exactly this amount of USDCx
      makeStandardFungiblePostCondition(
        '', // Will be filled by wallet
        FungibleConditionCode.Equal,
        amount,
        createAssetInfo(REAL_USDCX.ADDRESS, REAL_USDCX.NAME, REAL_USDCX.ASSET)
      ),
    ],
    network: getNetwork(),
  };
}

// ============================================
// FORMATTING UTILITIES
// ============================================

export const DECIMALS = 6;
export const DECIMALS_MULTIPLIER = BigInt(10 ** DECIMALS);

export function formatUSDCx(amount: bigint | number): string {
  const value = Number(amount) / Number(DECIMALS_MULTIPLIER);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function parseUSDCx(amount: string): bigint {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return BigInt(0);
  return BigInt(Math.floor(parsed * Number(DECIMALS_MULTIPLIER)));
}

export function formatAPY(bps: number): string {
  return (bps / 100).toFixed(2) + '%';
}

export function formatSharePrice(price: bigint): string {
  const value = Number(price) / Number(DECIMALS_MULTIPLIER);
  return '$' + value.toFixed(6);
}

// ============================================
// TRANSACTION HISTORY (via API)
// ============================================

export interface VaultTransaction {
  txId: string;
  type: 'deposit' | 'withdraw' | 'instant-withdraw' | 'request-withdrawal';
  amount: bigint;
  shares: bigint;
  timestamp: Date;
  status: 'pending' | 'success' | 'failed';
  blockHeight: number;
}

export async function getTransactionHistory(userAddress: string): Promise<VaultTransaction[]> {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(
      `${apiUrl}/extended/v1/address/${userAddress}/transactions?limit=50`
    );
    const data = await response.json();

    const vaultTxs: VaultTransaction[] = [];

    for (const tx of data.results || []) {
      if (tx.tx_type !== 'contract_call') continue;
      if (tx.contract_call?.contract_id !== `${VAULT_ADDRESS}.${VAULT_NAME}`) continue;

      const functionName = tx.contract_call.function_name;
      let type: VaultTransaction['type'] | null = null;

      if (functionName === 'deposit') type = 'deposit';
      else if (functionName === 'instant-withdraw') type = 'instant-withdraw';
      else if (functionName === 'request-withdrawal') type = 'request-withdrawal';
      else if (functionName === 'process-withdrawal') type = 'withdraw';

      if (type) {
        vaultTxs.push({
          txId: tx.tx_id,
          type,
          amount: BigInt(0), // Would need to parse from events
          shares: BigInt(0),
          timestamp: new Date(tx.burn_block_time_iso),
          status: tx.tx_status === 'success' ? 'success' : tx.tx_status === 'pending' ? 'pending' : 'failed',
          blockHeight: tx.block_height,
        });
      }
    }

    return vaultTxs;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }
}
