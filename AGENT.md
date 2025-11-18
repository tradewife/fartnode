# AGENTS

Institutional-grade execution only. No mock data, no pseudocode, no “example-only” flows.  
All agents operate under the assumption that **real funds will eventually move through this system.**

---

## Global Project Definition

**Project:** FARTNODE – Solana service that:

1. Monitors Pump.fun creator rewards for a specific Pump.fun token (owned by the project).
2. Claims creator fees into a **Creator Wallet**.
3. Routes a configurable share of claimed SOL into a **Rewards Vault**.
4. Snapshots `$FARTNODE` SPL token holders on-chain.
5. Computes “node units” per wallet:
   - 300_000 $FARTNODE = 1 node unit
   - 3_000_000 $FARTNODE = 10 node units (per-wallet cap)
   - Global cap: 160 node units (16 max-node equivalents)
6. Distributes Rewards Vault SOL proportionally to active node units.
7. Logs all operations for audit and for FARTNODE.com metrics.

**Hard global invariants (MUST hold in any implementation):**

- No epoch causes **loss of funds** due to software bugs.
- No epoch double-distributes the same SOL from the Rewards Vault.
- If an epoch fails mid-way, **remaining SOL stays in the Rewards Vault** and is safe.
- On-chain behavior is fully explainable from logs and configuration.
- No reliance on mock RPC, test mints, or placeholder addresses in committed code.
- Main branch is always in a state where it can be deployed to production.

---

## Agent: PROJECT_OWNER

**Role**  
Owns scope, priorities, and environment configuration. Approves mainnet activation.

**Inputs**

- This `AGENTS.MD`.
- High-level system intent (FARTNODE design).
- Keys and access (seed phrase or keypairs) stored securely **outside** repo.

**Primary Outputs**

- `.env` (never committed) with:
  - `RPC_ENDPOINT`
  - `FARTNODE_MINT`
  - `CREATOR_SECRET_B58`
  - `REWARDS_VAULT_SECRET_B58`
  - `EPOCH_SECONDS`
  - `USD_THRESHOLD`
  - `DISTRIBUTION_PERCENT`
- Final “mainnet activation” checklist signed off.
- Decision on when to move from devnet to mainnet.

**Definition of Done**

- All other agents’ definitions of done satisfied.
- Mainnet configuration validated against a real Pump.fun token and real $FARTNODE mint.
- Operational runbook exists for:
  - Restarting the service
  - Rotating keys
  - Pausing distributions safely.

**Hard Constraints**

- Secrets never committed to git.
- Any keypair used for production can be rotated without breaking architecture.

---

## Agent: ARCHITECT

**Role**  
Define precise architecture, interfaces, and invariants. No loose ends.

**Inputs**

- Global project definition.
- Solana + Pump.fun + Jupiter integration behavior.

**Primary Outputs**

1. `ARCHITECTURE.md` with:
   - Component diagram:
     - Creator Wallet
     - Rewards Vault
     - Distributor Service
     - RPC node
     - Pump.fun endpoint(s)
     - Price feed endpoint for USD threshold (e.g. Jupiter price API).
   - Exact data flows:
     - Claim path
     - Vault top-up path
     - Snapshot + node computation
     - Distribution path
   - Failure modes and expected behavior.
2. Clear, machine-checkable invariants (expressed in natural language but testable) for:
   - Idempotency per epoch.
   - No double-spend from Rewards Vault.
   - Handling of partial payout batches.

**Definition of Done**

- All modules and their responsibilities are unambiguous:
  - `src/config.ts`
  - `src/logger.ts`
  - `src/pump.ts`
  - `src/pricing.ts`
  - `src/rewardsVault.ts`
  - `src/holders.ts`
  - `src/nodes.ts`
  - `src/distribution.ts`
  - `src/epoch.ts`
  - `src/index.ts`
- Every function has a clear contract: inputs, outputs, error behavior.
- Invariants are referenced by DEV and QA in tests/runbooks.

**Hard Constraints**

- No references to “sample” mints or addresses in architecture.
- No ambiguity about which account owns funds at each step.

---

## Agent: DEV_CORE (Distributor Service)

**Role**  
Implement the Solana distributor binary in TypeScript with production-quality code. No pseudocode, no stubs.

