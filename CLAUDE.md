# Evidence Locker

An evidence organiser and records tool for consumers in goods/vehicle disputes.
**Information, not advice.** The user makes every legal decision. The software
records, organises, timestamps and reminds. The build plan is in `PLAN.md`;
work one phase at a time and stop at each phase's "Done when".

@AGENTS.md

## Product guardrails (non-negotiable)

- Never generate arguments, strategy, outcome predictions or "you should" statements.
- Templates are neutral and user-selected. The user chooses recipient, data requested and wording options.
- Factual explainers cite official sources (gov.uk, Citizens Advice, ICO) and say "what the rules say".
- No labels about named firms (for example "biased" or "sandbagging") anywhere in UI or copy.
- Every feature must pass the test: does this record/organise/remind, or does it advise? If it advises, do not build it.
- A solicitor reviews all templates, terms and marketing copy before public launch.
- Out of scope for v1: witness statement generator, strategy or burden-of-proof tooling, cost-cap or fee advice, automated discrepancy flagging, CMC white-label, any outcome prediction.

`npm run lint:copy` enforces the banned-phrase list in `scripts/banned-phrases.json`
across `src/` and `public/`. Add phrases there rather than weakening the check.

## Stack

- Next.js 16 App Router, TypeScript, mobile-first PWA. `cacheComponents` is on:
  anything reading cookies, `params` or search params must sit inside `<Suspense>`.
  Middleware is called **proxy** in this version (`src/proxy.ts`).
- Supabase (Postgres, Auth, Storage, RLS) via `@supabase/ssr`.
  Server code uses `src/lib/supabase/server.ts`; never share a client between requests.
  Identify the user with `getClaims()` (verifies the JWT), not `getSession()`.
- Styling: plain CSS with design tokens in `src/app/globals.css`. Use the tokens; no raw colours in components.

## Data and security rules

- Schema changes go in a new file under `supabase/migrations/`. Never edit a migration that has been applied.
- Every user-owned table has `user_id default auth.uid()`, RLS enabled, and policies limited to `(select auth.uid())`.
  Child tables also check the parent case is owned (`public.owns_case`).
- `audit_log` is append-only: no update/delete policies, and triggers block update, delete and truncate.
  Audit rows are written by the `audit_row_change` trigger, not by app code.
- Server-side timestamps (`events.recorded_at`, `evidence.uploaded_at`) are set by triggers; clients cannot set them.
- Evidence files live in the private `evidence` bucket under `<user_id>/...`, served by signed URL only. No overwrite.
- Every new table or policy needs RLS tests in `tests/db/` proving cross-user access fails.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (needs `.env.local`, see `.env.example`) |
| `npm run check` | Lint, copy lint, typecheck, unit tests |
| `npm run test:db` | RLS tests; needs `TEST_DATABASE_URL` pointing at a disposable Postgres |
| `npm run test:e2e` | Playwright; set `E2E_SUPABASE=1` with `npx supabase start` running for the auth flow |
| `npx supabase start` | Local Supabase stack (Docker), applies migrations |

## Testing priorities

1. RLS: no cross-user reads/writes.
2. Hash integrity: a tampered file is flagged.
3. Date maths: SAR due dates across month ends and DST.
4. E2E: Day-1 wizard on a mobile viewport.
5. Copy lint in CI.
