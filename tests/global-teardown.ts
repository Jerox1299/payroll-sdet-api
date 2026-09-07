export default async function globalTeardown() {
  const server = (globalThis as any).__PAYROLL_SERVER__;
  if (server) await new Promise((resolve) => server.close(resolve));
}
