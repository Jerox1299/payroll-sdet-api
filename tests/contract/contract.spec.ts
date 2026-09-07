import { test, expect } from '@playwright/test';
import { EmployeeSchema, PayrollRunSchema } from './schemas';

// Lightweight contract testing: validates the REST response shape against
// a schema both sides agree on, instead of a broker like Pact. Documented
// in the README as a lighter-weight stand-in — Pact is the natural next step
// if this needs to be shared with a real consumer team.
test.describe('Contract — response schema validation', () => {
  test('GET /employees matches the Employee contract', async ({ request }) => {
    const res = await request.get('/employees');
    const body = await res.json();
    for (const employee of body) {
      const result = EmployeeSchema.safeParse(employee);
      expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBeTruthy();
    }
  });

  test('POST /payroll-runs matches the PayrollRun contract', async ({ request }) => {
    const res = await request.post('/payroll-runs', {
      data: { employee_id: 2, week_start: '2026-08-24' },
    });
    const body = await res.json();
    const result = PayrollRunSchema.safeParse(body);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBeTruthy();
  });
});
