import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, queryError, type TestDb } from "./harness";

// Phase 2 rules: chronology entries keep their full edit history, and entries
// can link to any evidence in the same case.

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const HASH = "d".repeat(64);

let db: TestDb;
let aliceCase: string;
let aliceOtherCase: string;
let bobCase: string;
let aliceEntry: string;
let bobEntry: string;
let aliceEvidence: string;
let aliceOtherCaseEvidence: string;
let bobEvidence: string;

async function insertEvidence(caseId: string, userId: string, name: string) {
  const { rows } = await db.admin.query<{ id: string }>(
    `insert into public.evidence (case_id, user_id, storage_path, sha256, mime, size, source)
     values ($1, $2, $3, $4, 'image/jpeg', 10, 'photo') returning id`,
    [caseId, userId, `${userId}/${caseId}/${name}`, HASH],
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await createTestDb();
  const { admin } = db;
  await admin.query(
    "insert into auth.users (id, email) values ($1, 'alice@example.test'), ($2, 'bob@example.test')",
    [ALICE, BOB],
  );
  const cases = await admin.query<{ id: string }>(
    "insert into public.cases (user_id, title) values ($1, 'Car'), ($1, 'Sofa'), ($2, 'Bob') returning id",
    [ALICE, BOB],
  );
  [aliceCase, aliceOtherCase, bobCase] = cases.rows.map((r) => r.id);
  const events = await admin.query<{ id: string }>(
    `insert into public.events (case_id, user_id, type, title, occurred_at, notes)
     values ($1, $3, 'communication', 'Phoned the dealer', '2026-09-01T10:00:00Z', 'Spoke to service desk'),
            ($2, $4, 'note', 'Bob note', now(), null)
     returning id`,
    [aliceCase, bobCase, ALICE, BOB],
  );
  [aliceEntry, bobEntry] = events.rows.map((r) => r.id);
  aliceEvidence = await insertEvidence(aliceCase, ALICE, "a.jpg");
  aliceOtherCaseEvidence = await insertEvidence(aliceOtherCase, ALICE, "b.jpg");
  bobEvidence = await insertEvidence(bobCase, BOB, "c.jpg");
});

afterAll(async () => {
  await db?.teardown();
});

describe("entry history", () => {
  it("keeps the previous version when an entry is edited", async () => {
    await db.asUser(ALICE, async (c) => {
      await c.query("update public.events set notes = 'Spoke to Sam at the service desk' where id = $1", [
        aliceEntry,
      ]);
      await c.query("update public.events set title = 'Phoned the dealer (2nd call)' where id = $1", [aliceEntry]);
      const { rows } = await c.query(
        "select revision, op, snapshot->>'notes' as notes, snapshot->>'title' as title from public.event_revisions where event_id = $1 order by revision",
        [aliceEntry],
      );
      expect(rows).toEqual([
        { revision: 1, op: "update", notes: "Spoke to service desk", title: "Phoned the dealer" },
        { revision: 2, op: "update", notes: "Spoke to Sam at the service desk", title: "Phoned the dealer" },
      ]);
    });
  });

  it("marks the entry as edited but never changes when it was first recorded", async () => {
    await db.asUser(ALICE, async (c) => {
      const before = (await c.query("select recorded_at from public.events where id = $1", [aliceEntry])).rows[0];
      const after = (
        await c.query(
          "update public.events set notes = 'x', recorded_at = '2000-01-01' where id = $1 returning recorded_at, edited_at",
          [aliceEntry],
        )
      ).rows[0];
      expect(after.recorded_at).toEqual(before.recorded_at);
      expect(after.edited_at).not.toBeNull();
    });
  });

  it("keeps the last version when an entry is deleted", async () => {
    await db.asUser(ALICE, async (c) => {
      await c.query("delete from public.events where id = $1", [aliceEntry]);
      const { rows } = await c.query(
        "select op, snapshot->>'title' as title from public.event_revisions where event_id = $1",
        [aliceEntry],
      );
      expect(rows).toEqual([{ op: "delete", title: "Phoned the dealer" }]);
    });
  });

  it("history cannot be written, changed or removed by users", async () => {
    await db.asUser(ALICE, async (c) => {
      await c.query("update public.events set notes = 'y' where id = $1", [aliceEntry]);
      expect(
        await queryError(
          c,
          `insert into public.event_revisions (event_id, case_id, user_id, revision, op, snapshot)
           values ($1, $2, $3, 99, 'update', '{}')`,
          [aliceEntry, aliceCase, ALICE],
        ),
      ).toMatch(/permission denied/);
      expect(await queryError(c, "update public.event_revisions set snapshot = '{}'")).toMatch(/permission denied/);
      expect(await queryError(c, "delete from public.event_revisions")).toMatch(/permission denied/);
    });
  });

  it("other users cannot read an entry's history", async () => {
    await db.asUser(BOB, async (c) => {
      const { rows } = await c.query("select 1 from public.event_revisions where user_id = $1", [ALICE]);
      expect(rows).toHaveLength(0);
    });
  });

  it("an entry's who and title are length-limited", async () => {
    await db.asUser(ALICE, async (c) => {
      expect(await queryError(c, "update public.events set who = $1 where id = $2", ["x".repeat(201), aliceEntry])).toMatch(
        /check constraint/,
      );
    });
  });
});

