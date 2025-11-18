# AGENTS

This file defines the agent roles and responsibilities for the FARTNODE distributor.

**FARTNODE** stands for **Foundation of Autonomous, Resilient Tokenomics and Network of Orchestrators for Decentralised Empowerment**.

- **FART** – Foundation of Autonomous, Resilient Tokenomics
- **NODE** – Network of Orchestrators for Decentralised Empowerment

In practice, this repo implements the **NODE** part: a Solana‑based Network of Orchestrators (bots/services) that:

1. Monitors Pump.fun creator rewards for the `$FARTNODE` token.
2. Claims creator fees into a Creator Wallet.
3. Routes a configurable share of those fees into a Rewards Vault.
4. Periodically snapshots `$FARTNODE` token holders from on‑chain SPL token accounts.
5. Applies eligibility rules (minimum balance, optional whale caps).
6. Distributes SOL from the Rewards Vault to eligible holders pro‑rata by balance.
7. Emits logs and metrics so the entire process is auditable.

There is **no separate staking contract** and **no node NFT**. In this design, a “node” is simply a wallet that holds enough `$FARTNODE` at snapshot time to qualify under the eligibility rules.

---

## Global Invariants

These invariants must hold for any implementation:

- Eligibility is determined solely from on‑chain `$FARTNODE` balances (plus static eligibility rules).
- No epoch causes loss of funds from the Rewards Vault due to software bugs.
- No epoch double‑distributes the same SOL from the Rewards Vault.
- If an epoch fails mid‑way, all remaining SOL stays in the Rewards Vault and is safe.
- Distribution math is deterministic and fully explainable from:
  - the set of token accounts at snapshot time,
  - the configured eligibility rules,
  - the Rewards Vault balance at epoch start,
  - the logs for that epoch.

---

## Agent: PROJECT_OWNER

**Role**  
Own overall scope, economics parameters, and environment configuration. Approves mainnet activation.

**Inputs**

- This `AGENTS.md`.
- README and architecture docs.
- Economic targets (thresholds, distribution percent, min/whale caps).

**Primary Outputs**

- `.env` (never committed) with:
  - `RPC_ENDPOINT`
  - `FARTNODE_MINT`
  - `CREATOR_SECRET_B58`
  - `REWARDS_VAULT_SECRET_B58`
  - `USD_THRESHOLD`
  - `DISTRIBUTION_PERCENT`
  - `MIN_ELIGIBLE_BALANCE`
  - `MAX_ELIGIBLE_BALANCE`
- “Go/No‑Go” decisions for:
  - devnet dry‑runs
  - mainnet activation.

**Definition of Done**

- Clear set of economic rules agreed:
  - target frequency (e.g. daily)
  - target threshold in USD
  - min balance and whale policy.
- Operators know how to pause and resume the service safely.

---

## Agent: ARCHITECT

**Role**  
Design the precise system architecture and invariants. No ambiguity about how funds or state flow.

**Inputs**

- Global invariants.
- Pump.fun and price‑feed behavior.
- Solana RPC constraints.

**Primary Outputs**

1. `ARCHITECTURE.md` with:
   - Component diagram:
     - Creator Wallet
     - Pump.fun creator vault
     - Rewards Vault
     - Distributor service
     - RPC endpoint
     - Price API endpoint
   - Data flows:
     - Creator fee claim path
     - SOL routing Creator → Rewards Vault
     - Holder snapshot → eligibility → distribution.
   - Failure modes and expected behavior.

2. Clear invariants for:
   - Idempotency per epoch.
   - Distribution sum vs. vault balance.
   - Eligibility selection.

**Definition of Done**

- All modules and their responsibilities are unambiguous:
  - `config.ts`
  - `logger.ts`
  - `pump.ts`
  - `pricing.ts`
  - `rewardsVault.ts`
  - `holders.ts`
  - `eligibility.ts`
  - `distribution.ts`
  - `epoch.ts`
  - `index.ts`
- Each module has a simple contract (inputs, outputs, error behavior).
- Invariants are referenced by DEV and QA.

---

## Agent: DEV_CORE (Distributor Service)

**Role**  
Implement the TypeScript distributor service that runs one epoch per invocation.

**Inputs**

- `ARCHITECTURE.md`
- Environment variables from PROJECT_OWNER.

**Primary Outputs**

- Fully implemented TypeScript code in `src/`:
  - Uses `@solana/web3.js` and `@solana/spl-token` for real RPC calls.
  - Contains the main CLI entrypoint in `src/index.ts` that:
    - loads config
    - runs a single epoch
    - exits with appropriate status.

- NPM scripts:
  - `build` – TypeScript compile.
  - `epoch` – run one epoch.
  - `test` – run tests.
  - `lint` – lint the codebase.

