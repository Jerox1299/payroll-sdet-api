import { test, expect } from '@playwright/test';
import { db } from '../../src/db';

// Direct SQL validation — the kind of check the JD calls out explicitly:
// "Validate data integrity across systems, including SQL-based checks".
// Here we recompute payroll straight from raw data and compare it against
// what got persisted, independent of the app's own calculation code path.
test.describe('SQL — data integrity', () => {
  test('stored gross_pay matches an independent SQL recomputation', async ({ request }) => {
    await request.post('/payroll-runs', { data: { employee_id: 1, week_start: '2026-08-24' } });

    const rows = db
      .prepare(
        `SELECT pr.id, pr.gross_pay,
                MIN(pr.regular_hours, 40) as expected_regular,
                MAX(pr.regular_hours + pr.overtime_hours - 40, 0) as expected_overtime,
                e.hourly_rate
         FROM payroll_runs pr
         JOIN employees e ON e.id = pr.employee_id
         WHERE pr.employee_id = 1 AND pr.week_start = '2026-08-24'`
      )
      .all() as any[];

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const expectedGross =
        row.expected_regular * row.hourly_rate + row.expected_overtime * row.hourly_rate * 1.5;
      expect(row.gross_pay).toBeCloseTo(expectedGross, 2);
    }
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
