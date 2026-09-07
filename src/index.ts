import { createYoga } from 'graphql-yoga';
import { createServer } from 'http';
import { buildRestApp } from './rest/server';
import { schema } from './graphql/schema';
import { migrate, seed } from './db';

migrate();
seed();

const restApp = buildRestApp();
const yoga = createYoga({ schema, graphqlEndpoint: '/graphql' });

restApp.use('/graphql', yoga);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
createServer(restApp).listen(PORT, () => {
  console.log(`REST:    http://localhost:${PORT}`);
  console.log(`GraphQL: http://localhost:${PORT}/graphql`);
});
