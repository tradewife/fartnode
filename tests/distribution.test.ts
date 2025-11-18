import { describe, expect, it } from '@jest/globals';
import { Keypair } from '@solana/web3.js';
import { computePayouts } from '../src/distribution';
import { HolderBalance } from '../src/holders';

function holder(amount: bigint): HolderBalance {
  return {
    owner: Keypair.generate().publicKey,
    amount,
  };
}

describe('computePayouts', () => {
  it('splits rewards evenly for equal balances', () => {
    const holders = [holder(BigInt(1_000_000)), holder(BigInt(1_000_000))];
    const balance = BigInt(1_000_000_000);
    const payouts = computePayouts(holders, balance);
    expect(payouts).toHaveLength(2);
    expect(payouts[0].lamports).toBe(BigInt(500_000_000));
    expect(payouts[1].lamports).toBe(BigInt(500_000_000));
  });

  it('handles uneven balances with integer division and keeps residual in vault', () => {
    const holders = [
      holder(BigInt(1_000_000)),
      holder(BigInt(2_000_000)),
      holder(BigInt(3_000_000)),
    ];
    const balance = BigInt(1_000_000_001);
    const payouts = computePayouts(holders, balance);
    const total = payouts.reduce((sum, payout) => sum + payout.lamports, BigInt(0));
    expect(total).toBeLessThanOrEqual(balance);

    // Shares: 1/6, 2/6, 3/6
    expect(payouts[0].lamports).toBe(BigInt(166_666_666));
    expect(payouts[1].lamports).toBe(BigInt(333_333_333));
    expect(payouts[2].lamports).toBe(BigInt(500_000_000));
  });

  it('returns empty array if vault balance is zero', () => {
    const holders = [holder(BigInt(1_000_000))];
    const payouts = computePayouts(holders, BigInt(0));
    expect(payouts).toEqual([]);
  });
});
