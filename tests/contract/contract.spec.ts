import { test, expect } from '@playwright/test';
import { SEED_WEEK_START } from '../../src/domain/calendar';
import { createEmployee, createEmployeeWithTimesheet } from '../helpers/test-data';
import { EmployeeSchema, PayrollRunSchema, TimesheetSchema } from './schemas';

// Lightweight contract testing: validates the REST response shape against
// a schema both sides agree on, instead of a broker like Pact. Documented
// in the README as a lighter-weight stand-in — Pact is the natural next step
// if this needs to be shared with a real consumer team.
test.describe('Contract — response schema validation', () => {
  test('GET /employees matches the Employee contract', async ({ request }) => {
    // Own row first: an empty list would otherwise pass the loop below without validating anything.
    const created = await createEmployee(request);

    const res = await request.get('/employees');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.map((employee: { id: number }) => employee.id)).toContain(created.id);

    // Deliberate: the contract is validated over every row the endpoint returns, not only the one
    // this test created. A row written by another spec that breaks the shape is a contract
    // violation too, and this is the test that should catch it.
    for (const employee of body) {
      const result = EmployeeSchema.safeParse(employee);
      expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBeTruthy();
    }
  });

  test('POST /timesheets matches the Timesheet contract', async ({ request }) => {
    const employee = await createEmployee(request);

    const res = await request.post('/timesheets', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START, hours_worked: 40 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const result = TimesheetSchema.safeParse(body);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBeTruthy();
  });

  test('POST /payroll-runs matches the PayrollRun contract', async ({ request }) => {
    const { employee } = await createEmployeeWithTimesheet(request, {
      hourly_rate: 25,
      hours_worked: 38,
    });

    const res = await request.post('/payroll-runs', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    const result = PayrollRunSchema.safeParse(body);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBeTruthy();
  });
});
