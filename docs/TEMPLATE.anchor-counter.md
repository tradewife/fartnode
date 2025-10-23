# Anchor Counter Template Guide

## Purpose

The **Anchor Counter Template** is a production-ready scaffold demonstrating Solana program development best practices per [AGENT.md](../../AGENT.md). It serves as:

1. **Learning resource** — Shows PDAs, validation, error handling, testing
2. **Starting point** — Fork and extend for custom programs
3. **Reference implementation** — Type-safe client + simulate-first patterns

## What's Included

### Program (Rust)

- **lib.rs** — 4 instructions (initialize, increment, decrement, reset)
- **PDAs** — Counter account derived from authority
- **Validation** — Ownership checks, signer verification
- **Errors** — Custom error enum (Overflow, Underflow, Unauthorized)
- **Space** — Automatic via `InitSpace` derive macro

### Client (TypeScript)

- **CounterClient** — Typed wrapper around Anchor program
- **Simulate methods** — Pre-flight validation before RPC calls
- **Account queries** — Fetch counter state by authority

### Tests (TypeScript + Mocha)

- **11 test cases** covering:
  - Initialize (default + custom)
  - Operations (increment/decrement/reset)
  - Edge cases (overflow/underflow)
  - Security (unauthorized access, PDA correctness)

## Architecture

```
templates/anchor/counter/
├── Anchor.toml           # Anchor workspace config
├── Cargo.toml            # Rust workspace
├── programs/
│   └── counter/
│       ├── Cargo.toml    # Program dependencies
│       ├── Xargo.toml    # BPF build config
│       └── src/
│           └── lib.rs    # Program logic (103 lines)
├── client/
│   └── counter.ts        # Typed TS client (138 lines)
├── tests/
│   └── counter.test.ts   # E2E tests (179 lines)
├── package.json
├── tsconfig.json
└── README.md
```

## Key Patterns

### 1. PDA Derivation

```rust
#[account(
    init,
    payer = authority,
    space = 8 + Counter::INIT_SPACE,
    seeds = [b"counter", authority.key().as_ref()],  // ✓
    bump
)]
pub counter: Account<'info, Counter>,
```

**TypeScript equivalent:**

```typescript
getCounterAddress(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('counter'), authority.toBuffer()],
        this.program.programId,
    );
}
```

### 2. Account Validation

```rust
#[account(
    mut,
    seeds = [b"counter", authority.key().as_ref()],
    bump = counter.bump,
    has_one = authority @ ErrorCode::Unauthorized  // ✓ Ownership check
)]
pub counter: Account<'info, Counter>,
```

### 3. Overflow Protection

```rust
counter.count = counter
    .count
    .checked_add(1)                     // ✓ Safe arithmetic
    .ok_or(ErrorCode::Overflow)?;
```

### 4. Simulate-First Flow

```typescript
// Validate before sending
await client.simulateInitialize(authority, 0);

// Execute
await client.initialize(authority, 0);
```

## Usage Examples

### Initialize Counter

```typescript
import { CounterClient } from './client/counter';
import { AnchorProvider } from '@coral-xyz/anchor';

const provider = AnchorProvider.env();
const client = new CounterClient(program, provider);

const authority = anchor.web3.Keypair.generate();

// Simulate first
await client.simulateInitialize(authority, 0);

// Execute
const tx = await client.initialize(authority, 0);
console.log('Initialized:', tx);
```

### Increment Counter

```typescript
const tx = await client.increment(authority);

const counter = await client.getCounter(authority.publicKey);
console.log('Count:', counter.count.toNumber());
```

### Error Handling

```typescript
try {
    await client.increment(wrongAuthority);
} catch (error) {
    console.error('Unauthorized:', error.message);
}
```

## Testing Strategy

Per [AGENT.md](../../AGENT.md), all tests:

- ✓ Use **simulate-first** before RPC calls
- ✓ Run on **local validator** (not devnet)
- ✓ Cover **happy path + edge cases**
- ✓ Validate **security constraints**

### Running Tests

