import { test, expect } from '@playwright/test';

test.describe('REST — /employees', () => {
  test('GET /employees returns seeded employees', async ({ request }) => {
    const res = await request.get('/employees');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  test('GET /employees/:id returns 404 for unknown id', async ({ request }) => {
    const res = await request.get('/employees/99999');
    expect(res.status()).toBe(404);
  });

  test('POST /employees creates an employee (201)', async ({ request }) => {
    const res = await request.post('/employees', {
      data: { full_name: 'Test User', email: `test.${Date.now()}@example.com`, hourly_rate: 30 },
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
    const email = `dup.${Date.now()}@example.com`;
    const first = await request.post('/employees', {
      data: { full_name: 'First', email, hourly_rate: 20 },
    });
    expect(first.status()).toBe(201);

    const second = await request.post('/employees', {
      data: { full_name: 'Second', email, hourly_rate: 22 },
    });
    expect(second.status()).toBe(409);
  });
});
