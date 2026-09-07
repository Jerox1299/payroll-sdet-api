import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Basic load test for the payroll API.
 * Run the server first:  npm run dev   (listens on :4000)
 * Then run this with k6 (separate binary, not an npm package):
 *   k6 run performance/k6-load-test.js
 *
 * What this validates:
 * - GET /employees stays fast and correct under concurrent load
 * - POST /payroll-runs (the real business-logic endpoint) doesn't degrade
 *   or start failing as concurrency increases
 * - Thresholds turn "how does it feel" into a pass/fail CI gate
 */

export const options = {
  scenarios: {
    ramping_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 10 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function () {
  const listRes = http.get(`${BASE_URL}/employees`);
  check(listRes, {
    'GET /employees status is 200': (r) => r.status === 200,
    'GET /employees returns an array': (r) => Array.isArray(JSON.parse(r.body)),
  });

  const payrollRes = http.post(
    `${BASE_URL}/payroll-runs`,
    JSON.stringify({ employee_id: 2, week_start: '2026-08-24' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(payrollRes, {
    'POST /payroll-runs status is 201': (r) => r.status === 201,
    'POST /payroll-runs returns grossPay': (r) => JSON.parse(r.body).grossPay !== undefined,
  });

  sleep(1);
}
