import logger from './logger';
import { runEpoch } from './epoch';

async function main(): Promise<void> {
  const epochId = new Date().toISOString();
  logger.info({ epochId }, 'Starting FARTNODE epoch');
  await runEpoch();
  logger.info({ epochId }, 'Finished FARTNODE epoch');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error({ err: error }, 'Epoch failed');
    process.exit(1);
  });
