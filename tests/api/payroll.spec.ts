import { test, expect } from '@playwright/test';
import { SEED_WEEK_START } from '../../src/domain/calendar';
import { createEmployee, createEmployeeWithTimesheet } from '../helpers/test-data';

// Business-rule coverage for the payroll calculation — this is the
// "requirement turned into testable scenarios" the JD asks about.
// Every case builds its own employee and timesheet, so the numbers asserted
// below come from the arrange step a few lines up, not from the seed.
test.describe('REST — /payroll-runs (business rules)', () => {
  test('regular week (<=40h) has no overtime', async ({ request }) => {
    // 38 h at 25.00/h: all regular time.
    const { employee } = await createEmployeeWithTimesheet(request, {
      hourly_rate: 25,
      hours_worked: 38,
    });

    const res = await request.post('/payroll-runs', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.overtimeHours).toBe(0);
    expect(body.regularHours).toBe(38);
    expect(body.grossPay).toBe(38 * 25);
  });

  test('week over 40h applies 1.5x overtime after hour 40', async ({ request }) => {
    // 45 h at 20.00/h: 40 regular + 5 overtime.
    const { employee } = await createEmployeeWithTimesheet(request, {
      hourly_rate: 20,
      hours_worked: 45,
    });

    const res = await request.post('/payroll-runs', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.regularHours).toBe(40);
    expect(body.overtimeHours).toBe(5);
    // 40*20 + 5*20*1.5 = 800 + 150 = 950
    expect(body.grossPay).toBe(950);
  });

  test('exactly 40h is all regular time with zero overtime', async ({ request }) => {
    // The boundary itself. An off-by-one in the threshold (> versus >=) shows up here and nowhere else.
    const { employee } = await createEmployeeWithTimesheet(request, {
      hourly_rate: 18.5,
      hours_worked: 40,
    });

    const res = await request.post('/payroll-runs', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.regularHours).toBe(40);
    expect(body.overtimeHours).toBe(0);
    // 40*18.5 = 740, nothing at 1.5x
    expect(body.grossPay).toBe(740);
  });

  test('missing timesheet returns 404, not a silent zero', async ({ request }) => {
    // An employee with no hours for any week.
    const employee = await createEmployee(request);

    const res = await request.post('/payroll-runs', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START },
    });
    expect(res.status()).toBe(404);
  });

  test('unknown employee returns 404', async ({ request }) => {
    const res = await request.post('/payroll-runs', {
      data: { employee_id: 99999, week_start: SEED_WEEK_START },
    });
    expect(res.status()).toBe(404);
  });
});
