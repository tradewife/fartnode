# FARTNODE Distributor

**FARTNODE** stands for **Foundation of Autonomous, Resilient Tokenomics and Network of Orchestrators for Decentralised Empowerment**.

- **FART** = _Foundation of Autonomous, Resilient Tokenomics_
- **NODE** = _Network of Orchestrators for Decentralised Empowerment_

This repo contains the Solana distribution engine that routes Pump.fun creator rewards to `$FARTNODE` holders. In this model, any wallet that holds `$FARTNODE` at snapshot time is eligible to receive SOL airdrops from the creator fee flow (subject to configurable eligibility rules). There is **no separate node NFT or staking contract** – holding the token is enough.

---

## Overview

FARTNODE turns Pump.fun creator rewards into periodic SOL distributions for `$FARTNODE` holders.

At each epoch (for example, once per day), the service:

1. Monitors the Pump.fun creator vault and enforces a configurable USD threshold.
2. Claims accumulated creator fees (SOL) to the **Creator Wallet**.
3. Routes a configurable share of the claimed SOL into a dedicated **Rewards Vault**.
4. Snapshots `$FARTNODE` SPL token accounts on-chain.
5. Applies eligibility rules (for example: minimum balance, whale caps).
6. Distributes the Rewards Vault balance in SOL pro‑rata to eligible `$FARTNODE` holders.
7. Logs all activity for audit and for powering FARTNODE.com metrics.

Design priorities:

- **Safety:** no double‑spend from the Rewards Vault, predictable failure modes.
- **Transparency:** distributions are explainable from on‑chain data, logs, and config.
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
- `jest` – testing

Example install:

```bash
npm install   @solana/web3.js @solana/spl-token bs58 dotenv pino

npm install -D   typescript ts-node jest ts-jest @types/jest   eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier
```

---

## Architecture

### Key accounts

- **Creator Wallet**
  - Owns the Pump.fun token.
  - Receives creator fees (SOL) from Pump.fun’s creator vault.

- **Rewards Vault**
  - Dedicated SOL account used as the source for airdrops.
  - Holds the pooled share of creator rewards between epochs.

There is **no separate staking contract or node NFT**. Eligibility is computed directly from `$FARTNODE` token balances at snapshot time.

### Core components (`src/`)

The intended structure is:

- `config.ts` – environment variables, constants (thresholds, eligibility rules).
- `logger.ts` – structured logging setup.
- `pump.ts` – integration with Pump.fun / PumpPortal:
  - builds and submits `collectCreatorFee` transactions.
- `pricing.ts` – SOL/USD price via a price API (for USD threshold checks).
- `rewardsVault.ts` – moves SOL Creator → Rewards Vault; queries vault balance.
- `holders.ts` – fetches and decodes `$FARTNODE` token accounts via `getProgramAccounts`.
- `eligibility.ts` – applies rules (min balance, whale caps) to decide which holders are eligible.
- `distribution.ts` – SOL airdrops from Rewards Vault to eligible holders.
- `epoch.ts` – orchestration of a single epoch:
  - threshold check → claim → vault top‑up → snapshot holders → eligibility filter → distribution → logging.
- `index.ts` – CLI entrypoint (runs one epoch).

### Epoch invariants

For a correctly configured deployment:

- Sum of lamports distributed in an epoch **≤** Rewards Vault balance at epoch start.
- Any undistributed residual lamports remain in the Rewards Vault.
- If an epoch fails mid‑way, remaining SOL stays in the Rewards Vault; no partial double‑spend.
- Eligibility is derived solely from on‑chain `$FARTNODE` balances (within the configured rules).

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
EPOCH_SECONDS=86400            # 1 day (cron/systemd cadence)
USD_THRESHOLD=1000             # minimum combined USD value to run epoch
DISTRIBUTION_PERCENT=0.7       # 70% of claimed SOL goes to Rewards Vault

# Eligibility rules (example values)
MIN_ELIGIBLE_BALANCE=300000    # minimum FARTNODE tokens to be included
MAX_ELIGIBLE_BALANCE=50000000  # optional whale cap, 0 = no cap
```

Requirements:

- `CREATOR_SECRET_B58` and `REWARDS_VAULT_SECRET_B58` are **base58‑encoded** secret keys.
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

Set `FARTNODE_MINT` in `.env` to this devnet mint and tune `MIN_ELIGIBLE_BALANCE` / `MAX_ELIGIBLE_BALANCE` as needed.

### 4. Run a single epoch (devnet)

```bash
npm run epoch
```

Expected behavior:

- Attempt to claim creator fees (devnet Pump.fun behavior may differ; adjust for mainnet later).
- Top up Rewards Vault with a share of claimed SOL (if any).
- Snapshot holders, filter by eligibility, distribute SOL pro‑rata.
- Log actions to stdout or log file, depending on `logger.ts`.

---

## Mainnet Usage

When devnet behavior is acceptable:

1. Launch the real Pump.fun token from the Creator Wallet.
2. Use that token as `$FARTNODE` (the fee‑earning Pump.fun token and the holder token are the same).
3. Set `.env` to mainnet values:
   - `RPC_ENDPOINT=https://api.mainnet-beta.solana.com`
   - Mainnet `FARTNODE_MINT`
   - Base58 secrets for mainnet Creator + Rewards Vault.
4. Set a meaningful `USD_THRESHOLD` (for example, `1000` or higher).
5. Run a single epoch manually and verify:
   - Creator balance changes after claim.
   - Rewards Vault receives expected share.
   - A sample of real holders receive SOL distributions proportional to their holdings.

---

## Running Continuously (Cron / Systemd)

The service is designed to execute **one epoch per run**.

Example cron (once per day at 00:05 UTC):

```bash
5 0 * * * cd /opt/fartnode-distributor &&   /usr/bin/npm run epoch >> logs/fartnode.log 2>&1
```

Systemd timers can be configured similarly with a oneshot service.

## Monitoring UI

Operators can inspect historical epochs via the lightweight monitoring UI:

```bash
npm run monitor
# opens http://localhost:8787 by default
```

The server reads recent entries from `data/epochs.jsonl` and renders a simple table summarizing claimed/distributed SOL, eligible holder counts, and transaction counts. Use `MONITOR_PORT` to override the port if needed.

---

## Testing

Tests focus on correctness of math and deterministic behavior.

### Unit tests should cover

- Eligibility:
  - balances below and above `MIN_ELIGIBLE_BALANCE`
  - whale cap behavior if `MAX_ELIGIBLE_BALANCE` is set
- Distribution:
  - allocation of `vaultBalanceLamports` across eligible holders
  - sum of payouts ≤ vault balance
  - non‑negative residual

Run:

```bash
npm run test
```

Tests run via Jest (`npm run test`).

---

## Security & Key Management

- Never commit private keys or `.env` files.
- Restrict filesystem access to any key files.
- Use dedicated Creator and Rewards Vault wallets for this project.
- Monitor:
  - RPC reliability
  - Pump.fun API changes
  - Price feed behavior (for USD thresholds)

Treat this service as production infra once deployed to mainnet.

---

## License

MIT
