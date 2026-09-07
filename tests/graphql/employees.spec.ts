import { test, expect } from '@playwright/test';

async function gql(request: any, query: string, variables?: Record<string, unknown>) {
  return request.post('/graphql', { data: { query, variables } });
}

test.describe('GraphQL — employees', () => {
  test('employees query returns list', async ({ request }) => {
    const res = await gql(request, `query { employees { id fullName hourlyRate active } }`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.employees.length).toBeGreaterThanOrEqual(2);
  });

  test('employee(id) returns a single employee', async ({ request }) => {
    const res = await gql(request, `query($id: ID!) { employee(id: $id) { id fullName } }`, { id: '1' });
    const body = await res.json();
    expect(body.data.employee.id).toBe('1');
  });

  test('employee(id) returns null for unknown id (not an error)', async ({ request }) => {
    const res = await gql(request, `query($id: ID!) { employee(id: $id) { id } }`, { id: '99999' });
    const body = await res.json();
    expect(body.data.employee).toBeNull();
  });

  test('malformed query returns a GraphQL error, not a 500', async ({ request }) => {
    const res = await gql(request, `query { nonExistentField }`);
    const body = await res.json();
    expect(body.errors).toBeDefined();
  });
});
