import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * SQLite access layer.
 *
 * WHY A SINGLE MODULE-LEVEL CONNECTION
 * The default target is ':memory:', and an in-memory SQLite database belongs to the connection
 * that opened it. A second connection would open a different, empty database. The whole test
 * architecture depends on this: tests/global-setup.ts boots REST and GraphQL inside the same
 * process as the suite, so the API layer, the resolvers and tests/sql all read the same rows.
 *
 * WHY better-sqlite3 AND NOT AN ASYNC DRIVER
 * Its API is synchronous, so a query cannot be left un-awaited. In a test suite that removes a
 * whole class of tests that pass without having asserted anything.
 */

/** Set DB_FILE to persist to disk (e.g. DB_FILE=payroll.db) and inspect it with the sqlite3 CLI. */
const DB_FILE = process.env.DB_FILE ?? ':memory:';

/** The week every fixture, spec and validation query is built around. */
export const SEED_WEEK_START = '2026-08-24';

/** The preceding week, seeded only for employee 1, so a query can aggregate across periods. */
export const SEED_PREVIOUS_WEEK_START = '2026-08-17';

export const db: DatabaseType = new Database(DB_FILE);

/**
 * SQLite ignores foreign keys unless this pragma is set, and it is set per connection, not per
 * database. Without it the referential integrity test in tests/sql asserts a rule the engine never
 * applied: the query returns zero orphans because nothing ever tried to create one, not because
 * the constraint held.
 */
db.pragma('foreign_keys = ON');

/** WAL is a no-op for :memory: and a real win once DB_FILE points at a file. */
if (DB_FILE !== ':memory:') {
  db.pragma('journal_mode = WAL');
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS employees (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name   TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    hourly_rate REAL    NOT NULL CHECK (hourly_rate > 0),
    active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS timesheets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    week_start   TEXT    NOT NULL,
    hours_worked REAL    NOT NULL CHECK (hours_worked >= 0),
    UNIQUE (employee_id, week_start)
  );

  CREATE TABLE IF NOT EXISTS payroll_runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id    INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    week_start     TEXT    NOT NULL,
    regular_hours  REAL    NOT NULL,
    overtime_hours REAL    NOT NULL,
    gross_pay      REAL    NOT NULL,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_timesheets_employee_week
    ON timesheets (employee_id, week_start);

  CREATE INDEX IF NOT EXISTS idx_payroll_runs_employee_week
    ON payroll_runs (employee_id, week_start);
`;

interface SeedEmployee {
  readonly id: number;
  readonly fullName: string;
  readonly email: string;
  readonly hourlyRate: number;
  readonly active: 0 | 1;
}

/**
 * The dataset is not decorative: every row exists to make a specific test case reachable, and the
 * comment says which. A fixture whose purpose nobody can name is a fixture the next person deletes.
 *
 * Employees 1 and 2 are frozen. tests/api/payroll.spec.ts and tests/graphql/employees.spec.ts
 * assert against those ids, names and rates by hand.
 */
const SEED_EMPLOYEES: readonly SeedEmployee[] = [
  // Overtime case: 45 h at 20.00 => 40 regular + 5 overtime => 950.00 gross.
  { id: 1, fullName: 'Ana Torres', email: 'ana.torres@example.com', hourlyRate: 20.0, active: 1 },
  // Under-threshold case: 38 h at 25.00 => no overtime => 950.00 gross. Also the employee the k6
  // profile writes against.
  { id: 2, fullName: 'Luis Gomez', email: 'luis.gomez@example.com', hourlyRate: 25.0, active: 1 },
  // Exact boundary: 40 h at 18.50 => 740.00 and zero overtime. Off-by-one bugs in the threshold
  // surface here and nowhere else.
  { id: 3, fullName: 'Carla Mendez', email: 'carla.mendez@example.com', hourlyRate: 18.5, active: 1 },
  // Inactive employee who still has hours: forces "should a deactivated worker be paid" to be an
  // explicit decision rather than an accident of the query.
  { id: 4, fullName: 'Diego Rojas', email: 'diego.rojas@example.com', hourlyRate: 30.0, active: 0 },
  // Active employee with NO timesheet: the coverage gap sql/validation-queries.sql looks for.
  { id: 5, fullName: 'Elena Vargas', email: 'elena.vargas@example.com', hourlyRate: 22.0, active: 1 },
];

interface SeedTimesheet {
  readonly employeeId: number;
  readonly weekStart: string;
  readonly hoursWorked: number;
}

const SEED_TIMESHEETS: readonly SeedTimesheet[] = [
  { employeeId: 1, weekStart: SEED_WEEK_START, hoursWorked: 45.0 },
  { employeeId: 2, weekStart: SEED_WEEK_START, hoursWorked: 38.0 },
  { employeeId: 3, weekStart: SEED_WEEK_START, hoursWorked: 40.0 },
  { employeeId: 4, weekStart: SEED_WEEK_START, hoursWorked: 41.0 },
  // Employee 5 is absent on purpose.
  // A second period for employee 1, so an analytical query has more than one week to aggregate.
  { employeeId: 1, weekStart: SEED_PREVIOUS_WEEK_START, hoursWorked: 38.0 },
];

/** Creates the schema when absent. Safe to call repeatedly. */
export function migrate(): void {
  db.exec(SCHEMA_SQL);
}

/**
 * Loads the deterministic dataset.
 *
 * Idempotent by construction: it wipes the three tables and reinserts with explicit primary keys,
 * so employee 1 is Ana on the first run and on the hundredth. The previous version inserted
 * unconditionally and relied on lastInsertRowid, which made the ids that specs hard-code an
 * accident rather than a guarantee, and made a second call throw on the unique email.
 */
export function seed(): void {
  const runSeed = db.transaction(() => {
    // Child tables first: the foreign keys are enforced now.
    db.exec('DELETE FROM payroll_runs');
    db.exec('DELETE FROM timesheets');
    db.exec('DELETE FROM employees');

    // Reset the AUTOINCREMENT counters so a reseeded database is identical to a fresh one.
    const hasSequence = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`)
      .get();
    if (hasSequence !== undefined) {
      db.prepare(
        `DELETE FROM sqlite_sequence WHERE name IN ('employees', 'timesheets', 'payroll_runs')`,
      ).run();
    }

    const insertEmployee = db.prepare(
      `INSERT INTO employees (id, full_name, email, hourly_rate, active)
       VALUES (@id, @fullName, @email, @hourlyRate, @active)`,
    );
    for (const employee of SEED_EMPLOYEES) {
      insertEmployee.run(employee);
    }

    const insertTimesheet = db.prepare(
      `INSERT INTO timesheets (employee_id, week_start, hours_worked)
       VALUES (@employeeId, @weekStart, @hoursWorked)`,
    );
    for (const timesheet of SEED_TIMESHEETS) {
      insertTimesheet.run(timesheet);
    }
  });

  runSeed();
}

/**
 * Full rebuild: drops every table, recreates the schema and reloads the dataset.
 *
 * The previous version only deleted rows and never reseeded, so it handed back an empty database
 * to whatever called it. Dropping rather than truncating also means a schema change actually takes
 * effect instead of leaving the old table definition in place.
 */
export function resetDb(): void {
  db.exec(`
    DROP TABLE IF EXISTS payroll_runs;
    DROP TABLE IF EXISTS timesheets;
    DROP TABLE IF EXISTS employees;
  `);
  migrate();
  seed();
}

/** Releases the handle. Called by the global teardown. */
export function closeDb(): void {
  db.close();
}
