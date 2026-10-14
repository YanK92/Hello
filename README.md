# Evidence Locker

A records tool for consumers in goods and vehicle disputes: capture evidence,
keep a timestamped chronology, and export it. It provides information, not
legal advice. See [PLAN.md](PLAN.md) for the roadmap and [CLAUDE.md](CLAUDE.md)
for product guardrails and engineering rules.

## Getting started

Requires Node 22+ and Docker (for the local Supabase stack).

```bash
npm install
npx supabase start            # starts Postgres/Auth/Storage and applies migrations
cp .env.example .env.local    # fill in from `npx supabase status`
npm run dev
```

Open http://localhost:3000, create an account and start a case. Locally, email
confirmation is off and any emails go to Mailpit at http://127.0.0.1:54324.

## Tests

```bash
npm run check                                   # lint, copy lint, typecheck, unit tests
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
npm run test:e2e                                # smoke tests
E2E_SUPABASE=1 npm run test:e2e                 # plus sign-up/case flow (stack running)
```

`test:db` creates a throwaway database on the server you point it at, applies a
small Supabase shim plus all migrations, runs the RLS tests and drops it. It can
use the local Supabase Postgres or any plain Postgres 15+.
