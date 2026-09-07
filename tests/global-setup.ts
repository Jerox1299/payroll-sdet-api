import { createYoga } from 'graphql-yoga';
import { createServer, Server } from 'http';
import { buildRestApp } from '../src/rest/server';
import { schema } from '../src/graphql/schema';
import { migrate, seed } from '../src/db';

let server: Server;

export default async function globalSetup() {
  migrate();
  seed();
  const restApp = buildRestApp();
  const yoga = createYoga({ schema, graphqlEndpoint: '/graphql' });
  restApp.use('/graphql', yoga);
  server = createServer(restApp);
  await new Promise<void>((resolve) => server.listen(4000, resolve));
  (globalThis as any).__PAYROLL_SERVER__ = server;
}
