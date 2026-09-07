import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // shares one in-process server + DB; keep sequential for predictability
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
  use: {
    baseURL: 'http://localhost:4000',
  },
});
