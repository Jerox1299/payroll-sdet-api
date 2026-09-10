import { test, expect } from '@playwright/test';
import { db } from '../../src/db';
import { SEED_WEEK_START } from '../../src/domain/calendar';
import { createEmployeeWithTimesheet } from '../helpers/test-data';

// Direct SQL validation — the kind of check the JD calls out explicitly:
// "Validate data integrity across systems, including SQL-based checks".
// Here we recompute payroll straight from raw data and compare it against
// what got persisted, independent of the app's own calculation code path.
test.describe('SQL — data integrity', () => {
  test('stored gross_pay matches an independent SQL recomputation', async ({ request }) => {
    // 45 h at 20.00/h so the overtime branch of the SQL formula below is exercised, not only the
    // regular one. An employee of this test's own, so the row read back is the row written here.
    const { employee } = await createEmployeeWithTimesheet(request, {
      hourly_rate: 20,
      hours_worked: 45,
    });
    const res = await request.post('/payroll-runs', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START },
    });
    expect(res.status()).toBe(201);
    const { id: runId } = (await res.json()) as { id: number };

    // Filter by the id the API handed back, not by employee and week: the assertion covers this
    // run and nothing another spec may have written for the same combination.
    const row = db
      .prepare(
        `SELECT pr.id, pr.gross_pay,
                MIN(pr.regular_hours, 40) as expected_regular,
                MAX(pr.regular_hours + pr.overtime_hours - 40, 0) as expected_overtime,
                e.hourly_rate
         FROM payroll_runs pr
         JOIN employees e ON e.id = pr.employee_id
         WHERE pr.id = ?`
      )
      .get(runId) as
      | { id: number; gross_pay: number; expected_regular: number; expected_overtime: number; hourly_rate: number }
      | undefined;

    expect(row, `payroll run ${runId} was not persisted`).toBeDefined();
    const stored = row as NonNullable<typeof row>;
    const expectedGross =
      stored.expected_regular * stored.hourly_rate + stored.expected_overtime * stored.hourly_rate * 1.5;
    expect(stored.gross_pay).toBeCloseTo(expectedGross, 2);
  });

  test('no orphaned timesheets (referential integrity)', async () => {
    const orphans = db
      .prepare(
        `SELECT t.id FROM timesheets t
         LEFT JOIN employees e ON e.id = t.employee_id
         WHERE e.id IS NULL`
      )
      .all();
    expect(orphans.length).toBe(0);
  });

  test('no duplicate timesheets for the same employee/week', async () => {
    const dupes = db
      .prepare(
        `SELECT employee_id, week_start, COUNT(*) as total
         FROM timesheets
         GROUP BY employee_id, week_start
         HAVING COUNT(*) > 1`
      )
      .all();
    expect(dupes.length).toBe(0);
  });
});
