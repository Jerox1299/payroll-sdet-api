# Payroll SDET API — REST + GraphQL Testing Portfolio

A small payroll backend built specifically to practice and demonstrate the
skills asked for in Senior SDET (Backend-focused) roles: API testing across
REST **and** GraphQL on the same domain, SQL-based data integrity checks,
lightweight contract testing, and tests wired into CI/CD.

**Built with AI-assisted development tooling (Claude)** as scaffolding
and pair-programming support — the design decisions, business rules, and
test strategy below are the part worth discussing in an interview.

## Why this project
Most portfolio repos test someone else's public API. This one is a backend
*I* control, modeling a real domain (payroll/timesheets), so the tests can
cover things a demo API never lets you: a non-trivial business rule
(overtime calculation), referential integrity, and a REST/GraphQL layer
that share the exact same data and logic — which is close to how the
target role actually works (payroll/workforce systems).

## Domain & business rule
Employees log hours per week. Payroll calculates **regular pay for the
first 40 hours** and **1.5x overtime pay beyond that** — deliberately
picked because it's a classic "ambiguous requirement" (what exactly counts
as overtime? per day or per week? does it round?) that has to become
precise, testable scenarios. See `src/domain/payroll.ts` and
`tests/api/payroll.spec.ts`.

## What's covered
- **REST API** (`tests/api`): CRUD-style endpoints, positive and negative
  cases (400/404/409), and the payroll business rule end-to-end.
- **GraphQL** (`tests/graphql`): queries over the same data, including how
  GraphQL surfaces "not found" (`null`) vs errors, which differs from REST.
- **Contract testing** (`tests/contract`): response shape validated against
  a Zod schema — a lighter-weight stand-in for consumer-driven contract
  tools like Pact. Documented here on purpose: Pact is the natural next
  step if this needs to be shared with a real consumer team.
- **SQL data integrity** (`tests/sql`): validates stored results by
  recomputing them directly in SQL, independent of the application code,
  plus referential-integrity and duplicate checks. See also
  `sql/validation-queries.sql` for standalone queries.
- **CI/CD** (`.github/workflows/ci.yml`): the whole suite runs on every push.

## Stack
TypeScript, Express, GraphQL Yoga, better-sqlite3, Zod, Playwright Test,
GitHub Actions.

## Running it

```bash
npm install
npm test              # full suite: API + GraphQL + contract + SQL
npm run test:api      # just REST
npm run test:graphql  # just GraphQL
npm run test:contract # just contract/schema checks
npm run test:sql      # just SQL integrity checks
npm run dev           # run the server standalone (REST :4000, GraphQL :4000/graphql)
```

Requires Node >= 22 (see `engines` in `package.json`); CI runs the same version.

### Why the tests use a file-backed database

The suite runs against a file-backed SQLite database (`test.db`, gitignored),
not `:memory:`. This is deliberate and worth knowing about:

- An in-memory SQLite database **belongs to the connection that opened it**.
- Playwright runs `globalSetup` — which boots the REST/GraphQL server and seeds
  the data — in the main process, but runs spec files in **separate worker
  processes**.
- The API and GraphQL specs talk to the server over HTTP, so they see the seeded
  data. The SQL specs import the `db` handle directly, so in a worker they would
  open their own, empty in-memory database and fail with `no such table`.

`playwright.config.ts` therefore sets `DB_FILE` before anything imports `src/db`,
so every process opens the same database, and `globalSetup` calls `resetDb()`
(drop, migrate, seed) so each run starts from a known schema and dataset.

`workers: 1` is set because the specs share one mutable database — several of
them write to `payroll_runs`. This is a documented trade-off, not test
isolation: the more robust fix is for each spec to own its data. At a 1.2s
suite the serial run costs nothing, so the trade-off is taken knowingly.

## Structure
```
src/
  db/            SQLite schema, migration, seed data
  domain/        Payroll business rule (framework-agnostic, unit-testable)
  rest/          Express REST endpoints
  graphql/       GraphQL schema + resolvers (same domain as REST)
tests/
  api/           REST tests (positive/negative/business rule)
  graphql/       GraphQL tests
  contract/      Schema/contract validation
  sql/           Direct SQL integrity checks
sql/             Standalone reference queries
```

## Honest next steps
- Give each spec its own data instead of relying on `workers: 1`, so the suite
  can run in parallel.
- Swap the schema-validation contract tests for real Pact consumer-driven
  contracts if a front-end/mobile consumer needs to be kept in sync.
- Add a mobile client (Detox/Maestro) hitting the same API to extend this
  into a full-stack SDET portfolio.
- Add Kafka: emit a `payroll.run.completed` event and test consumption.
