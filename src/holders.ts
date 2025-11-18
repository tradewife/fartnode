import { Connection, PublicKey } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID, type RawAccount } from '@solana/spl-token';
import { AppConfig } from './config';

type HolderBalance = {
  owner: PublicKey;
  amount: bigint;
};

export async function getFartnodeHolders(
  connection: Connection,
  config: AppConfig,
): Promise<HolderBalance[]> {
  const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    commitment: 'confirmed',
    filters: [
      { dataSize: AccountLayout.span },
      {
        memcmp: {
          offset: 0, // Mint is stored at offset 0 in SPL token accounts
          bytes: config.fartnodeMint.toBase58(),
        },
      },
    ],
  });

  const aggregated = new Map<string, HolderBalance>();

  for (const acc of accounts) {
    const decoded: RawAccount = AccountLayout.decode(acc.account.data);
    const owner = new PublicKey(decoded.owner);
    const amount = BigInt(decoded.amount.toString());
    if (amount <= BigInt(0)) {
      continue;
    }

    const key = owner.toBase58();
    const existing = aggregated.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      aggregated.set(key, { owner, amount });
    }
  }

  // Sort deterministically by owner address for reproducibility
  return Array.from(aggregated.values()).sort((a, b) =>
    a.owner.toBase58().localeCompare(b.owner.toBase58()),
  );
}

export type { HolderBalance };
