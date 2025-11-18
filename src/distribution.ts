import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AppConfig } from './config';
import { HolderBalance } from './holders';

export type Payout = {
  owner: PublicKey;
  lamports: bigint;
};

const INSTRUCTIONS_PER_TX = 12;

export function computePayouts(
  eligibleHolders: HolderBalance[],
  rewardsVaultBalance: bigint,
): Payout[] {
  if (rewardsVaultBalance <= BigInt(0)) {
    return [];
  }

  const totalEligibleTokens = eligibleHolders.reduce(
    (sum, holder) => sum + holder.amount,
    BigInt(0),
  );

  if (totalEligibleTokens === BigInt(0)) {
    return [];
  }

  const payouts = eligibleHolders.map((holder) => {
    const lamports = (rewardsVaultBalance * holder.amount) / totalEligibleTokens;
    return { owner: holder.owner, lamports };
  });

  return payouts.filter((payout) => payout.lamports > BigInt(0));
}

export function buildDistributionTransactions(
  _connection: Connection,
  config: AppConfig,
  payouts: Payout[],
): Transaction[] {
  if (payouts.length === 0) {
    return [];
  }

  const txs: Transaction[] = [];
  let current = new Transaction();
  let count = 0;

  for (const payout of payouts) {
    const ix = SystemProgram.transfer({
      fromPubkey: config.rewardsVaultKeypair.publicKey,
      toPubkey: payout.owner,
      lamports: safeNumber(payout.lamports),
    });

    current.add(ix);
    count += 1;

    if (count >= INSTRUCTIONS_PER_TX) {
      txs.push(current);
      current = new Transaction();
      count = 0;
    }
  }

  if (count > 0) {
    txs.push(current);
  }

  return txs;
}

export async function submitDistributionTransactions(
  connection: Connection,
  config: AppConfig,
  txs: Transaction[],
): Promise<string[]> {
  const signatures: string[] = [];
  for (const tx of txs) {
    tx.feePayer = config.rewardsVaultKeypair.publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.sign(config.rewardsVaultKeypair);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed',
    );
    signatures.push(signature);
  }
  return signatures;
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Lamport amount exceeds JS safe integer range');
  }
  return Number(value);
}