**Inputs**

- `ARCHITECTURE.md`
- Global invariants
- Config layout from ARCHITECT

**Primary Outputs**

- Fully implemented TypeScript service in `src/`:
  - Uses real `@solana/web3.js`.
  - Uses real HTTP calls to Pump.fun / PumpPortal for `collectCreatorFee`.
  - Uses real HTTP calls to a price API for threshold checks.
- `package.json` with reproducible scripts:
  - `build` – TypeScript compile
  - `test` – unit/integration tests
  - `lint` – static checks
  - `epoch` – run one epoch once (for cron/systemd).
- Minimal but real tests:
  - Node-unit math (no mocks for logic).
  - Distribution splitting correctness (mathematical invariants).
- Concrete error-handling:
  - Graceful exits on RPC issues.
  - Retries with backoff for external HTTP calls.

**Definition of Done**

- `npm run build` passes with no warnings or errors.
- `npm run test` exists and passes; no placeholders.
- `src/index.ts`:
  - Reads from `.env`.
  - Executes one **real** epoch against the configured network.
  - Exits with non-zero code on a hard failure.
- Code contains **no** TODOs for core paths (claim, snapshot, distribute).

**Hard Constraints**

- No pseudocode markers (`// TODO`, `// pseudo`, etc.) in distribution/claim paths.
- No inline fake values (e.g. no `FARTNODE_MINT = "ExampleMint"`).
- All on-chain calls are genuine; anything that needs to be disabled for safety must be controlled via configuration flags, not commented-out logic.

---

## Agent: DEV_INTEGRATIONS (Pump.fun, Pricing)

**Role**  
Own integration correctness with Pump.fun and price endpoints.

**Inputs**

- Pump.fun / PumpPortal HTTP API behavior.
- Chosen price API (e.g. Jupiter price endpoint).

**Primary Outputs**

- `src/pump.ts`:
  - Reliable `claimCreatorFees()` implementation calling the real Pump.fun endpoint.
  - Clear logging of:
    - Request parameters
    - Transaction signature
    - Change in creator wallet balance.
- `src/pricing.ts`:
  - `getSolUsdPrice()` returning a real number from a live endpoint.
  - Basic sanity checks (e.g. price > 0, within reasonable range).
- Threshold logic in `src/epoch.ts` that:
  - Computes USD value = (creator balance + vault balance) * live SOL/USD.
  - Only runs full epoch when USD threshold is met.

**Definition of Done**

- Curl-able endpoints documented in `ARCHITECTURE.md` are exactly what the code uses.
- Any failure in integration is logged clearly and causes a controlled skip of the epoch, not a partial distribution.
- Tests include at least:
  - Parsing of the Pump.fun transaction (using real serialized transactions captured from devnet/mainnet).
  - Price parsing and validation logic.

**Hard Constraints**

- No mock URLs.
- No “example payloads” in the production code path.
- No silent catch-and-ignore of HTTP failures.

---

## Agent: DEV_ACCOUNTING (Node Math & Distribution)

**Role**  
Guarantee that node units and payouts follow the agreed rules exactly and are mathematically sound.

**Inputs**

- Global node rules:
  - 300_000 tokens = 1 unit
  - 3_000_000 tokens = 10-unit cap per wallet
  - 160 total units per epoch
- On-chain SPL token balances via RPC.

**Primary Outputs**

- `src/holders.ts`:
  - Uses `getProgramAccounts` on the SPL token program with the configured mint.
  - Correctly decodes:
    - mint
    - owner
    - amount (u64).
- `src/nodes.ts`:
  - Deterministic and tested unit computation:
    - Under 300_000 → 0 units.
    - Step-wise increments per 300_000.
    - Per-wallet cap at 10 units.
    - Global cap at 160 units, sorted by (units desc, pubkey asc).
- `src/distribution.ts`:
  - Given:
    - `vaultBalanceLamports`
    - `ActiveNode[]`
  - Produces:
    - List of real `SystemProgram.transfer` instructions from Rewards Vault to recipients.
  - Enforces:
    - `vaultBalanceLamports / TOTAL_NODE_UNITS` integer division.
    - Dust threshold (no spam distributions).

**Definition of Done**

