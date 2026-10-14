# Launch checklist

Everything in PLAN.md that is built in code is done. This list is what remains
before a public launch: decisions only the owner can make, legal and compliance
work, and production configuration. Nothing here is legal advice.

## Decisions needed

| Decision | Where it plugs in | Notes |
| --- | --- | --- |
| Transcription provider (UK/EU processing, signs a DPA) | `src/lib/transcripts/provider.ts`, `TRANSCRIPTION_PROVIDER` | Until chosen, users import VTT/SRT/text transcripts. |
| Virus scanning service | `src/lib/evidence/scan.ts`, `VIRUS_SCAN_URL` | Contract: POST raw bytes, reply `{ "clean": boolean }`. Fails closed once set. Uploads already must match their declared type (no executables). |
| Price and payment model | `STRIPE_PRICE_ID`, `STRIPE_MODE` (`payment` or `subscription`), `NEXT_PUBLIC_PRICE_LABEL` | With no price set, every feature is unlocked. |
| Retention policy | Not yet automated | E.g. delete inactive accounts after N years with warning emails. Account and case deletion already exist in the app. |
| Client-side encryption | Not adopted | Trade-off: it would stop server-side hash verification, transcription and search. Current position: TLS in transit, Supabase encryption at rest, private bucket with short-lived signed URLs, RLS on every table. |
| Error monitoring service | `ERROR_WEBHOOK_URL` (`src/instrumentation.ts`) | Structured error lines are already logged; point the webhook at your chosen service, or add its SDK. |

## Legal and compliance (owner and solicitor)

- [ ] ICO registration (data protection fee).
- [ ] DPIA: recordings of third parties, location data, financial disputes.
- [ ] Privacy policy and terms, solicitor-written. Replace the summary at `/privacy`.
- [ ] Solicitor review of all user-facing wording, in particular:
  - SAR letter template and categories (`src/lib/sar/letter.ts`)
  - Recording notice (`src/components/recordings/recording-notice.tsx`)
  - SAR time-limit explainer (`src/components/sar/sar-explainer.tsx`)
  - Reminder emails (`src/lib/reminders/reminders.ts`)
  - Bundle cover text (`src/lib/export/bundle.ts`)
  - Banned-phrase list (`scripts/banned-phrases.json`)
- [ ] FCA claims-management perimeter: ask before charging for finance-related use. CMC/white-label stays parked.
- [ ] Insurance: professional indemnity and cyber.
- [ ] Cookies: only strictly necessary sign-in cookies are set and there is no analytics, so no consent banner is needed today. Revisit if analytics are ever added.

## Production setup

### Supabase
- [ ] Create the project in a UK/EU region (London, `eu-west-2`, matches the privacy summary).
- [ ] Apply migrations: `npx supabase link` then `npx supabase db push`.
- [ ] Auth: set Site URL and redirect URL `https://<your-domain>/auth/confirm`; turn email confirmations on; enable leaked-password protection.
- [ ] Auth emails: configure custom SMTP (Resend offers SMTP) so sign-in emails come from your domain.
- [ ] Backups: enable point-in-time recovery (paid plan) and check restores.
- [ ] Run the security and performance advisors; resolve anything flagged.

### Vercel
- [ ] Project region `lhr1` (set in `vercel.json`).
- [ ] Environment variables from `.env.example`. `SUPABASE_SECRET_KEY`, `STRIPE_*`, `RESEND_API_KEY`, `CRON_SECRET` are server-only: never prefix with `NEXT_PUBLIC_`.
- [ ] Cron: `/api/cron/reminders` runs daily at 08:15 UTC; Vercel sends `CRON_SECRET` automatically.
- [ ] Function limits: export downloads files into memory (capped at 400 MB per case); use a plan with enough memory and duration.

### Stripe
- [ ] Create the product and price; set `STRIPE_PRICE_ID`.
- [ ] Add a webhook endpoint `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and (for subscriptions) `customer.subscription.deleted`; set `STRIPE_WEBHOOK_SECRET`.

### Resend
- [ ] Verify the sending domain; set `RESEND_API_KEY` and `REMINDER_FROM_EMAIL`.

### Monitoring
- [ ] Uptime monitor on `https://<your-domain>/api/health` (200 = ok, 503 = Supabase unreachable).
- [ ] Error reporting via `ERROR_WEBHOOK_URL` or an SDK.

## Already in place (Phase 6, code)

- Upload checks: declared type must match the file's content (magic bytes), per-type size limits, optional virus scan, server re-hashes every file.
- Per-user rate limits on uploads, entries, transcripts, search, SAR drafts, notes, exports and checkout.
- Security headers: CSP, HSTS, frame denial, nosniff, referrer and permissions policies.
- Data subject rights in the app: download all my data (JSON + files + SHA256SUMS), delete a case, delete the account (files, rows and audit entries).
- Health endpoint and structured server error logging.