```bash
cd templates/anchor/counter

# Start local validator + run tests
anchor test

# With detailed logs
anchor test -- --nocapture

# Specific test
yarn run ts-mocha tests/counter.test.ts -g "increments counter"
```

## Customization Guide

### Add New Instruction

1. Add instruction to `lib.rs`:

```rust
pub fn set_value(ctx: Context<Update>, value: u64) -> Result<()> {
    ctx.accounts.counter.count = value;
    Ok(())
}
```

2. Add client method:

```typescript
async setValue(authority: Keypair, value: number): Promise<string> {
    const [counterPda] = this.getCounterAddress(authority.publicKey);
    return await this.program.methods
        .setValue(new anchor.BN(value))
        .accounts({ counter: counterPda, authority: authority.publicKey })
        .signers([authority])
        .rpc();
}
```

3. Add test:

```typescript
it('sets custom value', async () => {
    await client.setValue(authority, 999);
    const counter = await client.getCounter(authority.publicKey);
    expect(counter!.count.toNumber()).to.equal(999);
});
```

### Add Account Field

1. Update struct:

```rust
#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub authority: Pubkey,
    pub count: u64,
    pub bump: u8,
    #[max_len(32)]
    pub label: String,  // New field
}
```

2. Update initialization:

```rust
pub fn initialize(ctx: Context<Initialize>, initial_count: u64, label: String) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.label = label;
    // ...
}
```

## Security Checklist

- [x] Never log private keys or mnemonics
- [x] Validate all signers (`Signer<'info>`)
- [x] Check account ownership (`has_one = authority`)
- [x] Use PDAs for deterministic addresses
- [x] Protect against overflow/underflow (`checked_*`)
- [x] Set proper account space (8 + InitSpace)
- [x] Default to Devnet (mainnet requires approval)

## Integration with Solana Core

```typescript
import { createConnection, buildVersionedTransaction } from '@fartnode/solana-core';
import { CounterClient } from './client/counter';

const connection = createConnection('devnet');
const provider = new AnchorProvider(connection, wallet, {});
const client = new CounterClient(program, provider);

// Transactions automatically include priority fees + compute budget
```

## Deployment Checklist

### Devnet

- [ ] Build: `anchor build`
- [ ] Get program ID: `anchor keys list`
- [ ] Update `Anchor.toml` and `declare_id!()`
- [ ] Rebuild: `anchor build`
- [ ] Deploy: `anchor deploy`
- [ ] Verify: `solana program show <PROGRAM_ID>`

### Mainnet (Requires Approval)

Per AGENT.md:

- [ ] Get explicit user confirmation
- [ ] Surface: program ID, upgrade authority, compute budget
- [ ] Use `--verifiable` build
- [ ] Document deployment cost (~2-5 SOL)
- [ ] Set keypair with sufficient balance

## References (SST)

All patterns follow official Solana documentation:

- [Intro to Anchor](https://solana.com/courses/onchain-development/intro-to-anchor)
- [Anchor PDAs and Accounts](https://solana.com/courses/onchain-development/anchor-pdas)
- [Anchor CPIs and Errors](https://solana.com/courses/onchain-development/anchor-cpi)
- [Program Security](https://solana.com/courses/native-onchain-development/program-security)
- [Hello World Program](https://solana.com/courses/native-onchain-development/hello-world-program)

## FAQ

**Q: Can I use this for production?**  
A: Yes, but audit security constraints and add rate limiting/access controls as needed.

**Q: How do I change the PDA seeds?**  
A: Update seeds in both Rust (`seeds = [...]`) and TypeScript (`findProgramAddressSync`). Rebuild and redeploy.

**Q: How do I add SPL token support?**  
A: Add `anchor-spl` dependency, import Token/Mint types, and use CPI to call Token Program.

**Q: Can I use this without Anchor CLI?**  
A: No, Anchor CLI is required for building Solana programs with the Anchor framework.

---

**Updated:** 2025-10-23  
**Anchor Version:** 0.30.1  
**Default Network:** Devnet
