import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import { fetch } from 'undici';
import { AppConfig } from './config';
import { logger } from './logger';

type CreatorFeeResult = {
  signature: string;
  claimedLamports: bigint;
  beforeLamports: bigint;
  afterLamports: bigint;
};

type PumpPortalResponse = {
  transaction: string;
};

export async function buildAndSubmitCreatorFeeClaim(
  connection: Connection,
  config: AppConfig,
): Promise<CreatorFeeResult> {
  const creatorPubkey = config.creatorKeypair.publicKey;
  const beforeLamports = BigInt(await connection.getBalance(creatorPubkey, 'confirmed'));

  // Based on PumpPortal docs, collectCreatorFee is triggered by passing the mint + creator pubkey.
  const payload = {
    action: 'collectCreatorFee',
    mint: config.fartnodeMint.toBase58(),
    creator: creatorPubkey.toBase58(),
  };

  const response = await fetch(config.pumpPortalUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PumpPortal request failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as PumpPortalResponse;
  if (!json.transaction) {
    throw new Error('PumpPortal response missing `transaction` field');
  }

  const tx = deserializeTransaction(Buffer.from(json.transaction, 'base64'));
  signTransaction(tx, config);

  const serialized = tx.serialize();
  const signature = await connection.sendRawTransaction(serialized, {
    skipPreflight: false,
    maxRetries: 3,
  });
  logger.info({ signature }, 'Submitted creator fee claim');

  await connection.confirmTransaction(signature, 'confirmed');

  const afterLamports = BigInt(await connection.getBalance(creatorPubkey, 'confirmed'));
  const claimedLamports =
    afterLamports > beforeLamports ? afterLamports - beforeLamports : BigInt(0);

  return { signature, claimedLamports, beforeLamports, afterLamports };
}

function deserializeTransaction(buffer: Buffer): VersionedTransaction | Transaction {
  try {
    return VersionedTransaction.deserialize(buffer);
  } catch {
    return Transaction.from(buffer);
  }
}

function signTransaction(tx: VersionedTransaction | Transaction, config: AppConfig): void {
  if (tx instanceof Transaction) {
    tx.partialSign(config.creatorKeypair);
  } else {
    tx.sign([config.creatorKeypair]);
  }
}
