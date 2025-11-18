# FARTNODE Distributor

Automated Solana service that routes Pump.fun creator rewards to `$FARTNODE` “nodes” via node-weighted SOL distributions.

This repo contains the **on-chain distributor** that is intended for production use.

---

## Overview

FARTNODE turns Pump.fun creator rewards into periodic SOL distributions for `$FARTNODE` holders.

At each epoch, the service:

1. Monitors the Pump.fun creator vault and enforces a configurable USD threshold.
2. Claims accumulated creator fees to the **Creator Wallet**.
3. Routes a configurable share of the claimed SOL into a dedicated **Rewards Vault**.
4. Snapshots `$FARTNODE` SPL token holders on-chain.
5. Computes “node units” per wallet:
   - `300,000 $FARTNODE` = **1 mini-node unit**
   - `3,000,000 $FARTNODE` = **10-unit max-node** (per-wallet cap)
   - Global cap: **160 units** (16 max-node equivalents)
6. Distributes the Rewards Vault balance in SOL, proportional to **active node units**.
7. Logs all activity for audit and for powering `FARTNODE.com` metrics.

Design priorities:

- **Safety:** no double-spend from the Rewards Vault, predictable failure modes.
- **Transparency:** distributions explainable from logs + config.
- **Operational simplicity:** single CLI entrypoint, suitable for cron/systemd.

---

## Prerequisites

### 1. Solana CLI Tool Suite

Install the official Solana CLI tools (Anza installer or equivalent):

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

solana --version
```

Provides:

- `solana` – core CLI
- `solana-keygen` – key management
- `solana-test-validator` – local validator

### 2. SPL Token CLI (`spl-token`)

Used to inspect the `$FARTNODE` mint and token accounts:

```bash
# Install Rust + Cargo if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Install SPL Token CLI
cargo install spl-token-cli

spl-token --version
```

### 3. Node.js / TypeScript

The distributor is implemented in TypeScript targeting **Node.js ≥ 20**.

```bash
node -v   # v20.x.x or newer
npm -v    # or pnpm -v
```

---

## Dependencies

### Runtime / core

Installed via `package.json`:

- `@solana/web3.js` – Solana RPC + transactions
- `@solana/spl-token` – SPL token helpers
- `bs58` – base58 keypair encoding/decoding
- `dotenv` – load `.env` configuration
- `pino` – structured JSON logging (or similar)

### Dev / tooling

- `typescript`
- `ts-node` or `tsx`
- `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `prettier`
- `vitest` (or `jest`) – testing

Example install:

```bash
npm install   @solana/web3.js @solana/spl-token bs58 dotenv pino

npm install -D   typescript ts-node vitest   eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
```

---

## Architecture

### Key accounts

- **Creator Wallet**  
  - Owns the Pump.fun token.  
  - Receives creator fees (SOL) from Pump.fun’s creator vault.

- **Rewards Vault**  
  - Dedicated SOL account used as the source for distributions.  
  - Holds the pooled share of creator rewards between epochs.

### Core components (`src/`)

- `config.ts` – environment variables, constants (thresholds, node math)
- `logger.ts` – structured logging setup
- `pump.ts` – integration with Pump.fun / PumpPortal:
  - builds and submits `collectCreatorFee` transactions
- `pricing.ts` – SOL/USD price via a price API (e.g. Jupiter) for threshold checks
- `rewardsVault.ts` – moves SOL Creator → Rewards Vault; queries vault balance
- `holders.ts` – fetches and decodes `$FARTNODE` token accounts via `getProgramAccounts`
- `nodes.ts` – node-unit computation:
  - 300k / 3M thresholds, 160-unit global cap, deterministic ordering
- `distribution.ts` – SOL payouts from Rewards Vault to node holders
- `epoch.ts` – orchestration of a single epoch:
  - threshold check → claim → vault top-up → snapshot → distribution → logging
- `index.ts` – CLI entrypoint (runs one epoch)

### Epoch invariants

For a correctly configured deployment:

- Sum of lamports distributed in an epoch **≤** vault balance at epoch start.
- Any undistributed residual lamports remain in the Rewards Vault.
- If an epoch fails mid-way, remaining SOL stays in vault; no partial double-spend.

---

## Configuration

All configuration is via `.env` (do **not** commit this file).

Example:

