import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: {
          compatibilityDate: '2024-12-12',
          compatibilityFlags: ['nodejs_compat'],
        },
      },
    },
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/test/**', '**/worker/api/routes/**', 'templates/**', 'packages/solana-core/__tests__/**', 'worker/api/controllers/__tests__/solanaController.test.ts'],
    server: {
      deps: {
        inline: ['borsh', '@solana/web3.js'],
      },
    },
  },
});