**Definition of Done**

- `npm run build` passes.
- `npm run epoch` executes end‑to‑end on devnet against a test token.
- No TODOs in the main claim/snapshot/distribution paths.

---

## Agent: DEV_INTEGRATIONS (Pump.fun and Pricing)

**Role**  
Own correctness of external integrations: Pump.fun creator fee claim and SOL/USD price feed.

**Inputs**

- Pump.fun / PumpPortal API behavior.
- Chosen price API (e.g. Jupiter).

**Primary Outputs**

- `pump.ts`:
  - `buildAndClaimCreatorFeeTx()` that:
    - calls Pump.fun / PumpPortal endpoint
    - deserialises the returned transaction
    - signs with Creator Wallet
    - submits via Solana RPC
    - verifies success.
- `pricing.ts`:
  - `getSolUsdPrice()` that:
    - calls a live price endpoint
    - returns a numeric price
    - sanity‑checks the result.

**Definition of Done**

- All endpoints and payloads match documentation.
- Integration errors are logged clearly and cause the epoch to abort safely (no half‑distribution).
- Unit tests cover:
  - payload construction/parsing
  - error conditions and timeouts.

---

## Agent: DEV_ACCOUNTING (Eligibility & Distribution Math)

**Role**  
Guarantee correctness of the token‑holder snapshot, eligibility rules, and SOL distribution math.

**Inputs**

- SPL Token program behavior.
- Eligibility rules from PROJECT_OWNER.

**Primary Outputs**

- `holders.ts`:
  - Uses `getProgramAccounts` with `FARTNODE_MINT`.
  - Decodes SPL token accounts into `{ owner, amount }`.
- `eligibility.ts`:
  - Filters holders by:
    - `MIN_ELIGIBLE_BALANCE`
    - `MAX_ELIGIBLE_BALANCE` (if non‑zero).
- `distribution.ts`:
  - Given:
    - Rewards Vault balance (lamports)
    - Eligible holders `[ { owner, amount } ]`
  - Computes:
    - per‑holder lamport amounts
    - set of transfer instructions from Rewards Vault to each recipient.

**Definition of Done**

- Unit tests cover:
  - eligibility boundaries
  - many‑holder scenarios.
- Distribution maths satisfy:
  - `sum(payouts) <= vaultBalance`
  - `vaultBalance - sum(payouts) >= 0` (residual safe in vault).
- Ordering is deterministic (e.g. sort by owner pubkey) so repeated runs on the same snapshot produce identical results.

---

## Agent: DEVOPS

**Role**  
Make running the distributor robust in production.

**Inputs**

- Built JS/TS artifacts.
- Target runtime environment.

**Primary Outputs**

- `Dockerfile` or deployment scripts.
- `DEPLOYMENT.md` describing:
  - how to run `npm run epoch` via cron/systemd.
  - log locations.
- Log format suitable for scraping / dashboards.

**Definition of Done**

- Fresh machine can be brought up with:
  - `git clone`
  - `npm install`
  - `npm run build`
  - `npm run epoch`.
- Cron/Systemd examples are provided and tested.
- Operators know how to:
  - rotate keys (changing `.env`)
  - change thresholds
  - pause distribution by disabling cron/systemd.

---

## Agent: QA / AUDIT

**Role**  
Verify the implementation matches this spec and is safe to run with real funds.

**Inputs**

- Full codebase.
- `ARCHITECTURE.md`, `README.md`, this `AGENTS.md`.

**Primary Outputs**

- `AUDIT.md` with:
  - checklist of invariants and whether they pass.
  - description of test scenarios executed:
    - small set of holders
    - large set of holders
    - high and low vault balances
    - RPC / API failure cases.
- Recommendation on production readiness.

**Definition of Done**

- End‑to‑end devnet test:
  - Real SPL token with multiple holders.
  - Real SOL movement Creator → Rewards Vault → holders.
- Manual reconciliation:
  - Snapshot of SPL token accounts.
  - Rewards Vault balance before epoch.
  - Payouts vs. expectations.

---

## Agent: DOCS / README

**Role**  
Maintain clear documentation for developers and operators.

**Inputs**

- Working implementation.
- Decisions from PROJECT_OWNER and ARCHITECT.

**Primary Outputs**

- `README.md` kept in sync with actual behavior.
- `RUNBOOK.md` or equivalent section detailing:
  - how to configure `.env`
  - how to run a test epoch
  - how to interpret logs
  - how to recover from common failures.

**Definition of Done**

- A Solana‑literate developer can:
  - configure the project for a new token
  - run devnet tests
  - understand how and when holders get SOL airdrops
    by following the docs only.
