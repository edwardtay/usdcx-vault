# USDCx Vault

Yield vault for Circle USDCx on Stacks. Bridge USDC from Ethereum, deposit to vault, earn yield secured by Bitcoin.

**Live:** [usdcx-vault.vercel.app](https://usdcx-vault.vercel.app)

## Status

| Network | Status | Features |
|---------|--------|----------|
| Testnet | Live | Bridge (both ways), Deposit, Withdraw |
| Mainnet | Coming Soon | Vault + Zest/ALEX/Velar yield |

## Architecture

```
Ethereum USDC ──[Circle xReserve]──> Stacks USDCx ──[Vault]──> vUSDCx Shares
     │                                    │                         │
  Sepolia                              Testnet                   >5% APY
     │                                    │
     <────────[Bridge Back]───────────────┘
```

## Features

- **Bridge In**: ETH USDC → Stacks USDCx via Circle xReserve (~15-30 min)
- **Bridge Back**: Stacks USDCx → ETH USDC via xReserve burn (~25 min, min $4.80)
- **Vault**: Deposit USDCx, receive yield-bearing shares
- **Withdraw**: Instant withdrawal with 1% fee
- **Network Toggle**: Switch between testnet/mainnet in UI

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Blockchain**: Stacks (Clarity smart contracts)
- **Bridge**: Circle xReserve / CCTP
- **Wallets**: Leather/Xverse (Stacks), MetaMask (Ethereum)

## Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| Vault v2 | `ST2ZBRP21Z92YFT212XHZGF2G48HCPGBC8HBB8838.usdcx-vault-v2` | Testnet vault |
| USDCx Token | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` | USDCx token |
| Bridge | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx-v1` | xReserve bridge (burn/mint) |

### Vault Mechanics

```
share_price = total_assets / total_shares
your_balance = your_shares × share_price
```

Yield accrues via `add-yield` (admin) → share price increases → all depositors benefit.

### Bridge Back (Peg-out)

```clarity
;; Burn USDCx to bridge back to Ethereum
(contract-call? .usdcx-v1 burn amount u0 recipient-32-bytes)
;; u0 = Ethereum domain ID
;; recipient = ETH address left-padded to 32 bytes
```

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Token Addresses

| Network | Contract | Address |
|---------|----------|---------|
| Testnet | USDCx | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx` |
| Testnet | Bridge | `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx-v1` |
| Mainnet | USDCx | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` |

## Mainnet Roadmap

- [x] Smart contracts ready
- [x] Testnet vault deployed & tested
- [ ] Mainnet vault deployment
- [ ] Zest Protocol integration (primary yield)
- [ ] ALEX / Velar integration
- [ ] Security audit

## Security

- No mnemonics or private keys in repository
- `settings/` and `.claude/` folders in `.gitignore`
- Post-conditions on contract calls

## Links

- [Stacks](https://stacks.co)
- [Circle xReserve](https://www.circle.com/blog/usdcx-on-stacks-now-available-via-circle-xreserve)
- [USDCx Bridge](https://bridge.stacks.co/usdc/eth/stx)
- [Stacks USDCx Docs](https://docs.stacks.co/learn/bridging/usdcx)
- [Zest Protocol](https://zestprotocol.com)

## License

MIT
