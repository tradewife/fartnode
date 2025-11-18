import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'fartnode-distributor',
    env: process.env.NODE_ENV,
  },
});

export default logger;
