import path from 'path';
import { defineConfig } from '@playwright/test';

/**
 * WHY THE SUITE RUNS AGAINST A FILE AND NOT ':memory:'
 * globalSetup (and the HTTP server it boots) runs in Playwright's main process; every spec runs
 * in a worker process. An in-memory SQLite database belongs to the connection that opened it, so
 * a worker importing src/db would open its own empty database and tests/sql would fail with
 * "no such table". Pointing DB_FILE at a file gives every process the same rows.
 *
 * This module is evaluated in the main process and again in each worker, before any spec imports
 * src/db, so the assignment reaches all of them. `??=` respects a DB_FILE already set in the
 * shell; be aware that globalSetup rebuilds whatever file DB_FILE points at.
 */
process.env.DB_FILE ??= path.resolve(__dirname, 'test.db');

export default defineConfig({
  testDir: './tests',
  // Every spec file talks to the single server and database booted by globalSetup.
  // fullyParallel: false only serialises the tests *inside* a file; workers: 1 is what stops
  // spec files from interleaving writes against the shared payroll_runs table.
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
  use: {
    baseURL: 'http://localhost:4000',
  },
});
