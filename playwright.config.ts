import path from 'path';
import { defineConfig } from '@playwright/test';

/**
 * WHY THE SUITE RUNS AGAINST A FILE AND NOT ':memory:'
 * globalSetup (and the HTTP server it boots) runs in Playwright's main process; every spec runs
 * in a worker process. An in-memory SQLite database belongs to the connection that opened it, so
 * tests/sql, which queries the database directly, would open its own empty database inside its
 * worker and fail with "no such table". Pointing DB_FILE at a file gives every process the same
 * rows.
 *
 * This module is evaluated in the main process and again in each worker, before any spec imports
 * src/db, so the assignment reaches all of them. `??=` respects a DB_FILE already set in the
 * shell; be aware that globalSetup rebuilds whatever file DB_FILE points at.
 *
 * WHY THE SUITE CAN RUN FULLY PARALLEL
 * Every test creates the rows it asserts on through the public HTTP API (tests/helpers/test-data.ts)
 * and never reads anything another test wrote, so tests may interleave in any order across any
 * number of workers. The server process is the only writer of SQLite: tests/api, tests/graphql and
 * tests/contract do not import src/db at all, and tests/sql only reads through its handle. With no
 * shared mutable state left to collide on, the workers: 1 that used to paper over it is gone.
 */
process.env.DB_FILE ??= path.resolve(__dirname, 'test.db');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
  use: {
    baseURL: 'http://localhost:4000',
  },
});
