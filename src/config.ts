import { config as loadEnv } from 'dotenv';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

loadEnv();

type AppConfig = {
  rpcEndpoint: string;
  fartnodeMint: PublicKey;
  creatorKeypair: Keypair;
  rewardsVaultKeypair: Keypair;
  usdThreshold: number;
  distributionPercent: number;
  minEligibleBalance: bigint;
  maxEligibleBalance: bigint | null;
  pumpPortalUrl: string;
  priceApiUrl: string;
};

const env = process.env;

function requireString(key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key}`);
  }
  return value;
}

function decodeKeypair(key: string): Keypair {
  const secret = requireString(key);
  try {
    const secretBytes = bs58.decode(secret);
    if (secretBytes.length !== 64) {
      throw new Error(`invalid secret length (${secretBytes.length})`);
    }
    return Keypair.fromSecretKey(secretBytes);
  } catch (error) {
    throw new Error(`Failed to decode base58 keypair for ${key}: ${(error as Error).message}`);
  }
}

function requireNumber(key: string, options?: { min?: number; max?: number }): number {
  const raw = requireString(key);
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Env var ${key} must be a number`);
  }
  if (options?.min !== undefined && value < options.min) {
    throw new Error(`Env var ${key} must be >= ${options.min}`);
  }
  if (options?.max !== undefined && value > options.max) {
    throw new Error(`Env var ${key} must be <= ${options.max}`);
  }
  return value;
}

function requireBigInt(key: string, options?: { min?: bigint }): bigint {
  const raw = requireString(key);
  try {
    const value = BigInt(raw);
    if (options?.min !== undefined && value < options.min) {
      throw new Error(`Env var ${key} must be >= ${options.min.toString()}`);
    }
    return value;
  } catch (error) {
    throw new Error(`Env var ${key} must be a bigint: ${(error as Error).message}`);
  }
}

const rpcEndpoint = requireString('RPC_ENDPOINT');
const fartnodeMint = new PublicKey(requireString('FARTNODE_MINT'));
const creatorKeypair = decodeKeypair('CREATOR_SECRET_B58');
const rewardsVaultKeypair = decodeKeypair('REWARDS_VAULT_SECRET_B58');
const usdThreshold = requireNumber('USD_THRESHOLD', { min: 0 });
const distributionPercent = requireNumber('DISTRIBUTION_PERCENT', { min: 0, max: 1 });
const minEligibleBalance = requireBigInt('MIN_ELIGIBLE_BALANCE', { min: BigInt(0) });

let maxEligibleBalance: bigint | null = null;
const rawMax = env['MAX_ELIGIBLE_BALANCE'];
if (rawMax && rawMax !== '0') {
  try {
    maxEligibleBalance = BigInt(rawMax);
  } catch (error) {
    throw new Error(`MAX_ELIGIBLE_BALANCE must be a bigint: ${(error as Error).message}`);
  }
}

const pumpPortalUrl = requireString('PUMP_PORTAL_URL');
const priceApiUrl = requireString('PRICE_API_URL');

export const config: AppConfig = {
  rpcEndpoint,
  fartnodeMint,
  creatorKeypair,
  rewardsVaultKeypair,
  usdThreshold,
  distributionPercent,
  minEligibleBalance,
  maxEligibleBalance,
  pumpPortalUrl,
  priceApiUrl,
};

export type { AppConfig };
