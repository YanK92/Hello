import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, queryError, type TestDb } from "./harness";

// Phase 4 rules: saved contacts are per user; SAR requests can only use the
// user's own contacts; responses belong to the user's own requests; reminders
// can be created and cancelled by the user but only the server marks them sent.

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

let db: TestDb;
let aliceCase: string;
let bobCase: string;
let aliceContact: string;
let bobContact: string;
let aliceSar: string;
let bobSar: string;
let aliceReminder: string;

beforeAll(async () => {
  db = await createTestDb();
  const { admin } = db;
  await admin.query("insert into auth.users (id, email) values ($1, 'a@example.test'), ($2, 'b@example.test')", [
    ALICE,
    BOB,
  ]);
  [aliceCase, bobCase] = (
    await admin.query<{ id: string }>(
      "insert into public.cases (user_id, title) values ($1, 'Car'), ($2, 'Bob') returning id",
      [ALICE, BOB],
    )
  ).rows.map((r) => r.id);
  [aliceContact, bobContact] = (
    await admin.query<{ id: string }>(
      `insert into public.contacts (user_id, name, email) values ($1, 'Example Finance DPO', 'dpo@example.test'),
       ($2, 'Bob contact', null) returning id`,
      [ALICE, BOB],
    )
  ).rows.map((r) => r.id);
  [aliceSar, bobSar] = (
    await admin.query<{ id: string }>(
      `insert into public.sar_requests (case_id, user_id, recipient, contact_id) values ($1, $2, 'Example Finance', $3),
       ($4, $5, 'Bob org', null) returning id`,
      [aliceCase, ALICE, aliceContact, bobCase, BOB],
    )
  ).rows.map((r) => r.id);
  aliceReminder = (
    await admin.query<{ id: string }>(
      `insert into public.reminders (case_id, user_id, sar_request_id, due_at, kind) values ($1, $2, $3, now(), 'sar_due') returning id`,
      [aliceCase, ALICE, aliceSar],
    )
  ).rows[0].id;
});

afterAll(async () => {
  await db?.teardown();
});

describe("contacts", () => {
  it("are private to their owner", async () => {
    const rows = await db.asUser(ALICE, async (c) => (await c.query("select id from public.contacts")).rows);
    expect(rows.map((r) => r.id)).toEqual([aliceContact]);
  });

  it("cannot be edited or deleted by another user", async () => {
    await db.asUser(BOB, async (c) => {
      expect((await c.query("update public.contacts set name = 'x' where id = $1", [aliceContact])).rowCount).toBe(0);
      expect((await c.query("delete from public.contacts where id = $1", [aliceContact])).rowCount).toBe(0);
    });
  });

  it("a SAR cannot point at another user's contact", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.sar_requests (case_id, recipient, contact_id) values ($1, 'x', $2)", [
        aliceCase,
        bobContact,
      ]),
    );
    expect(err).toMatch(/contact/);
  });

  it("deleting a contact keeps the SAR, unlinked", async () => {
    await db.asUser(ALICE, async (c) => {
      await c.query("delete from public.contacts where id = $1", [aliceContact]);
      const { rows } = await c.query("select recipient, contact_id from public.sar_requests where id = $1", [aliceSar]);
      expect(rows[0]).toEqual({ recipient: "Example Finance", contact_id: null });
    });
  });
});

describe("sar_requests", () => {
  it("store the letter and dates", async () => {
    await db.asUser(ALICE, async (c) => {
      const { rows } = await c.query(
        `update public.sar_requests set letter_text = 'Dear…', sent_on = '2026-01-31', due_on = '2026-02-28', status = 'sent'
         where id = $1 returning due_on::text`,
        [aliceSar],
      );
      expect(rows[0].due_on).toBe("2026-02-28");
    });
  });

  it("cannot be read by another user", async () => {
    const rows = await db.asUser(BOB, async (c) => (await c.query("select 1 from public.sar_requests where id = $1", [aliceSar])).rows);
    expect(rows).toHaveLength(0);
  });
});

describe("sar_responses", () => {
  it("can be logged against the user's own request, case filled in", async () => {
    const row = await db.asUser(ALICE, async (c) =>
      (
        await c.query(
          "insert into public.sar_responses (sar_request_id, received_on, description) values ($1, '2026-02-20', 'Part 1 by email') returning case_id",
          [aliceSar],
        )
      ).rows[0],
    );
    expect(row.case_id).toBe(aliceCase);
  });

  it("cannot be logged against another user's request", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.sar_responses (sar_request_id, received_on) values ($1, '2026-02-20')", [bobSar]),
    );
    expect(err).toMatch(/request|row-level security/);
  });

  it("are invisible to other users", async () => {
    await db.admin.query("insert into public.sar_responses (sar_request_id, received_on) values ($1, '2026-02-01')", [bobSar]);
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select 1 from public.sar_responses where sar_request_id = $1", [bobSar])).rows,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("reminders", () => {
  it("a user can create and cancel reminders for their own request", async () => {
    await db.asUser(ALICE, async (c) => {
      expect(
        await queryError(
          c,
          "insert into public.reminders (case_id, sar_request_id, due_at, kind) values ($1, $2, now(), 'sar_followup')",
          [aliceCase, aliceSar],
        ),
      ).toBeNull();
      expect((await c.query("delete from public.reminders where id = $1", [aliceReminder])).rowCount).toBe(1);
    });
  });

  it("a user cannot mark a reminder as sent or move it", async () => {
    await db.asUser(ALICE, async (c) => {
      expect(await queryError(c, "update public.reminders set sent_at = now() where id = $1", [aliceReminder])).toMatch(
        /permission denied/,
      );
    });
  });

  it("a reminder's request must be in the same case", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.reminders (case_id, sar_request_id, due_at, kind) values ($1, $2, now(), 'sar_due')", [
        aliceCase,
        bobSar,
      ]),
    );
    expect(err).toMatch(/same case|row-level security/);
  });

  it("only one reminder of each kind per request", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.reminders (case_id, sar_request_id, due_at, kind) values ($1, $2, now(), 'sar_due')", [
        aliceCase,
        aliceSar,
      ]),
    );
    expect(err).toMatch(/duplicate key|unique/);
  });
});
