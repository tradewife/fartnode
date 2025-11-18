import { config } from './config';
import logger from './logger';
import { createConnection, getBalance } from './solana';
import { getSolUsdPrice } from './pricing';
import { buildAndSubmitCreatorFeeClaim } from './pump';
import { getRewardsVaultBalance, topUpRewardsVault } from './rewardsVault';
import { getFartnodeHolders } from './holders';
import { filterEligibleHolders } from './eligibility';
import {
  buildDistributionTransactions,
  computePayouts,
  submitDistributionTransactions,
} from './distribution';
import { appendEpochSummary, EpochSummary } from './metrics';

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
const DUST_THRESHOLD = BigInt(10_000); // ~0.00001 SOL

export async function runEpoch(): Promise<void> {
  const cfg = config;
  const epochId = new Date().toISOString();
  const connection = createConnection(cfg.rpcEndpoint);
  const solUsdPrice = await getSolUsdPrice(cfg.priceApiUrl);

  const creatorBalanceBefore = await getBalance(connection, cfg.creatorKeypair.publicKey);
  const vaultBalanceBefore = await getRewardsVaultBalance(connection, cfg);

  const totalLamports = creatorBalanceBefore + vaultBalanceBefore;
  const preClaimUsd = lamportsToSol(totalLamports) * solUsdPrice;

  logger.info(
    {
      solUsdPrice,
      creatorBalanceBefore: creatorBalanceBefore.toString(),
      vaultBalanceBefore: vaultBalanceBefore.toString(),
      preClaimUsd,
    },
    'Pre-claim balances evaluated',
  );

  if (preClaimUsd < cfg.usdThreshold) {
    logger.info({ preClaimUsd, threshold: cfg.usdThreshold }, 'Threshold not met; skipping epoch');
    return;
  }

  const claimResult = await buildAndSubmitCreatorFeeClaim(connection, cfg);
  const distributionLamports = percentOf(claimResult.claimedLamports, cfg.distributionPercent);

  logger.info(
    {
      claimSignature: claimResult.signature,
      claimedLamports: claimResult.claimedLamports.toString(),
      distributionLamports: distributionLamports.toString(),
    },
    'Creator fees claimed',
  );

  await topUpRewardsVault(connection, cfg, distributionLamports);

  const rewardsVaultBalance = await getRewardsVaultBalance(connection, cfg);
  if (rewardsVaultBalance <= DUST_THRESHOLD) {
    logger.warn(
      { rewardsVaultBalance: rewardsVaultBalance.toString() },
      'Rewards vault balance below dust threshold; aborting distribution',
    );
    return;
  }

  const holders = await getFartnodeHolders(connection, cfg);
  const eligibleHolders = filterEligibleHolders(holders, cfg);

  if (eligibleHolders.length === 0) {
    logger.warn('No eligible holders; leaving rewards in vault');
    return;
  }

  const payouts = computePayouts(eligibleHolders, rewardsVaultBalance);
  if (payouts.length === 0) {
    logger.warn('Computed payouts are empty; leaving rewards in vault');
    return;
  }

  const txs = buildDistributionTransactions(connection, cfg, payouts);
  if (txs.length === 0) {
    logger.warn('No distribution transactions constructed; aborting');
    return;
  }

  const signatures = await submitDistributionTransactions(connection, cfg, txs);

  const summary: EpochSummary = {
    epochId,
    timestamp: new Date().toISOString(),
    solUsdPrice,
    claimedLamports: claimResult.claimedLamports.toString(),
    distributionLamports: distributionLamports.toString(),
    rewardsVaultBalance: rewardsVaultBalance.toString(),
    eligibleHolderCount: eligibleHolders.length,
    txSignatures: signatures,
  };

  await appendEpochSummary(summary);
  logger.info({ summary }, 'Epoch completed');
}

function percentOf(value: bigint, percent: number): bigint {
  if (percent <= 0) {
    return BigInt(0);
  }
  if (percent >= 1) {
    return value;
  }
  const scale = BigInt(1_000_000);
  const scaled = BigInt(Math.round(percent * Number(scale)));
  return (value * scaled) / scale;
}

function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / Number(LAMPORTS_PER_SOL);
}
