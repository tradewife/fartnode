# Devnet Airdrop Action — Developer Notes

## Overview

The `devnet-airdrop` Action exposes a public Solana Action/Blink that requests test SOL on Devnet and returns a pre-composed versioned transaction. The controller now supports:

- **Idempotency caching** via the `Idempotency-Key` header (10‑minute TTL)
- **Per wallet/IP rate limiting** (3 requests per 60 seconds) stored in KV
- **Structured logs** with redacted identifiers
- **Priority fee + compute budget presets** sourced from `@fartnode/solana-core`

All responses include `network: "devnet"` and `simulateFirst: true` flags so Blink clients know to dry-run before broadcast.

## Endpoints

### GET `/api/solana/actions/devnet-airdrop`

Returns metadata that front-ends (Blink, Wallet Adapter, Expo MWA) can render. Example response:

```json
{
  "title": "Devnet SOL Airdrop",
  "description": "Request test SOL on Solana Devnet. Returns a versioned transaction with compute budget and priority fees preconfigured.",
  "icon": "https://solana.com/src/img/branding/solanaLogoMark.svg",
  "inputs": [
    {
      "name": "publicKey",
      "type": "text",
      "label": "Recipient Public Key",
      "required": true,
      "placeholder": "Enter Solana public key",
      "pattern": "^[1-9A-HJ-NP-Za-km-z]{32,44}$"
    },
    {
      "name": "amountSol",
      "type": "number",
      "label": "Amount (SOL)",
      "required": false,
      "placeholder": "1",
      "min": 0.1,
      "max": 2
    }
  ],
  "links": {
    "actions": [
      {
        "label": "Learn about Devnet airdrops",
        "href": "https://solana.com/cookbook/development/test-sol?utm_source=llms&utm_medium=ai&utm_campaign=txt"
      }
    ]
  }
}
```

### POST `/api/solana/actions/devnet-airdrop`

Accepts a JSON payload containing the recipient public key and optional SOL amount (clamped to 0.1–2). Supports either `publicKey` or legacy `account`.

**Headers**
- `Content-Type: application/json`
- `CF-Connecting-IP` — forwarded by Workers automatically; required to enforce rate limit in tests/local calls
- `Idempotency-Key` *(recommended)* — repeat submissions with the same key reuse the cached response without consuming rate limit

**Sample request**

```bash
curl -X POST https://your-worker.dev/api/solana/actions/devnet-airdrop \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 7f5b0c20-1f9e-4f9d-9699-79d6fb54aa61" \
  -d '{
    "publicKey": "9we6kjtbcZ2vy3GSLLsZTEhbAqXPTRvEyoxa8wxSqKp5",
    "amountSol": 1.5
  }'
```

**Success response**

```json
{
  "transaction": "<base64-versioned-tx>",
  "network": "devnet",
  "simulateFirst": true,
  "message": "Devnet airdrop of 1.5 SOL prepared. Simulate before broadcasting."
}
```

**Rate limited response**

```json
{
  "error": {
    "message": "Rate limit exceeded for devnet airdrop. Please retry in 60 seconds."
  }
}
```

## Composition Pipeline

The controller (`worker/api/controllers/solanaController.ts`) orchestrates:

1. **Idempotency lookup** in `VibecoderStore` (KV) → cached response short-circuits flow.
2. **Input validation** via `@solana/web3.js` `PublicKey` parsing and amount clamping.
3. **Per-IP+wallet rate limit** enforced in KV (`3 / 60s` window).
4. **Devnet funding**: `connection.requestAirdrop()` followed by best-effort confirmation.
5. **Blockhash fetch**: `connection.getLatestBlockhash('confirmed')`.
6. **Transaction build** using `@fartnode/solana-core`:
   - `buildVersionedTransaction` prepends priority fee + compute budget instructions.
   - A zero-lamport `SystemProgram.transfer` keeps the transaction signer-only.
7. **Serialization**: `serializeTransaction()` returns base64 ready for Blink clients.
8. **Idempotency cache write** (10-minute TTL) and structured success logging.

## Rate Limit & Idempotency Implementation

- **Rate key**: `solana:actions:devnet-airdrop:rate-limit:<ip>:<recipient>`
- **Limit**: 3 successful compositions per 60 seconds (KV TTL window)
- **Idempotency key**: `solana:actions:devnet-airdrop:idempotency:<Idempotency-Key>`
- **TTL**: 600 seconds
- **Headers**: Successful responses echo `Idempotency-Key` and set `Cache-Control: no-store`

## Core Library Integration

`@fartnode/solana-core` lives at `packages/solana-core/` and exports the utilities used here:

- `src/types.ts` — `ActionMetadata`, `ComposeInput`, `ComposeResult`, `ActionResponse`
- `src/fees.ts` — `createPriorityFeeInstruction`, `DEFAULT_PRIORITY_FEE_MICROLAMPORTS`
- `src/compute.ts` — `createComputeBudgetInstructions` (limit presets)
- `src/builders.ts` — `buildVersionedTransaction`, `serializeTransaction`
- `src/simulate.ts` — `simulateFirst` helper for future UX hooks
- Tests under `packages/solana-core/__tests__`

### Toggling presets

- Priority fee default: `DEFAULT_PRIORITY_FEE_MICROLAMPORTS = 5000`
- Compute unit limit: `COMPUTE_UNIT_LIMIT = 120_000` (set inside controller)

Override by editing the constants or passing new values to `buildVersionedTransaction({ priorityFee, computeBudget })`.

## Local Testing

```bash
# Worker dev server
cd vibesdk
bun run dev

# GET metadata
curl http://localhost:8787/api/solana/actions/devnet-airdrop

# POST action (note CF-Connecting-IP header for rate limit logic)
curl -X POST http://localhost:8787/api/solana/actions/devnet-airdrop \
  -H "Content-Type: application/json" \
  -H "CF-Connecting-IP: 127.0.0.1" \
  -H "Idempotency-Key: demo-key-1" \
  -d '{"publicKey":"9we6kjtbcZ2vy3GSLLsZTEhbAqXPTRvEyoxa8wxSqKp5","amountSol":1}'
```

## Safety Checklist

- Devnet-only RPC via `createConnection('devnet', SOLANA_RPC_ENDPOINT?)`
- No secrets or private keys handled server-side
- Responses instruct clients to simulate before broadcast
- Structured logs redact idempotency keys (`abcd…wxyz` masking)
- Rate limiting + idempotency reduce abuse vectors

## SST References

- [Getting Test SOL](https://solana.com/cookbook/development/test-sol?utm_source=llms&utm_medium=ai&utm_campaign=txt)
- [Send SOL](https://solana.com/cookbook/transactions/send-sol?utm_source=llms&utm_medium=ai&utm_campaign=txt)
- [Add Priority Fees](https://solana.com/cookbook/transactions/add-priority-fees?utm_source=llms&utm_medium=ai&utm_campaign=txt)
- [Optimize Compute](https://solana.com/cookbook/transactions/optimize-compute?utm_source=llms&utm_medium=ai&utm_campaign=txt)
- [Solana Actions Spec](https://solana.com/docs/advanced/actions?utm_source=llms&utm_medium=ai&utm_campaign=txt)

---

**Updated:** 2025-10-23  
**Network:** Devnet only  
**Auth:** Public (no authentication required, relies on rate limiting + idempotency)
