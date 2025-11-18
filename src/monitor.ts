import express from 'express';
import logger from './logger';
import { readRecentEpochSummaries, EpochSummary } from './metrics';

const PORT = Number(process.env.MONITOR_PORT ?? 8787);
const app = express();

app.get('/', async (_req, res) => {
  try {
    const summaries = await readRecentEpochSummaries(50);
    res.type('html').send(renderHtml(summaries));
  } catch (error) {
    logger.error({ err: error }, 'Failed to load epoch summaries');
    res.status(500).send('Error loading summaries');
  }
});

app.get('/metrics.json', async (_req, res) => {
  try {
    const summaries = await readRecentEpochSummaries(50);
    res.json(summaries);
  } catch (error) {
    logger.error({ err: error }, 'Failed to load epoch summaries (json)');
    res.status(500).json({ error: 'Failed to read summaries' });
  }
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Monitoring UI started');
});

function renderHtml(summaries: EpochSummary[]): string {
  const rows = summaries
    .map((summary) => {
      const claimed = lamportsToSol(summary.claimedLamports);
      const distribution = lamportsToSol(summary.distributionLamports);
      const vault = lamportsToSol(summary.rewardsVaultBalance);
      return `<tr>
        <td>${summary.epochId}</td>
        <td>${summary.timestamp}</td>
        <td>${claimed.toFixed(6)}</td>
        <td>${distribution.toFixed(6)}</td>
        <td>${vault.toFixed(6)}</td>
        <td>${summary.eligibleHolderCount}</td>
        <td>${summary.txSignatures.length}</td>
      </tr>`;
    })
    .join('\\n');

  const emptyRow = '<tr><td colspan="7">No epochs recorded</td></tr>';
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>FARTNODE Epochs</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #0d1117; color: #c9d1d9; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #30363d; padding: 8px; }
          th { background: #161b22; }
          tr:nth-child(even) { background: #1c2128; }
        </style>
      </head>
      <body>
        <h1>FARTNODE Epoch Summaries</h1>
        <table>
          <thead>
            <tr>
              <th>Epoch ID</th>
              <th>Timestamp</th>
              <th>Claimed SOL</th>
              <th>Distributed SOL</th>
              <th>Vault SOL</th>
              <th>Eligible Holders</th>
              <th>Tx Count</th>
            </tr>
          </thead>
          <tbody>
            ${rows || emptyRow}
          </tbody>
        </table>
      </body>
    </html>`;
}

function lamportsToSol(value: string): number {
  return Number(BigInt(value)) / 1_000_000_000;
}
