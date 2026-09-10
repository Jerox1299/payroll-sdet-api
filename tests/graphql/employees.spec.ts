import { test, expect, type APIRequestContext } from '@playwright/test';
import { createEmployee } from '../helpers/test-data';

async function gql(request: APIRequestContext, query: string, variables?: Record<string, unknown>) {
  return request.post('/graphql', { data: { query, variables } });
}

test.describe('GraphQL — employees', () => {
  test('employees query lists an employee created through REST', async ({ request }) => {
    // Written over REST, read over GraphQL: both layers must expose the same row.
    const created = await createEmployee(request, { full_name: 'GraphQL List', hourly_rate: 31.5 });

    const res = await gql(request, `query { employees { id fullName hourlyRate active } }`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    const found = body.data.employees.find(
      (employee: { id: string }) => employee.id === String(created.id),
    );
    expect(found).toEqual({
      id: String(created.id),
      fullName: 'GraphQL List',
      hourlyRate: 31.5,
      active: true,
    });
  });

  test('employee(id) returns the employee with its name and rate', async ({ request }) => {
    const created = await createEmployee(request, { full_name: 'GraphQL Single', hourly_rate: 27.25 });

    const res = await gql(
      request,
      `query($id: ID!) { employee(id: $id) { id fullName hourlyRate } }`,
      { id: String(created.id) },
    );
    const body = await res.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.employee).toEqual({
      id: String(created.id),
      fullName: 'GraphQL Single',
      hourlyRate: 27.25,
    });
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
