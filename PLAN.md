# Evidence Locker: Claude Code Build Plan

An evidence organiser and records tool for consumers in goods/vehicle disputes. **Information, not advice.** The user makes every legal decision. The software records, organises, timestamps and reminds.

## Product guardrails (put these in CLAUDE.md)

- Never generate arguments, strategy, outcome predictions or "you should" statements.
- Templates are neutral and user-selected. The user chooses recipient, data requested and wording options.
- Factual explainers cite official sources (gov.uk, Citizens Advice, ICO) and say "what the rules say".
- No labels about named firms ("biased", "sandbagging") anywhere in UI or copy.
- Every feature must pass the test: does this record/organise/remind, or does it advise?
- Solicitor reviews all templates, terms and marketing copy before public launch.

## Stack

- Next.js (App Router, TypeScript) as a mobile-first PWA
- Supabase: Postgres, Auth, Storage, Row Level Security
- Vercel hosting (UK/EU region)
- Transcription: provider with UK/EU data processing and a DPA (decide in Phase 3)
- PDF: server-side generation (React-PDF or Puppeteer) plus pdf-lib for merging/indexing
- Email reminders: Resend
- Payments: Stripe (Phase 5)

## Data model (core tables)

- `profiles`: user, consent flags
- `cases`: user_id, title, item description, finance/trader details (user-entered), status
- `events`: case_id, type, occurred_at, recorded_at, notes, lat/lng (nullable)
- `evidence`: case_id, event_id, storage_path, sha256, mime, size, uploaded_at, source (photo/audio/doc/email)
- `transcripts`: evidence_id, text, segments (timestamped), model, created_at
- `sar_requests`: case_id, recipient, items_selected, sent_on, due_on, status
- `reminders`: case_id, due_at, kind, sent_at
- `audit_log`: append-only (user_id, action, entity, hash, ts). No update/delete policies.

RLS on every table: users access only their own rows. Storage buckets private with signed URLs.

## Phases

### Phase 0: Foundations (1-2 days)
- Scaffold project, lint, tests (Vitest + Playwright), CI.
- Write CLAUDE.md with guardrails above.
- Supabase project, migrations, RLS policies, auth (email + magic link).
- Layout, design tokens, PWA manifest.
- **Done when:** user can sign up, create a case, and RLS is covered by tests proving cross-user access fails.

### Phase 1: Day-1 Evidence Lock (3-5 days)
- Quick-start wizard: "Something has gone wrong": item, what happened, when.
- Check-in capture: browser geolocation (with permission and manual fallback), server-side timestamp.
- Photo/document upload: compute SHA-256 client-side, verify server-side, store hash and timestamps.
- Append-only audit log entry for every evidence action.
- Evidence list per case with integrity badge (hash verified).
- **Done when:** a user can log a breakdown with location, photos and notes in under 2 minutes on a phone, and every item shows hash plus timestamps.

### Phase 2: Chronology builder (2-3 days)
- Add dated events manually (what happened, who, source evidence link).
- Timeline view, filterable, with evidence attached to each entry.
- Day-count display between user-chosen events (neutral: "14 days between these entries").
- **Done when:** timeline renders cleanly on mobile and desktop, and edits are logged (history retained).

### Phase 3: Call recording and transcripts (3-4 days)
- Upload recordings (start with upload, not in-app live recording; PWA recording is unreliable on iOS).
- Consent prompt and plain-language note: tell the other party you are recording. Store the user's acknowledgement.
- Transcribe, show timestamped transcript, full-text search (Postgres FTS).
- User can highlight and annotate passages. No automated "admission mining".
- **Done when:** upload, transcribe, search and highlight works, with transcripts linked to events.

### Phase 4: SAR letter helper (2-3 days)
- Wizard: choose recipient (free text plus saved contacts), tick categories of personal data requested, add identifying details.
- Neutral template output as PDF/email text. No tactical wording.
- Record "sent on" date; calculate due date as one calendar month (note possible extension in explainer).
- Reminders via Resend at due date and after.
- Response tracker: log what was received and when, attach files.
- **Done when:** user can generate, send (outside the app), track and log a SAR response.

### Phase 5: Bundle export and payments (3-4 days)
- Compile case bundle: cover page, index, chronology, evidence with page numbers, transcripts, SAR log. Paginated PDF plus ZIP of originals with a hash manifest.
- User-notes side-by-side document viewer (two docs, user's own highlights and notes only).
- Stripe: free tier (cases plus evidence capture), paid unlock (SAR helper and bundle export). Pricing decided by you.
- **Done when:** a full test case exports to a clean, indexed PDF, and payment gates work.

### Phase 6: Compliance and launch hardening (ongoing, before public launch)
- ICO registration, DPIA, privacy policy, terms (solicitor reviewed).
- Retention policy and user-initiated delete/export (data subject rights).
- Encryption: TLS in transit, Supabase at-rest encryption; decide whether client-side encryption is worth the trade-offs (loses server-side transcription/search).
- Rate limiting, file-type and size validation, virus scan on uploads.
- Backups, error monitoring, uptime checks.
- Cookie and analytics minimalism.
- Insurance (PI and cyber).
- Ask the solicitor about FCA claims-management perimeter before charging for finance-related use. Park the white-label/CMC idea.

## Testing priorities

1. RLS tests: no cross-user reads/writes.
2. Hash integrity: tamper a file, verify it is flagged.
3. Date maths: SAR due dates across month ends and DST.
4. E2E: Day-1 wizard on mobile viewport.
5. Copy lint: a script that fails CI on banned phrases ("you should", "the bank is wrong", "sandbag", etc.).

## Suggested first Claude Code prompts

1. "Read PLAN.md and CLAUDE.md. Scaffold Phase 0 only. Stop and summarise when done."
2. "Implement Phase 1 using TDD. Write the RLS and hash-integrity tests first."
3. Repeat per phase, committing at each "Done when".

## Out of scope for v1

Witness statement generator, strategy or burden-of-proof tooling, cost-cap or fee advice, automated discrepancy flagging, CMC white-label, any outcome prediction.
