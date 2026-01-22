# USDCx Vault

Yield vault for Circle USDCx on Stacks. Bridge USDC from Ethereum, deposit to vault, earn yield secured by Bitcoin.

**Live:** [usdcx-vault.vercel.app](https://usdcx-vault.vercel.app)

## Status

| Network | Status | Features |
|---------|--------|----------|
| Testnet | Live | Bridge, Deposit, Withdraw |
| Mainnet | Coming Soon | Vault + Zest/ALEX/Velar yield |

## Architecture

```
Ethereum USDC ──[Circle xReserve]──> Stacks USDCx ──[Vault]──> vUSDCx Shares
     │                                    │                         │
  Sepolia                              Testnet                   5% APY
```

## Features

- **Bridge**: ETH USDC → Stacks USDCx via Circle xReserve
- **Vault**: Deposit USDCx, receive yield-bearing shares
- **Withdraw**: 1% fee (testnet) / 0.5% fee (mainnet)
- **Network Toggle**: Switch between testnet/mainnet in UI

## Contracts

| Contract | Network | Description |
|----------|---------|-------------|
| `usdcx-vault-testnet.clar` | Testnet | Live vault |
| `usdcx-vault-mainnet.clar` | Mainnet | Ready to deploy |

### Vault Mechanics

```
share_price = total_assets / total_shares
your_balance = your_shares × share_price
```

Yield accrues via `add-yield` (admin) → share price increases → all depositors benefit.

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

## Token Addresses

| Network | USDCx |
|---------|-------|
| Testnet | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` |
| Mainnet | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` |

## Mainnet Roadmap

- [x] Smart contracts ready
- [ ] Vault deployment (~10 STX)
- [ ] Zest Protocol integration
- [ ] ALEX / Velar integration
- [ ] Security audit

## Links

- [Stacks](https://stacks.co)
- [Circle xReserve](https://developers.circle.com/stablecoins/usdc-on-stacks)
- [Zest Protocol](https://zestprotocol.com)
