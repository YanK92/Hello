import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, queryError, type TestDb } from "./harness";

// Phase 1 rules: evidence rows are created only by the server (service role)
// after it has hashed the uploaded bytes itself. Users can read, relink and
// delete their own evidence but never rewrite its hash or verification state.

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const HASH = "b".repeat(64);

let db: TestDb;
let aliceCase: string;
let aliceOtherCase: string;
let aliceEvent: string;
let aliceEvent2: string;
let aliceOtherCaseEvent: string;
let aliceEvidence: string;

async function asService<T>(fn: Parameters<TestDb["asUser"]>[1]): Promise<T> {
  await db.admin.query("begin");
  try {
    await db.admin.query("set local role service_role");
    return (await fn(db.admin)) as T;
  } finally {
    await db.admin.query("rollback");
  }
}

beforeAll(async () => {
  db = await createTestDb();
  const { admin } = db;
  await admin.query(
    "insert into auth.users (id, email) values ($1, 'alice@example.test'), ($2, 'bob@example.test')",
    [ALICE, BOB],
  );
  const cases = await admin.query<{ id: string }>(
    "insert into public.cases (user_id, title) values ($1, 'Car'), ($1, 'Sofa') returning id",
    [ALICE],
  );
  [aliceCase, aliceOtherCase] = cases.rows.map((r) => r.id);
  const events = await admin.query<{ id: string }>(
    `insert into public.events (case_id, user_id, type, occurred_at)
     values ($1, $3, 'incident', now()), ($1, $3, 'check_in', now()), ($2, $3, 'note', now())
     returning id`,
    [aliceCase, aliceOtherCase, ALICE],
  );
  [aliceEvent, aliceEvent2, aliceOtherCaseEvent] = events.rows.map((r) => r.id);
  const ev = await admin.query<{ id: string }>(
    `insert into public.evidence
       (case_id, event_id, user_id, storage_path, sha256, mime, size, source, original_name, hash_verified_at)
     values ($1, $2, $3, $4, $5, 'image/jpeg', 100, 'photo', 'dash.jpg', now()) returning id`,
    [aliceCase, aliceEvent, ALICE, `${ALICE}/${aliceCase}/dash.jpg`, HASH],
  );
  aliceEvidence = ev.rows[0].id;
});

afterAll(async () => {
  await db?.teardown();
});

describe("evidence writes", () => {
  it("users cannot insert evidence rows directly, even on their own case", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(
        c,
        `insert into public.evidence (case_id, storage_path, sha256, mime, size, source)
         values ($1, $2, $3, 'image/jpeg', 1, 'photo')`,
        [aliceCase, `${ALICE}/${aliceCase}/x.jpg`, HASH],
      ),
    );
    expect(err).toMatch(/permission denied/);
  });

  for (const [column, value] of [
    ["sha256", "c".repeat(64)],
    ["storage_path", "elsewhere.jpg"],
    ["size", "1"],
    ["hash_verified_at", "2000-01-01"],
    ["last_check_ok", "true"],
  ] as const) {
    it(`users cannot rewrite evidence.${column}`, async () => {
      const err = await db.asUser(ALICE, (c) =>
        queryError(c, `update public.evidence set ${column} = $1 where id = $2`, [
          value,
          aliceEvidence,
        ]),
      );
      expect(err).toMatch(/permission denied/);
    });
  }

  it("users can relink their evidence to another entry in the same case", async () => {
    const count = await db.asUser(ALICE, async (c) =>
      (await c.query("update public.evidence set event_id = $1 where id = $2", [
        aliceEvent2,
        aliceEvidence,
      ])).rowCount,
    );
    expect(count).toBe(1);
  });

  it("evidence cannot be linked to an entry from a different case", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "update public.evidence set event_id = $1 where id = $2", [
        aliceOtherCaseEvent,
        aliceEvidence,
      ]),
    );
    expect(err).toMatch(/same case/);
  });

  it("other users cannot relink or delete it", async () => {
    await db.asUser(BOB, async (c) => {
      expect(
        (await c.query("update public.evidence set event_id = null where id = $1", [aliceEvidence]))
          .rowCount,
      ).toBe(0);
      expect(
        (await c.query("delete from public.evidence where id = $1", [aliceEvidence])).rowCount,
      ).toBe(0);
    });
  });

  it("deleting evidence leaves an audit entry", async () => {
    await db.asUser(ALICE, async (c) => {
      await c.query("delete from public.evidence where id = $1", [aliceEvidence]);
      const { rows } = await c.query(
        "select action from public.audit_log where entity = 'evidence' and entity_id = $1 order by id",
        [aliceEvidence],
      );
      expect(rows.map((r) => r.action)).toEqual(["insert", "delete"]);
    });
  });

  it("the server (service role) can record evidence, and it is audited", async () => {
    await asService(async (c) => {
      const { rows } = await c.query(
        `insert into public.evidence (case_id, user_id, storage_path, sha256, mime, size, source)
         values ($1, $2, $3, $4, 'application/pdf', 5, 'doc') returning id, uploaded_at`,
        [aliceCase, ALICE, `${ALICE}/${aliceCase}/r.pdf`, HASH],
      );
      const audit = await c.query(
        "select action, user_id from public.audit_log where entity_id = $1",
        [rows[0].id],
      );
      expect(audit.rows).toEqual([{ action: "insert", user_id: ALICE }]);
    });
  });
});

describe("check-ins", () => {
  it("records a manual location label with no coordinates", async () => {
    const row = await db.asUser(ALICE, async (c) =>
      (
        await c.query(
          `insert into public.events (case_id, type, occurred_at, location_label, location_source)
           values ($1, 'check_in', now(), 'Layby on A40 near Witney', 'manual')
           returning location_label, lat`,
          [aliceCase],
        )
      ).rows[0],
    );
    expect(row).toEqual({ location_label: "Layby on A40 near Witney", lat: null });
  });

  it("rejects an unknown location source", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(
        c,
        `insert into public.events (case_id, type, occurred_at, location_source)
         values ($1, 'check_in', now(), 'guess')`,
        [aliceCase],
      ),
    );
    expect(err).toMatch(/check constraint/);
  });
});

describe("evidence bucket", () => {
  it("is private and limits file size and type", async () => {
    const { rows } = await db.admin.query(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'evidence'",
    );
    expect(rows[0].public).toBe(false);
    // Raised from 25 MB in Phase 3 for call recordings; per-type limits are
    // enforced by the app (src/lib/evidence/rules.ts).
    expect(Number(rows[0].file_size_limit)).toBeLessThanOrEqual(100 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).toContain("image/jpeg");
    expect(rows[0].allowed_mime_types).toContain("application/pdf");
    expect(rows[0].allowed_mime_types).not.toContain("application/x-msdownload");
  });
});
