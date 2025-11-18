import { Connection, PublicKey, Commitment } from '@solana/web3.js';

const DEFAULT_COMMITMENT: Commitment = 'confirmed';

export function createConnection(rpcEndpoint: string): Connection {
  return new Connection(rpcEndpoint, DEFAULT_COMMITMENT);
}

export async function getBalance(connection: Connection, pubkey: PublicKey): Promise<bigint> {
  const lamports = await connection.getBalance(pubkey, DEFAULT_COMMITMENT);
  return BigInt(lamports);
}
