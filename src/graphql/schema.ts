import { createSchema } from 'graphql-yoga';
import { db } from '../db';

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Employee {
      id: ID!
      fullName: String!
      email: String!
      hourlyRate: Float!
      active: Boolean!
    }

    type PayrollRun {
      id: ID!
      employeeId: ID!
      weekStart: String!
      regularHours: Float!
      overtimeHours: Float!
      grossPay: Float!
    }

    type Query {
      employees: [Employee!]!
      employee(id: ID!): Employee
      payrollRun(id: ID!): PayrollRun
    }
  `,
  resolvers: {
    Query: {
      employees: () => {
        const rows = db
          .prepare('SELECT id, full_name, email, hourly_rate, active FROM employees')
          .all() as any[];
        return rows.map(mapEmployee);
      },
      employee: (_: unknown, args: { id: string }) => {
        const row = db
          .prepare('SELECT id, full_name, email, hourly_rate, active FROM employees WHERE id = ?')
          .get(args.id) as any;
        return row ? mapEmployee(row) : null;
      },
      payrollRun: (_: unknown, args: { id: string }) => {
        const row = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(args.id) as any;
        return row
          ? {
              id: row.id,
              employeeId: row.employee_id,
              weekStart: row.week_start,
              regularHours: row.regular_hours,
              overtimeHours: row.overtime_hours,
              grossPay: row.gross_pay,
            }
          : null;
      },
    },
  },
});

function mapEmployee(row: any) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    hourlyRate: row.hourly_rate,
    active: !!row.active,
  };
}
