import { promises as fs } from 'fs';
import path from 'path';

export type EpochSummary = {
  epochId: string;
  timestamp: string;
  solUsdPrice: number;
  claimedLamports: string;
  distributionLamports: string;
  rewardsVaultBalance: string;
  eligibleHolderCount: number;
  txSignatures: string[];
};

const DATA_DIR = path.join(process.cwd(), 'data');
const EPOCH_FILE = path.join(DATA_DIR, 'epochs.jsonl');

export async function appendEpochSummary(summary: EpochSummary): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const line = `${JSON.stringify(summary)}\n`;
  await fs.appendFile(EPOCH_FILE, line, { encoding: 'utf8' });
}

export async function readRecentEpochSummaries(limit: number): Promise<EpochSummary[]> {
  try {
    const raw = await fs.readFile(EPOCH_FILE, 'utf8');
    const lines = raw
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);

    const recent = lines.slice(-limit);
    return recent
      .map((line) => {
        try {
          return JSON.parse(line) as EpochSummary;
        } catch {
          return null;
        }
      })
      .filter((value): value is EpochSummary => value !== null)
      .reverse(); // newest first
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
