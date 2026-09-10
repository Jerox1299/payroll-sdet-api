import express, { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { calculatePay } from '../domain/payroll';

export function buildRestApp() {
  const app = express();
  app.use(express.json());

  // GET /employees — list
  app.get('/employees', (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT id, full_name, email, hourly_rate, active FROM employees').all();
    res.status(200).json(rows);
  });

  // GET /employees/:id
  app.get('/employees/:id', (req: Request, res: Response) => {
    const row = db
      .prepare('SELECT id, full_name, email, hourly_rate, active FROM employees WHERE id = ?')
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    res.status(200).json(row);
  });

  // POST /employees — create (validates input; this is a good place for negative tests)
  app.post('/employees', (req: Request, res: Response) => {
    const { full_name, email, hourly_rate } = req.body ?? {};
    if (!full_name || !email || typeof hourly_rate !== 'number' || hourly_rate <= 0) {
      return res.status(400).json({ error: 'full_name, email and a positive hourly_rate are required' });
    }
    try {
      const result = db
        .prepare('INSERT INTO employees (full_name, email, hourly_rate) VALUES (?, ?, ?)')
        .run(full_name, email, hourly_rate);
      res.status(201).json({ id: result.lastInsertRowid, full_name, email, hourly_rate, active: 1 });
    } catch (err: any) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'email already exists' });
      }
      res.status(500).json({ error: 'internal error' });
    }
  });

  // POST /timesheets — hours for one employee and one week, the input every payroll run is
  // computed from. Same shape as the other writers: 400 on bad input, 404 on a missing parent,
  // 409 when the UNIQUE (employee_id, week_start) constraint fires.
  app.post('/timesheets', (req: Request, res: Response) => {
    const { employee_id, week_start, hours_worked } = req.body ?? {};
    if (
      typeof employee_id !== 'number' ||
      typeof week_start !== 'string' ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(week_start) ||
      typeof hours_worked !== 'number' ||
      !Number.isFinite(hours_worked) ||
      hours_worked < 0
    ) {
      return res.status(400).json({
        error: 'employee_id, week_start (YYYY-MM-DD) and a non-negative hours_worked are required',
      });
    }

    const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(employee_id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    try {
      const result = db
        .prepare('INSERT INTO timesheets (employee_id, week_start, hours_worked) VALUES (?, ?, ?)')
        .run(employee_id, week_start, hours_worked);
      res.status(201).json({ id: result.lastInsertRowid, employee_id, week_start, hours_worked });
    } catch (err: any) {
      if (String(err.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'timesheet already exists for that employee and week' });
      }
      res.status(500).json({ error: 'internal error' });
    }
  });

  // POST /payroll-runs — the interesting business-logic endpoint
  app.post('/payroll-runs', (req: Request, res: Response) => {
    const { employee_id, week_start } = req.body ?? {};
    if (!employee_id || !week_start) {
      return res.status(400).json({ error: 'employee_id and week_start are required' });
    }

    const employee = db
      .prepare('SELECT id, hourly_rate FROM employees WHERE id = ?')
      .get(employee_id) as { id: number; hourly_rate: number } | undefined;
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const timesheet = db
      .prepare('SELECT hours_worked FROM timesheets WHERE employee_id = ? AND week_start = ?')
      .get(employee_id, week_start) as { hours_worked: number } | undefined;
    if (!timesheet) return res.status(404).json({ error: 'Timesheet not found for that week' });

    const pay = calculatePay(timesheet.hours_worked, employee.hourly_rate);

    const result = db
      .prepare(
        `INSERT INTO payroll_runs (employee_id, week_start, regular_hours, overtime_hours, gross_pay)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(employee_id, week_start, pay.regularHours, pay.overtimeHours, pay.grossPay);

    res.status(201).json({ id: result.lastInsertRowid, employee_id, week_start, ...pay });
  });

  // GET /payroll-runs/:id
  app.get('/payroll-runs/:id', (req: Request, res: Response) => {
    const row = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Payroll run not found' });
    res.status(200).json(row);
  });

  // Basic error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'unexpected error', detail: String(err) });
  });

  return app;
}
