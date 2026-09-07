import { test, expect } from '@playwright/test';

// Business-rule coverage for the payroll calculation — this is the
// "requirement turned into testable scenarios" the JD asks about.
test.describe('REST — /payroll-runs (business rules)', () => {
  test('regular week (<=40h) has no overtime', async ({ request }) => {
    // Luis Gomez (seeded, id 2) worked 38h at $25/h
    const res = await request.post('/payroll-runs', {
      data: { employee_id: 2, week_start: '2026-08-24' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.overtimeHours).toBe(0);
    expect(body.regularHours).toBe(38);
    expect(body.grossPay).toBe(38 * 25);
  });

  test('week over 40h applies 1.5x overtime after hour 40', async ({ request }) => {
    // Ana Torres (seeded, id 1) worked 45h at $20/h
    const res = await request.post('/payroll-runs', {
      data: { employee_id: 1, week_start: '2026-08-24' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.regularHours).toBe(40);
    expect(body.overtimeHours).toBe(5);
    // 40*20 + 5*20*1.5 = 800 + 150 = 950
    expect(body.grossPay).toBe(950);
  });

  test('missing timesheet returns 404, not a silent zero', async ({ request }) => {
    const res = await request.post('/payroll-runs', {
      data: { employee_id: 1, week_start: '2099-01-01' },
    });
    expect(res.status()).toBe(404);
  });

  test('unknown employee returns 404', async ({ request }) => {
    const res = await request.post('/payroll-runs', {
      data: { employee_id: 99999, week_start: '2026-08-24' },
    });
    expect(res.status()).toBe(404);
  });
});