- Unit tests fully cover:
  - Boundary conditions (299_999, 300_000, 3_000_000, >3_000_000).
  - Cases where total potential units > 160 and ordering matters.
- Property-based tests or carefully constructed cases ensure:
  - Sum of lamports sent ≤ vault balance.
  - Difference (vault balance − sum distributed) remains in vault and is non-negative.
- Implementation is readable and easy to audit.

**Hard Constraints**

- No floating point logic in lamport math.
- No randomization in ordering; sorting is deterministic.
- No “estimate” or “approximate” language; all amounts are exact lamports.

---

## Agent: DEVOPS

**Role**  
Make the service deployable, observable, and safe to run continuously.

**Inputs**

- Built binary / Node service.
- Operational constraints from PROJECT_OWNER.

**Primary Outputs**

- `Dockerfile` and/or systemd/cron setup:
  - Docker image that:
    - Builds the project
    - Runs `node dist/index.js` (or similar) for one epoch.
  - Instructions in `DEPLOYMENT.md` for:
    - Running via cron.
    - Running via systemd timer.
- Logging configuration:
  - Logs include timestamp, severity, and minimal structured fields (JSON logs preferred).
  - Log rotation strategy.
- Health & monitoring guidance:
  - How to detect repeated failures.
  - How to pause the service without losing funds.

**Definition of Done**

- A new machine can be provisioned using:
  - `git clone`
  - `npm install` or `pnpm install`
  - `npm run build`
  - `npm run epoch`
- Deployment instructions are precise:
  - Cron examples (with full paths).
  - Environment variable expectations.
- Clear recovery procedure for:
  - RPC outage
  - Pump.fun integration errors
  - Out-of-gas / fee issues.

**Hard Constraints**

- No dev-specific paths in scripts (no `/Users/...`).
- No reliance on interactive input (no prompts).
- Service can be restarted without manual intervention in normal operations.

---

## Agent: QA / AUDIT

**Role**  
Confirm that the implementation matches spec and is safe for mainnet. No rubber-stamping.

**Inputs**

- Full codebase
- `ARCHITECTURE.md`
- Tests
- `DEPLOYMENT.md`

**Primary Outputs**

- `AUDIT.md` with:
  - Checklist of all invariants and their verification status.
  - Notes on:
    - Double-spend risk.
    - Epoch idempotency.
    - Handling of edge cases (huge holders, many holders, RPC failures).
- Test coverage report summaries (not necessarily 100%, but sufficient around critical paths).
- Final recommendation: “Safe to proceed to mainnet with these conditions” or “Blocked until fixes”.

**Definition of Done**

- At least one dry-run on **devnet** or with a low-value mainnet token:
  - Actual claim call (or equivalent) exercised.
  - Real distributions sent to a controlled set of wallets.
- Reconciliation of:
  - Vault balance before and after a test epoch.
  - Total distributed lamports vs node-unit distribution logic.
- Every “MUST” invariant in this file either:
  - Proved satisfied, or
  - Explicitly documented as not yet met, with rationale.

**Hard Constraints**

- No reliance on “it worked once” anecdotes.
- No hidden assumptions about operator behavior; all expectations documented.

---

## Agent: DOCS / README

**Role**  
Write clear, accurate documentation for devs and operators. No marketing fluff in this repo.

**Inputs**

- All of the above.

**Primary Outputs**

- `README.md` with:
  - Project summary.
  - Architecture overview (short).
  - Quickstart for dev:
    - Clone
    - Install
    - Build
    - Run one epoch (against devnet or a safe config).
  - Configuration section (.env variables, meanings, constraints).
  - Warning banner about mainnet usage and funds risk.
- `RUNBOOK.md` (or section in README) with:
  - How to:
    - Start / stop service.
    - Rotate keys.
    - Interpret logs.
    - Debug common failure modes.

**Definition of Done**

- A competent Solana dev can follow the docs and:
  - Configure the project for their own token.
  - Run test epochs safely.
- Documentation matches actual code; no drift.

**Hard Constraints**

- No references to non-existent scripts or files.
- No “coming soon” placeholders in critical sections.

---

All agents are expected to treat this project as **real infrastructure that may custody value**.  
Every shortcut must be explicit, justified, and revisited before mainnet launch.
