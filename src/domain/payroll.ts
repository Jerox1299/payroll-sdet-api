/**
 * Core payroll business rule — the thing most worth testing.
 * Regular pay for the first 40 hours; overtime after that at 1.5x.
 * This mirrors the kind of ambiguous requirement an SDET has to turn
 * into precise, testable rules (see tests/api and tests/sql).
 */
export interface PayrollResult {
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
}

export function calculatePay(hoursWorked: number, hourlyRate: number): PayrollResult {
  if (hoursWorked < 0) throw new Error('hoursWorked cannot be negative');
  if (hourlyRate <= 0) throw new Error('hourlyRate must be positive');

  const OVERTIME_THRESHOLD = 40;
  const OVERTIME_MULTIPLIER = 1.5;

  const regularHours = Math.min(hoursWorked, OVERTIME_THRESHOLD);
  const overtimeHours = Math.max(hoursWorked - OVERTIME_THRESHOLD, 0);

  const grossPay =
    regularHours * hourlyRate + overtimeHours * hourlyRate * OVERTIME_MULTIPLIER;

  return { regularHours, overtimeHours, grossPay: Math.round(grossPay * 100) / 100 };
}
