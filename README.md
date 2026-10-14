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

## What it does

- **Day-1 evidence lock:** "Something has gone wrong" wizard, check-ins with location, photos and documents with
  SHA-256 fingerprints verified by the server.
- **Timeline:** dated entries with who/what/files, full edit history, filters, day counts between entries.
- **Recordings:** call recordings with a recording notice, imported or provider transcripts, search, highlights.
- **Data requests (SAR):** neutral letter from the user's choices, PDF, due dates per the ICO method, reminders,
  response tracking.
- **Export:** indexed bundle PDF and a ZIP of originals with a checkable fingerprint manifest; side-by-side viewer.
- **Payments:** Stripe unlock for the SAR helper and export (off until a price is configured).
- **Data rights:** download all data, delete a case, delete the account.

Before a public launch, work through [docs/launch-checklist.md](docs/launch-checklist.md).

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
