# Performance

Basic k6 load test against the payroll API (`k6-load-test.js`).

k6 is a standalone binary, not an npm package — install it separately:
https://k6.io/docs/get-started/installation/

## Run
```bash
npm run dev                          # terminal 1: starts the API on :4000
k6 run performance/k6-load-test.js   # terminal 2
```

## What it checks
- `GET /employees` (read path) stays correct and fast under ramping load
  (0 → 10 → 0 virtual users over 40s).
- `POST /payroll-runs` (the real business-logic path: reads employee +
  timesheet, computes overtime, writes a row) doesn't fail or slow down
  as concurrency increases.
- Thresholds (`p95 < 300ms`, `error rate < 1%`) turn this into a pass/fail
  gate instead of just a chart to eyeball.

## Honest scope
This is a load test on a single in-memory SQLite instance on a laptop —
useful to learn k6 mechanics (executors, stages, checks, thresholds), but
not representative of production infrastructure sizing.
