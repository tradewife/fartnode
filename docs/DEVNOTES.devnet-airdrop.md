# Devnet Airdrop Action - Developer Notes

## Overview

The `devnet-airdrop` Action demonstrates Solana Actions/Blinks integration with Fartnode. It provides a public API endpoint that composes versioned transactions for requesting test SOL on Devnet.

## Endpoints

### GET `/api/solana/actions/devnet-airdrop`

Returns Action metadata describing the endpoint's purpose, inputs, and UI hints.

**Response:**

```json
{
  "title": "Devnet SOL Airdrop",
  "description": "Request test SOL on Solana Devnet. Returns a versioned transaction with priority fees and compute budget.",
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
  ]
}
```

**cURL example:**

```bash
curl -X GET https://your-fartnode-worker.dev/api/solana/actions/devnet-airdrop
```

---

### POST `/api/solana/actions/devnet-airdrop`

Composes a versioned transaction for the airdrop request.

**Request Body:**

```json
{
  "account": "9we6kjtbcZ2vy3GSLLsZTEhbAqXPTRvEyoxa8wxSqKp5",
  "amountSol": 1.5
}
```

**Response (Success):**

```json
{
  "transaction": "<base64-encoded-versioned-transaction>",
  "message": "Devnet airdrop transaction for 1.5 SOL. Network: devnet. Simulate before broadcasting!"
}
```

**Response (Error):**

```json
{
  "error": {
    "message": "Invalid Solana public key format."
  }
}
```

**cURL example:**

```bash
curl -X POST https://your-fartnode-worker.dev/api/solana/actions/devnet-airdrop \
  -H "Content-Type: application/json" \
  -d '{
    "account": "9we6kjtbcZ2vy3GSLLsZTEhbAqXPTRvEyoxa8wxSqKp5",
    "amountSol": 1
  }'
```

---

## Transaction Composition

The endpoint uses `@fartnode/solana-core` utilities to:

1. **Validate inputs:** Ensures `publicKey` is valid base58 and `amountSol` is within bounds (0.1–2 SOL)
2. **Fetch blockhash:** Retrieves latest blockhash from Devnet RPC
3. **Build instruction:** Creates a `SystemProgram.transfer` stub (0 lamports; this is a demonstration)
4. **Add compute budget:** Prepends `ComputeBudgetProgram` instructions for unit limit (5000) and price (5000 microlamports)
5. **Compose versioned transaction:** Uses `TransactionMessage.compileToV0Message()`
6. **Serialize to base64:** Returns transaction ready for signing

## Safety

- **Network:** Hardcoded to `devnet`. No mainnet risk.
- **Simulate-first:** Response message reminds users to simulate before broadcasting.
- **No secrets:** Endpoint is public; no private keys involved.
- **Idempotency:** Future enhancement; consider adding idempotency headers for production.

## Priority Fees & Compute Budget

Default presets (defined in `@fartnode/solana-core`):

- **Priority fee:** 5000 microlamports
- **Compute unit limit:** 5000 (minimal; override for complex transactions)

Override via `computeBudget` parameter in `buildVersionedTransaction()`.

## Toggling Presets

Edit defaults in:

- [`vibesdk/shared/solana-core/src/fees.ts`](file:///home/kt/Desktop/FARTNODE-V0/vibesdk/shared/solana-core/src/fees.ts)
- [`vibesdk/shared/solana-core/src/compute.ts`](file:///home/kt/Desktop/FARTNODE-V0/vibesdk/shared/solana-core/src/compute.ts)

Or pass custom configs when calling `buildVersionedTransaction()`:

```typescript
const transaction = await buildVersionedTransaction({
  payer: recipientPubkey,
  blockhash,
  instructions: [ix],
  computeBudget: {
    units: 50000,
    microLamports: 10000,
  },
});
```

## Testing Locally

1. Start local Worker:

```bash
cd vibesdk
bun run dev
```

2. Test GET endpoint:

```bash
curl http://localhost:8787/api/solana/actions/devnet-airdrop
```

3. Test POST endpoint:

```bash
curl -X POST http://localhost:8787/api/solana/actions/devnet-airdrop \
  -H "Content-Type: application/json" \
  -d '{"account":"9we6kjtbcZ2vy3GSLLsZTEhbAqXPTRvEyoxa8wxSqKp5","amountSol":1}'
```

4. Decode transaction (optional):

```bash
echo "<base64-transaction>" | base64 -d | xxd
```

## References (SST)

- [Getting Test SOL](https://solana.com/cookbook/development/test-sol)
- [Send SOL](https://solana.com/cookbook/transactions/send-sol)
- [Priority Fees](https://solana.com/cookbook/transactions/add-priority-fees)
- [Optimize Compute](https://solana.com/cookbook/transactions/optimize-compute)
- [Intro to Solana](https://solana.com/courses/intro-to-solana/)

---

**Updated:** 2025-10-23  
**Network:** Devnet only  
**Auth:** Public (no authentication required)
