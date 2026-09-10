import { test, expect } from '@playwright/test';
import { SEED_WEEK_START } from '../../src/domain/calendar';
import { createEmployee, createTimesheet } from '../helpers/test-data';

test.describe('REST — /timesheets', () => {
  test('POST /timesheets creates a timesheet (201)', async ({ request }) => {
    const employee = await createEmployee(request);

    const res = await request.post('/timesheets', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START, hours_worked: 38 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.employee_id).toBe(employee.id);
    expect(body.week_start).toBe(SEED_WEEK_START);
    expect(body.hours_worked).toBe(38);
  });

  test('POST /timesheets rejects a payload without hours (400)', async ({ request }) => {
    const employee = await createEmployee(request);

    const res = await request.post('/timesheets', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /timesheets rejects negative hours (400)', async ({ request }) => {
    const employee = await createEmployee(request);

    const res = await request.post('/timesheets', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START, hours_worked: -1 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /timesheets returns 404 for unknown employee', async ({ request }) => {
    const res = await request.post('/timesheets', {
      data: { employee_id: 99999, week_start: SEED_WEEK_START, hours_worked: 40 },
    });
    expect(res.status()).toBe(404);
  });

  test('POST /timesheets rejects a second timesheet for the same employee and week (409)', async ({
    request,
  }) => {
    const employee = await createEmployee(request);
    await createTimesheet(request, { employee_id: employee.id, hours_worked: 40 });

    const second = await request.post('/timesheets', {
      data: { employee_id: employee.id, week_start: SEED_WEEK_START, hours_worked: 41 },
    });
    expect(second.status()).toBe(409);
  });
});
