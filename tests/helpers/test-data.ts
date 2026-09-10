import { randomUUID } from 'crypto';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { SEED_WEEK_START } from '../../src/domain/calendar';

/**
 * The only module under tests/ that knows how to create test data.
 *
 * Every spec arranges its own rows through the public HTTP API, so no test depends on what another
 * spec or the seed left behind, and the server process is the only writer of SQLite. tests/api,
 * tests/graphql and tests/contract never import src/db at all. Keep it that way: a spec that needs
 * a new kind of row adds a function here, not an INSERT in the spec.
 *
 * RULE: no spec may call seed() or resetDb() from src/db. tests/global-setup.ts runs resetDb()
 * once, before any worker starts. The suite runs fully parallel, so calling either from a spec
 * would wipe rows that other tests are using at that very moment, and the failure would land on
 * whichever of them happened to be mid-flight.
 *
 * WHY randomUUID() FOR EMAIL UNIQUENESS
 * employees.email is UNIQUE. Date.now() collides when two tests run inside the same millisecond,
 * and test.info().testId is stable across retries, so a retried test would collide with the email
 * its own previous attempt already inserted. A UUID is unique per call regardless of timing.
 */

export interface Employee {
  id: number;
  full_name: string;
  email: string;
  hourly_rate: number;
  active: 0 | 1;
}

export interface Timesheet {
  id: number;
  employee_id: number;
  week_start: string;
  hours_worked: number;
}

export function uniqueEmail(prefix = 'test'): string {
  return `${prefix}.${randomUUID()}@example.com`;
}

/** Fails the test with the server's own response when the arrange step itself breaks. */
async function expectCreated<T>(res: APIResponse, what: string): Promise<T> {
  const text = await res.text();
  expect(res.status(), `arrange: ${what} returned ${res.status()}: ${text}`).toBe(201);
  return JSON.parse(text) as T;
}

export async function createEmployee(
  request: APIRequestContext,
  overrides: Partial<Pick<Employee, 'full_name' | 'hourly_rate'>> = {},
): Promise<Employee> {
  const res = await request.post('/employees', {
    data: {
      full_name: overrides.full_name ?? 'Test Employee',
      email: uniqueEmail(),
      hourly_rate: overrides.hourly_rate ?? 20,
    },
  });
  return expectCreated<Employee>(res, 'POST /employees');
}

export interface TimesheetInput {
  employee_id: number;
  hours_worked: number;
  /** Defaults to the seed week. Any week works for a freshly created employee. */
  week_start?: string;
}

export async function createTimesheet(
  request: APIRequestContext,
  input: TimesheetInput,
): Promise<Timesheet> {
  const res = await request.post('/timesheets', {
    data: {
      employee_id: input.employee_id,
      week_start: input.week_start ?? SEED_WEEK_START,
      hours_worked: input.hours_worked,
    },
  });
  return expectCreated<Timesheet>(res, 'POST /timesheets');
}

export interface PayrollScenario {
  hourly_rate: number;
  hours_worked: number;
  week_start?: string;
}

/** One employee with exactly one timesheet: the arrange step every payroll-run test starts from. */
export async function createEmployeeWithTimesheet(
  request: APIRequestContext,
  scenario: PayrollScenario,
): Promise<{ employee: Employee; timesheet: Timesheet }> {
  const employee = await createEmployee(request, { hourly_rate: scenario.hourly_rate });
  const timesheet = await createTimesheet(request, {
    employee_id: employee.id,
    hours_worked: scenario.hours_worked,
    week_start: scenario.week_start,
  });
  return { employee, timesheet };
}
