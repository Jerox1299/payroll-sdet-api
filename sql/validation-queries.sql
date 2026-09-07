-- Standalone reference queries — useful to run by hand against the SQLite
-- file (set DB_FILE=payroll.db when starting the server) to sanity-check
-- data without going through the API.

-- 1. Employees with no timesheet at all this week (coverage gap)
SELECT e.id, e.full_name
FROM employees e
LEFT JOIN timesheets t ON t.employee_id = e.id AND t.week_start = '2026-08-24'
WHERE t.id IS NULL;

-- 2. Payroll runs where stored gross_pay doesn't match recomputation
SELECT pr.id, pr.gross_pay,
       (MIN(pr.regular_hours,40) * e.hourly_rate) +
       (MAX(pr.regular_hours + pr.overtime_hours - 40, 0) * e.hourly_rate * 1.5) AS expected
FROM payroll_runs pr
JOIN employees e ON e.id = pr.employee_id
HAVING pr.gross_pay <> expected;

-- 3. Duplicate timesheets (employee/week should be unique)
SELECT employee_id, week_start, COUNT(*) AS total
FROM timesheets
GROUP BY employee_id, week_start
HAVING COUNT(*) > 1;
