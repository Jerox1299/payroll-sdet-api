/**
 * Calendar constants shared by the seed, the standalone reset script and the test suite.
 *
 * WHY THIS LIVES OUTSIDE src/db
 * src/db opens the SQLite connection and runs its pragmas the moment it is imported. A spec that
 * only wanted the seed week would drag all of that into its worker process. Keeping the constants
 * in a module with no side effects lets tests/api, tests/graphql and tests/contract stay pure HTTP
 * clients: the server process is the only writer of SQLite, and the only other holder of a
 * connection is tests/sql, whose job is to query the database directly.
 */

/** The week every fixture, spec and validation query is built around. */
export const SEED_WEEK_START = '2026-08-24';

/** The preceding week, seeded only for employee 1, so a query can aggregate across periods. */
export const SEED_PREVIOUS_WEEK_START = '2026-08-17';
