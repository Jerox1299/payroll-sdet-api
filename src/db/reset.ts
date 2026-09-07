import { closeDb, db, resetDb, SEED_WEEK_START } from './index';

/**
 * Standalone entry point behind `npm run db:reset`.
 *
 * Only meaningful with DB_FILE set: rebuilding an in-memory database from a separate process
 * produces one that dies with the process. It exists so a file-backed database can be rebuilt
 * before inspecting it with the sqlite3 CLI or running sql/validation-queries.sql against it.
 */
function main(): void {
  const target = process.env.DB_FILE ?? ':memory:';

  resetDb();

  const employees = db.prepare('SELECT COUNT(*) AS total FROM employees').get() as { total: number };
  const timesheets = db.prepare('SELECT COUNT(*) AS total FROM timesheets').get() as {
    total: number;
  };

  process.stdout.write(
    `Database reset. target=${target} employees=${employees.total} ` +
      `timesheets=${timesheets.total} week=${SEED_WEEK_START}\n`,
  );

  if (target === ':memory:') {
    process.stdout.write(
      'Warning: DB_FILE is not set, so this in-memory database is discarded on exit.\n',
    );
  }

  closeDb();
}

main();
