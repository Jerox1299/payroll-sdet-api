import { test, expect } from '@playwright/test';
import { createEmployee, uniqueEmail } from '../helpers/test-data';

test.describe('REST — /employees', () => {
  test('GET /employees lists an employee created through the API', async ({ request }) => {
    const created = await createEmployee(request);

    const res = await request.get('/employees');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    const found = body.find((employee: { id: number }) => employee.id === created.id);
    expect(found).toEqual(created);
  });

  test('GET /employees/:id returns 404 for unknown id', async ({ request }) => {
    const res = await request.get('/employees/99999');
    expect(res.status()).toBe(404);
  });

  test('POST /employees creates an employee (201)', async ({ request }) => {
    const res = await request.post('/employees', {
      data: { full_name: 'Test User', email: uniqueEmail(), hourly_rate: 30 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.hourly_rate).toBe(30);
  });

  test('POST /employees rejects invalid payload (400)', async ({ request }) => {
    const res = await request.post('/employees', { data: { full_name: 'No Rate' } });
    expect(res.status()).toBe(400);
  });

  test('POST /employees rejects duplicate email (409)', async ({ request }) => {
    const existing = await createEmployee(request);

    const second = await request.post('/employees', {
      data: { full_name: 'Second', email: existing.email, hourly_rate: 22 },
    });
    expect(second.status()).toBe(409);
  });
});
