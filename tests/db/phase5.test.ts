import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, queryError, type TestDb } from "./harness";

// Phase 5 rules: document notes are the user's own; paid access can only be
// granted by the server (Stripe webhook), never by the user.

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const HASH = "f".repeat(64);

let db: TestDb;
let aliceCase: string;
let aliceEvidence: string;
let bobEvidence: string;

beforeAll(async () => {
  db = await createTestDb();
  const { admin } = db;
  await admin.query("insert into auth.users (id, email) values ($1, 'a@example.test'), ($2, 'b@example.test')", [
    ALICE,
    BOB,
  ]);
  const [aCase, bCase] = (
    await admin.query<{ id: string }>(
      "insert into public.cases (user_id, title) values ($1, 'Car'), ($2, 'Bob') returning id",
      [ALICE, BOB],
    )
  ).rows.map((r) => r.id);
  aliceCase = aCase;
  const ev = async (caseId: string, userId: string) =>
    (
      await admin.query<{ id: string }>(
        `insert into public.evidence (case_id, user_id, storage_path, sha256, mime, size, source)
         values ($1, $2, $3, $4, 'application/pdf', 5, 'doc') returning id`,
        [caseId, userId, `${userId}/${caseId}/${Math.random()}.pdf`, HASH],
      )
    ).rows[0].id;
  aliceEvidence = await ev(aCase, ALICE);
  bobEvidence = await ev(bCase, BOB);
  await admin.query("insert into public.document_notes (evidence_id, note) values ($1, 'Bob note')", [bobEvidence]);
});

afterAll(async () => {
  await db?.teardown();
});

describe("document notes", () => {
  it("a user can note their own document; case and owner are filled in", async () => {
    const row = await db.asUser(ALICE, async (c) =>
      (
        await c.query(
          "insert into public.document_notes (evidence_id, page, note) values ($1, 3, 'Mileage on page 3') returning case_id, user_id",
          [aliceEvidence],
        )
      ).rows[0],
    );
    expect(row).toEqual({ case_id: aliceCase, user_id: ALICE });
  });

  it("a user cannot note another user's document", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.document_notes (evidence_id, note) values ($1, 'x')", [bobEvidence]),
    );
    expect(err).toMatch(/document|row-level security/);
  });

  it("other users' notes are invisible and untouchable", async () => {
    await db.asUser(ALICE, async (c) => {
      expect((await c.query("select 1 from public.document_notes where note = 'Bob note'")).rows).toHaveLength(0);
      expect((await c.query("update public.document_notes set note = 'x' where note = 'Bob note'")).rowCount).toBe(0);
      expect((await c.query("delete from public.document_notes where note = 'Bob note'")).rowCount).toBe(0);
    });
  });

  it("page numbers must be positive", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.document_notes (evidence_id, page, note) values ($1, 0, 'x')", [aliceEvidence]),
    );
    expect(err).toMatch(/check constraint/);
  });
});

describe("entitlements", () => {
  it("a user cannot grant themselves paid access", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.entitlements (user_id, plan, source) values ($1, 'paid', 'stripe')", [ALICE]),
    );
    expect(err).toMatch(/permission denied/);
  });

  it("a user can read their own entitlement but not change it", async () => {
    await db.admin.query("insert into public.entitlements (user_id, plan, source) values ($1, 'paid', 'stripe')", [ALICE]);
    await db.asUser(ALICE, async (c) => {
      expect((await c.query("select plan from public.entitlements")).rows).toEqual([{ plan: "paid" }]);
      expect(await queryError(c, "update public.entitlements set revoked_at = null")).toMatch(/permission denied/);
      expect(await queryError(c, "delete from public.entitlements")).toMatch(/permission denied/);
    });
  });

  it("other users cannot see it", async () => {
    const rows = await db.asUser(BOB, async (c) => (await c.query("select 1 from public.entitlements")).rows);
    expect(rows).toHaveLength(0);
  });

  it("has_paid_access reflects grants and revocations", async () => {
    await db.asUser(ALICE, async (c) => {
      expect((await c.query("select public.has_paid_access() as ok")).rows[0].ok).toBe(true);
    });
    await db.asUser(BOB, async (c) => {
      expect((await c.query("select public.has_paid_access() as ok")).rows[0].ok).toBe(false);
    });
    await db.admin.query("update public.entitlements set revoked_at = now() where user_id = $1", [ALICE]);
    await db.asUser(ALICE, async (c) => {
      expect((await c.query("select public.has_paid_access() as ok")).rows[0].ok).toBe(false);
    });
  });

  it("processed Stripe events are recorded once, for idempotency, and hidden from users", async () => {
    await db.asOwner(async (c) => {
      await c.query("insert into public.stripe_events (id, type) values ('evt_1', 'checkout.session.completed')");
      expect(
        await queryError(c, "insert into public.stripe_events (id, type) values ('evt_1', 'checkout.session.completed')"),
      ).toMatch(/duplicate key/);
    });
    const err = await db.asUser(ALICE, (c) => queryError(c, "select * from public.stripe_events"));
    expect(err).toMatch(/permission denied/);
  });
});
