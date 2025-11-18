import { Connection, SystemProgram, Transaction } from '@solana/web3.js';
import { AppConfig } from './config';

export async function topUpRewardsVault(
  connection: Connection,
  config: AppConfig,
  amountLamports: bigint,
): Promise<void> {
  if (amountLamports <= BigInt(0)) {
    return;
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: config.creatorKeypair.publicKey,
      toPubkey: config.rewardsVaultKeypair.publicKey,
      lamports: safeNumber(amountLamports),
    }),
  );

  tx.feePayer = config.creatorKeypair.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.sign(config.creatorKeypair);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
}

export async function getRewardsVaultBalance(
  connection: Connection,
  config: AppConfig,
): Promise<bigint> {
  const lamports = await connection.getBalance(config.rewardsVaultKeypair.publicKey, 'confirmed');
  return BigInt(lamports);
}

function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Lamport amount exceeds Number.MAX_SAFE_INTEGER');
  }
  return Number(value);
}