describe("entry evidence links", () => {
  it("links evidence from the same case", async () => {
    await db.asUser(ALICE, async (c) => {
      await c.query("insert into public.event_evidence (event_id, evidence_id) values ($1, $2)", [
        aliceEntry,
        aliceEvidence,
      ]);
      const { rows } = await c.query("select case_id, user_id from public.event_evidence where event_id = $1", [
        aliceEntry,
      ]);
      expect(rows).toEqual([{ case_id: aliceCase, user_id: ALICE }]);
    });
  });

  it("refuses evidence from another of the user's cases", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.event_evidence (event_id, evidence_id) values ($1, $2)", [
        aliceEntry,
        aliceOtherCaseEvidence,
      ]),
    );
    expect(err).toMatch(/same case/);
  });

  it("refuses another user's evidence or entry", async () => {
    await db.asUser(ALICE, async (c) => {
      expect(
        await queryError(c, "insert into public.event_evidence (event_id, evidence_id) values ($1, $2)", [
          aliceEntry,
          bobEvidence,
        ]),
      ).toMatch(/same case|row-level security/);
      expect(
        await queryError(c, "insert into public.event_evidence (event_id, evidence_id) values ($1, $2)", [
          bobEntry,
          aliceEvidence,
        ]),
      ).toMatch(/same case|row-level security/);
    });
  });

  it("other users cannot see or remove links", async () => {
    await db.admin.query("insert into public.event_evidence (event_id, evidence_id) values ($1, $2)", [
      bobEntry,
      bobEvidence,
    ]);
    await db.asUser(ALICE, async (c) => {
      expect((await c.query("select 1 from public.event_evidence where event_id = $1", [bobEntry])).rows).toHaveLength(0);
      expect((await c.query("delete from public.event_evidence where event_id = $1", [bobEntry])).rowCount).toBe(0);
    });
  });

  it("link changes are audited", async () => {
    await db.asUser(ALICE, async (c) => {
      await c.query("insert into public.event_evidence (event_id, evidence_id) values ($1, $2)", [
        aliceEntry,
        aliceEvidence,
      ]);
      const { rows } = await c.query(
        "select action from public.audit_log where entity = 'event_evidence' and user_id = $1",
        [ALICE],
      );
      expect(rows.map((r) => r.action)).toContain("insert");
    });
  });
});

describe("deleting a whole case", () => {
  it("removes its entries, history and links without error", async () => {
    await db.asUser(ALICE, async (c) => {
      await c.query("update public.events set notes = 'edit' where id = $1", [aliceEntry]);
      await c.query("insert into public.event_evidence (event_id, evidence_id) values ($1, $2)", [
        aliceEntry,
        aliceEvidence,
      ]);
      expect(await queryError(c, "delete from public.cases where id = $1", [aliceCase])).toBeNull();
      const left = await c.query(
        `select (select count(*) from public.events where case_id = $1)::int as events,
                (select count(*) from public.event_revisions where case_id = $1)::int as revisions,
                (select count(*) from public.event_evidence where case_id = $1)::int as links`,
        [aliceCase],
      );
      expect(left.rows[0]).toEqual({ events: 0, revisions: 0, links: 0 });
    });
  });

  it("deleting the account removes everything", async () => {
    await db.asOwner(async (c) => {
      expect(await queryError(c, "delete from auth.users where id = $1", [ALICE])).toBeNull();
      const { rows } = await c.query("select count(*)::int as n from public.event_revisions where user_id = $1", [ALICE]);
      expect(rows[0].n).toBe(0);
    });
  });
});
