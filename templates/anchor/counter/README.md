# Anchor Counter Template

**Production-ready Anchor program template** demonstrating Fartnode best practices: PDAs, account validation, error handling, typed TS client, and simulate-first testing.

## Overview

This template implements a simple counter program with:

- ✓ **PDAs** (Program Derived Addresses) for deterministic account creation
- ✓ **Account validation** with ownership checks and has_one constraints
- ✓ **Error enums** with descriptive messages
- ✓ **Typed TypeScript client** with simulate-first methods
- ✓ **Comprehensive e2e tests** (11 test cases covering happy path + edge cases)
- ✓ **Upgrade authority** policy (configurable)
- ✓ **Compute budget** defaults (via solana-core integration)

## Prerequisites

Install Anchor CLI and Solana CLI:

```bash
# Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.30.1
avm use 0.30.1

# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
solana --version
```

## Quick Start

```bash
cd templates/anchor/counter

# Install dependencies
yarn install

# Build program
anchor build

# Run tests (local validator)
anchor test

# Deploy to devnet
solana config set --url devnet
anchor deploy
```

## Program Structure

### lib.rs

```rust
#[program]
pub mod counter {
    pub fn initialize(ctx: Context<Initialize>, initial_count: u64) -> Result<()>
    pub fn increment(ctx: Context<Update>) -> Result<()>
    pub fn decrement(ctx: Context<Update>) -> Result<()>
    pub fn reset(ctx: Context<Update>) -> Result<()>
}
```

**Key patterns:**

- **PDA derivation:** `[b"counter", authority.key().as_ref()]`
- **Ownership validation:** `has_one = authority @ ErrorCode::Unauthorized`
- **Overflow protection:** `checked_add()`, `checked_sub()`
- **Space calculation:** `8 + Counter::INIT_SPACE` (Anchor 0.30+ automatic)

### TypeScript Client

```typescript
import { CounterClient } from './client/counter';

const client = new CounterClient(program, provider);

// Simulate before executing
await client.simulateInitialize(authority, 0);
await client.initialize(authority, 0);

// Operations
await client.increment(authority);
const counter = await client.getCounter(authority.publicKey);
```

### Tests

11 test cases covering:

- ✓ Simulate-first flow
- ✓ Initialization (default + custom values)
- ✓ Increment/decrement/reset
- ✓ Overflow/underflow protection
- ✓ Unauthorized access prevention
- ✓ PDA correctness

## Security Model

### Default: Devnet

Per [AGENT.md](../../../AGENT.md):

- Templates default to **Devnet**
- Mainnet requires explicit confirmation
- Program IDs, signers, compute budget must be surfaced

### No Secrets

- Never log private keys
- No mnemonics in code
- Authority passed as signers only

### Account Validation

```rust
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(
        mut,
        seeds = [b"counter", authority.key().as_ref()],
        bump = counter.bump,
        has_one = authority @ ErrorCode::Unauthorized  // ✓
    )]
    pub counter: Account<'info, Counter>,
    
    pub authority: Signer<'info>,  // ✓
}
```

## Compute Budget

Integration with [@fartnode/solana-core](../../../shared/solana-core/):

```typescript
import { buildVersionedTransaction } from '@fartnode/solana-core';

// Transactions automatically include:
// - ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })
// - ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 })
```

## Customization

### Change Program ID

1. Build program: `anchor build`
2. Get program ID: `anchor keys list`
3. Update:
   - `Anchor.toml` → `[programs.devnet]`
   - `lib.rs` → `declare_id!(...)`
4. Rebuild: `anchor build`

### Add Instructions

```rust
pub fn custom_operation(ctx: Context<Update>, value: u64) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.count = value;
    msg!("Counter set to: {}", value);
    Ok(())
}
```

### Add Account Fields

```rust
#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub authority: Pubkey,
    pub count: u64,
    pub bump: u8,
    #[max_len(32)]  // New field
    pub label: String,
}
```

## Deployment

### Devnet

```bash
solana config set --url devnet
solana airdrop 2

anchor build
anchor deploy

# Verify
solana program show <PROGRAM_ID>
```

### Mainnet (Requires Approval)

Per AGENT.md, mainnet deployment requires:

1. Explicit user confirmation
2. Dry-run with program ID, upgrade authority, compute budget surfaced
3. Keypair with sufficient SOL (deployment cost ~2-5 SOL)

```bash
# DO NOT RUN without approval
solana config set --url mainnet-beta
anchor build --verifiable
anchor deploy --provider.cluster mainnet
```

## References (SST)

- [Intro to Anchor](https://solana.com/courses/onchain-development/intro-to-anchor) — Core concepts
- [Anchor PDAs](https://solana.com/courses/onchain-development/anchor-pdas) — Program Derived Addresses
- [Anchor CPIs](https://solana.com/courses/onchain-development/anchor-cpi) — Cross-Program Invocations
- [Program Security](https://solana.com/courses/native-onchain-development/program-security) — Validation checks
- [Solana Cookbook](https://solana.com/cookbook/) — Examples

## Testing

```bash
# Run all tests
anchor test

# Run with logs
anchor test -- --nocapture

# Specific test
anchor test -- --test counter::increments_counter
```

**Test coverage:**

- ✓ Initialize with zero/custom value
- ✓ Increment/decrement operations
- ✓ Reset to zero
- ✓ Overflow/underflow edge cases
- ✓ Unauthorized access attempts
- ✓ PDA derivation correctness

## Next Steps

1. **Add CPI** — Call other programs (e.g., Token Program for SPL tokens)
2. **Add Events** — Emit logs for off-chain indexing
3. **Add Permissioned Roles** — Admin/user role separation
4. **Add State Versioning** — Upgrade-safe account migrations
5. **Add Rate Limiting** — Per-user operation limits

## Integration with Fartnode

This template integrates with Fartnode's Solana core:

```typescript
import { createConnection } from '@fartnode/solana-core';
import { CounterClient } from './client/counter';

const connection = createConnection('devnet');
const provider = new AnchorProvider(connection, wallet, {});
const client = new CounterClient(program, provider);
```

---

**Template Version:** 0.1.0  
**Anchor Version:** 0.30.1  
**Network Default:** Devnet  
**License:** MIT