```env
# RPC
RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Token + accounts
FARTNODE_MINT=<FARTNODE_MINT_ADDRESS>
CREATOR_SECRET_B58=<BASE58_PRIVATE_KEY_CREATOR>
REWARDS_VAULT_SECRET_B58=<BASE58_PRIVATE_KEY_REWARDS_VAULT>

# Epoch behavior
EPOCH_SECONDS=3600             # 1 hour (cron/systemd cadence)
USD_THRESHOLD=1000             # minimum combined USD value to run epoch
DISTRIBUTION_PERCENT=0.7       # 70% of claimed SOL goes to Rewards Vault

# Node math (fixed in code; documented here)
# UNIT_SIZE = 300_000 FARTNODE (adjusted for token decimals)
# MAX_UNITS_PER_WALLET = 10
# TOTAL_NODE_UNITS = 160
```

Requirements:

- `CREATOR_SECRET_B58` and `REWARDS_VAULT_SECRET_B58` are **base58-encoded** secret keys.
- Creator Wallet must be the wallet that receives Pump.fun creator fees.
- Rewards Vault must hold enough SOL to cover distributions + fees.

---

## Setup

1. **Clone the repo**

```bash
git clone https://github.com/<your-org>/fartnode-distributor.git
cd fartnode-distributor
```

2. **Install Node dependencies**

```bash
npm install
# or
pnpm install
```

3. **Create `.env`**

```bash
cp .env.example .env
# edit .env with real values
```

4. **Build**

```bash
npm run build
```

---

## Local / Devnet Testing

### 1. Configure Solana CLI for devnet

```bash
solana config set --url https://api.devnet.solana.com
solana config get
```

### 2. Create test keypairs

```bash
# Creator (devnet)
solana-keygen new -o creator-devnet.json
solana airdrop 2 $(solana-keygen pubkey creator-devnet.json)

# Rewards vault (devnet)
solana-keygen new -o vault-devnet.json
solana airdrop 2 $(solana-keygen pubkey vault-devnet.json)
```

Convert these to base58 secrets (or load them via file in dev) and set in `.env`.

### 3. Create a test token and holders

```bash
# Create devnet token
spl-token create-token
# note the mint address

spl-token create-account <MINT>
spl-token mint <MINT> 1000000000   # adjust for decimals

# Create holder wallets
solana-keygen new -o holder1.json
solana-keygen new -o holder2.json

spl-token create-account <MINT> --owner holder1.json
spl-token create-account <MINT> --owner holder2.json

# Mint to holders to exceed thresholds
spl-token mint <MINT> <AMOUNT_FOR_HOLDER1>
spl-token mint <MINT> <AMOUNT_FOR_HOLDER2>
```

Set `FARTNODE_MINT` in `.env` to this devnet mint and reduce `USD_THRESHOLD` (e.g. `0`) for testing.

### 4. Run a single epoch (devnet)

```bash
npm run epoch
```

Expected behavior:

- Attempt to claim creator fees (devnet Pump.fun behavior may differ; adjust for mainnet later).
- Top up Rewards Vault with a share of claimed SOL (if any).
- Snapshot holders, compute node units, distribute SOL.
- Log actions to stdout or log file, depending on `logger.ts`.

---

## Mainnet Usage

When devnet behavior is acceptable:

1. Launch the real Pump.fun token from the Creator Wallet.
2. Create / configure the real `$FARTNODE` SPL mint and distribution.
3. Set `.env` to mainnet values:
   - `RPC_ENDPOINT=https://api.mainnet-beta.solana.com`
   - Mainnet `FARTNODE_MINT`
   - Base58 secrets for mainnet Creator + Rewards Vault
4. Set a meaningful `USD_THRESHOLD` (e.g. `1000` or higher).
5. Run a single epoch manually and verify:
   - Creator balance changes after claim.
   - Rewards Vault receives expected share.
   - A sample of real holders receive SOL distributions consistent with node units.

---

## Running Continuously (Cron / Systemd)

The service is designed to execute **one epoch per run**.

Example cron (every 10 minutes):

```bash
*/10 * * * * cd /opt/fartnode-distributor &&   /usr/bin/npm run epoch >> logs/fartnode.log 2>&1
```

Systemd timers can be configured similarly with a oneshot service.

---

## Testing

Tests focus on correctness of math and deterministic behavior.

### Unit tests should cover

- Node-unit computation:
  - balances below and above 300k / 3M thresholds
  - >160 potential units with correct capping and ordering
- Distribution:
  - allocation of `vaultBalanceLamports` across node units
  - sum of payouts ≤ vault balance
  - non-negative residual

Run:

```bash
npm run test
```

Configure `vitest` or `jest` in `package.json` as preferred.

---

## Security & Key Management

- Never commit private keys or `.env` files.
- Restrict filesystem access to any key files.
- Use dedicated creator and rewards vault wallets for this project.
- Monitor:
  - RPC reliability
  - Pump.fun API changes
  - Price feed behavior (for USD thresholds)

Treat this service as production infra once deployed to mainnet.

---

## License

MIT
