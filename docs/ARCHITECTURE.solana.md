# Solana Architecture for Fartnode

## Overview

Fartnode extends the Cloudflare VibeSDK baseline with production-ready Solana integration, transforming natural-language intent into type-safe, testable Solana applications. This architecture operates on **Devnet/Testnet by default**, with Mainnet requiring explicit user confirmation per AGENT.md security guidelines.

## Components

### 1. Solana Core Library (`vibesdk/shared/solana-core/`)

Reusable TypeScript utilities for Solana transaction composition and validation:

- **types.ts** — ActionMetadata, ComposeInput, ComposeResult, NetworkConfig
- **rpc.ts** — Connection management, RPC provider wrapper (endpoint from env)
- **fees.ts** — Priority fee helpers with sensible defaults (5000 microlamports) and overrides
- **compute.ts** — ComputeBudgetProgram instruction builders (limit + price)
- **simulate.ts** — `simulateFirst(tx)` utility for pre-flight validation
- **builders.ts** — `buildVersionedTx()` for composing versioned transactions with optional LUTs

**Key principle:** All transactions use **versioned transactions**, **priority fees**, and **compute budget presets** by default.

### 2. Action/Blink Endpoints

Solana Actions expose composable transaction endpoints following the [Solana Actions spec](https://solana.com/docs/advanced/actions):

- **GET** — Returns Action metadata (title, description, input schema, icon)
- **POST** — Validates input, composes a versioned transaction, returns base64-encoded transaction

**Location:** `vibesdk/worker/api/solana/` (Cloudflare Worker routing)

**Example:** `devnet-airdrop` Action demonstrates:
- Input validation (publicKey, amountSol)
- Idempotency support
- Priority fees + compute budget
- Versioned transaction composition
- Simulate-first recommendation

### 3. Worker Routing Integration

Actions are registered in Hono router (`vibesdk/worker/app.ts`):

```typescript
app.route('/api/solana', solanaRoutes);
```

**Route pattern:** `/api/solana/actions/<action-name>` (GET/POST)

### 4. Security Model

Per [AGENT.md](../AGENT.md):

- **Never** expose or request private keys/mnemonics
- **Default network:** Devnet/Testnet
- **Mainnet guard:** Requires explicit confirmation; surface fee payer, signers, compute budget, program IDs
- **Secrets:** Only via secure env/KV mounts; redact logs
- **Simulate-first:** All transaction composers recommend simulation before broadcast

### 5. Data Flow (Action/Blink)

```
User → GET /api/solana/actions/devnet-airdrop
    ← Action metadata (inputs, title, icon)

User → POST /api/solana/actions/devnet-airdrop
       { publicKey, amountSol }
    ← { transaction: <base64>, network: "devnet" }

User → Signs + broadcasts transaction
    ← Confirmation on Solana
```

### 6. Telemetry Hooks

Structured logging via `vibesdk/worker/logger/`:
- Action GET/POST requests
- Input validation failures
- Transaction composition errors
- Simulation results (when implemented)

**No secrets logged.** Public keys, program IDs, and transaction hashes only.

## Future Templates

The following templates will extend the Action/Blink foundation:

### Wallet Adapter (React Web)
- `@solana/wallet-adapter-react` integration
- Priority fees + compute budget defaults
- Simulate-first UX patterns
- Clear error messaging

References:
- [Wallet Adapter React Guide](https://solana.com/cookbook/wallets/connect-wallet-react)
- [Priority Fees](https://solana.com/cookbook/transactions/add-priority-fees)

### Mobile Wallet Adapter (Expo)
- MWA context/hooks
- Deep-link handlers
- Simulate-first prompts
- Basic payment/action flows

References:
- [Expo MWA Course](https://solana.com/courses/mobile/solana-mobile-dapps-with-expo)
- [MWA Deep Dive](https://solana.com/courses/mobile/mwa-deep-dive)

### Anchor Program Template
- PDAs, account validation, signer/writable ordering
- Error enums, CPI boundaries
- Compute budget usage
- Upgrade authority policy
- Typed TS client + e2e tests

References:
- [Intro to Anchor](https://solana.com/courses/onchain-development/intro-to-anchor)
- [Anchor PDAs](https://solana.com/courses/onchain-development/anchor-pdas)
- [Anchor CPIs](https://solana.com/courses/onchain-development/anchor-cpi)

### Native Rust Program Template
- Instruction enum, account structs, validation
- CPI examples, compute budgeting, error mapping
- TS client with transaction builders + tests

References:
- [Native Onchain Development](https://solana.com/courses/native-onchain-development/)
- [Hello World Native](https://solana.com/courses/native-onchain-development/hello-world-program)
- [Program Derived Addresses](https://solana.com/courses/native-onchain-development/program-derived-addresses)

## References (SST)

All Solana patterns in this architecture reference the official Single Source of Truth indexed by [solana.com/llms.txt](https://solana.com/llms.txt):

- [Solana Cookbook](https://solana.com/cookbook/)
- [Getting Test SOL](https://solana.com/cookbook/development/test-sol)
- [Send SOL](https://solana.com/cookbook/transactions/send-sol)
- [Priority Fees](https://solana.com/cookbook/transactions/add-priority-fees)
- [Optimize Compute](https://solana.com/cookbook/transactions/optimize-compute)
- [Intro to Solana Course](https://solana.com/courses/intro-to-solana/)

---

**Updated:** 2025-10-23  
**Network Default:** Devnet/Testnet  
**Mainnet:** Explicit approval required
