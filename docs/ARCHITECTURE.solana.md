# Solana Architecture for Fartnode

## Overview

Fartnode layers Solana-first capabilities on top of the Cloudflare VibeSDK stack. The worker runtime composes Solana Actions/Blinks, while shared libraries provide type-safe transaction scaffolding. Devnet/Testnet are the default targets; Mainnet activity requires an explicit opt-in per `AGENT.md`.

## Components

- `packages/solana-core` — TypeScript library exporting Action metadata types, RPC helpers, compute budget + priority fee utilities, simulation helpers, and `buildVersionedTransaction`. The package is published locally as `@fartnode/solana-core`.
- `worker/api/controllers/solanaController.ts` — Action handlers that validate input, orchestrate RPC calls, and compose transactions via the Solana core library.
- `worker/api/routes/solanaRoutes.ts` — Hono route registrations wiring GET/POST handlers for `/api/solana/actions/*`.
- `worker/logger` & `worker/middleware` — Structured logging, rate limiting, and auth primitives applied across Actions.

## Routing (Worker vs Next/Edge)

All Solana endpoints run inside the Cloudflare Worker (`worker/index.ts → worker/app.ts`). Requests enter Hono middleware, route through `worker/api/routes/solanaRoutes.ts`, and terminate in the relevant controller. There is no Next.js/Edge runtime in this repository; the Worker is the single execution plane for both local (`bun dev`) and production (`wrangler publish`) environments.

## Action/Blink data flow

1. **GET `/api/solana/actions/devnet-airdrop`** — Returns `ActionMetadata` describing title, description, icon, and input schema. Response is typed using `packages/solana-core/src/types.ts`.
2. **POST `/api/solana/actions/devnet-airdrop`** — Validates payload (`publicKey`, optional `amountSol`), enforces idempotency + rate limits, fetches a recent blockhash, prepends compute budget & priority fee presets, builds a Versioned Transaction via `buildVersionedTransaction`, and serializes to base64.
3. **Response** — `{ transaction, network: "devnet", simulateFirst: true }` guides clients to simulate before broadcast.
4. **Client** — Performs simulation, signature, and submission (e.g., Blink, Wallet Adapter, Expo MWA).

Structured logs trace each stage so telemetry dashboards can follow a request from ingress through RPC composition.

## Security model (Devnet default, no secrets)

- Network defaults to `devnet`; overrides require explicit configuration and acknowledgement.
- No private keys or secrets are requested. RPC endpoints come from public cluster URLs or `SOLANA_RPC_ENDPOINT` when provided.
- Responses redact internal error details; logs contain only public identifiers (wallet addresses, blockhashes).
- Idempotency headers and rate limiting protect against abuse and replay.
- Any Mainnet activity must surface program IDs, fee payer, and compute budget for approval in line with `AGENT.md`.

## Telemetry hooks

- `worker/logger` provides component-scoped loggers (e.g., `createLogger('SolanaAction')`) with structured payloads.
- Durable Object rate limit store (`services/rate-limit/DORateLimitStore`) records action usage without persisting PII.
- Observability integrations (`worker/observability`) are ready for Sentry or custom exporters once credentials are supplied.

## Future templates (Wallet Adapter, Expo MWA, Anchor/Native)

1. **Wallet Adapter (React Web)** — Integrate `@solana/wallet-adapter-react` into the UI layer with presets for compute/priority fees and simulate-first UX.  
   SST: [Connect a Wallet (React)](https://solana.com/cookbook/wallets/connect-wallet-react?utm_source=llms&utm_medium=ai&utm_campaign=txt)
2. **Expo Mobile Wallet Adapter** — Ship an Expo starter that wires the Solana Mobile stack and deep-link capable action flows.  
   SST: [Solana Mobile Dapps with Expo](https://solana.com/courses/mobile/solana-mobile-dapps-with-expo?utm_source=llms&utm_medium=ai&utm_campaign=txt)
3. **Anchor Program Template** — Generate PDAs, CPI boundaries, error enums, and typed clients for Anchor programs.  
   SST: [Intro to Anchor](https://solana.com/courses/onchain-development/intro-to-anchor?utm_source=llms&utm_medium=ai&utm_campaign=txt)
4. **Native Rust Program Template** — Provide low-level Solana program scaffolding with matching TS clients backed by `@fartnode/solana-core`.  
   SST: [Native Onchain Development](https://solana.com/courses/native-onchain-development/?utm_source=llms&utm_medium=ai&utm_campaign=txt)

## SST Links

- [Solana Actions Spec](https://solana.com/docs/advanced/actions?utm_source=llms&utm_medium=ai&utm_campaign=txt)
- [Getting Test SOL](https://solana.com/cookbook/development/test-sol?utm_source=llms&utm_medium=ai&utm_campaign=txt)
- [Send SOL](https://solana.com/cookbook/transactions/send-sol?utm_source=llms&utm_medium=ai&utm_campaign=txt)
- [Add Priority Fees](https://solana.com/cookbook/transactions/add-priority-fees?utm_source=llms&utm_medium=ai&utm_campaign=txt)
- [Optimize Compute](https://solana.com/cookbook/transactions/optimize-compute?utm_source=llms&utm_medium=ai&utm_campaign=txt)
