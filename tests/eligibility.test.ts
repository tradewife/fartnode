import { describe, expect, it } from '@jest/globals';
import { Keypair, PublicKey } from '@solana/web3.js';
import { filterEligibleHolders } from '../src/eligibility';
import type { HolderBalance } from '../src/holders';
import type { AppConfig } from '../src/config';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const dummyKeypair = Keypair.generate();
  return {
    rpcEndpoint: 'http://localhost',
    fartnodeMint: Keypair.generate().publicKey,
    creatorKeypair: dummyKeypair,
    rewardsVaultKeypair: Keypair.generate(),
    usdThreshold: 0,
    distributionPercent: 0.5,
    minEligibleBalance: BigInt(300_000),
    maxEligibleBalance: null,
    pumpPortalUrl: 'http://localhost',
    priceApiUrl: 'http://localhost',
    ...overrides,
  };
}

function holder(amount: bigint, owner?: PublicKey): HolderBalance {
  return { owner: owner ?? Keypair.generate().publicKey, amount };
}

describe('filterEligibleHolders', () => {
  it('excludes holders below the minimum balance', () => {
    const cfg = makeConfig({ minEligibleBalance: BigInt(300_000) });
    const holders = [holder(BigInt(100_000)), holder(BigInt(400_000))];
    const eligible = filterEligibleHolders(holders, cfg);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].amount).toBe(BigInt(400_000));
  });

  it('includes holders exactly at the minimum balance', () => {
    const cfg = makeConfig({ minEligibleBalance: BigInt(300_000) });
    const targetHolder = holder(BigInt(300_000));
    const eligible = filterEligibleHolders([targetHolder], cfg);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]).toEqual(targetHolder);
  });

  it('excludes whales when max eligible balance is configured', () => {
    const cfg = makeConfig({ maxEligibleBalance: BigInt(50_000_000) });
    const whale = holder(BigInt(51_000_000));
    const normal = holder(BigInt(1_000_000));
    const eligible = filterEligibleHolders([whale, normal], cfg);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]).toEqual(normal);
  });

  it('keeps whales when cap is disabled', () => {
    const cfg = makeConfig({ maxEligibleBalance: null });
    const whale = holder(BigInt(51_000_000));
    const eligible = filterEligibleHolders([whale], cfg);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]).toEqual(whale);
  });
});
