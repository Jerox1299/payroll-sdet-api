import { z } from 'zod';

// Consumer-side contract for the /employees response.
// If the backend changes shape without warning, this test fails first —
// before it breaks a consumer (e.g. a front-end or mobile app).
export const EmployeeSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  email: z.string().email(),
  hourly_rate: z.number().positive(),
  active: z.union([z.literal(0), z.literal(1)]),
});

export const PayrollRunSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  week_start: z.string(),
  regularHours: z.number(),
  overtimeHours: z.number(),
  grossPay: z.number(),
});
