import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, queryError, type TestDb } from "./harness";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

const HASH = "a".repeat(64);

let db: TestDb;
let aliceCase: string;
let bobCase: string;
let bobEvent: string;
let bobEvidence: string;
let aliceEvent: string;

beforeAll(async () => {
  db = await createTestDb();
  const { admin } = db;

  await admin.query(
    "insert into auth.users (id, email) values ($1, 'alice@example.test'), ($2, 'bob@example.test')",
    [ALICE, BOB],
  );

  const cases = await admin.query<{ id: string; user_id: string }>(
    `insert into public.cases (user_id, title) values ($1, 'Alice car'), ($2, 'Bob sofa')
     returning id, user_id`,
    [ALICE, BOB],
  );
  aliceCase = cases.rows.find((r) => r.user_id === ALICE)!.id;
  bobCase = cases.rows.find((r) => r.user_id === BOB)!.id;

  const events = await admin.query<{ id: string; user_id: string }>(
    `insert into public.events (case_id, user_id, type, occurred_at)
     values ($1, $2, 'note', now()), ($3, $4, 'note', now())
     returning id, user_id`,
    [aliceCase, ALICE, bobCase, BOB],
  );
  aliceEvent = events.rows.find((r) => r.user_id === ALICE)!.id;
  bobEvent = events.rows.find((r) => r.user_id === BOB)!.id;

  const evidence = await admin.query<{ id: string }>(
    `insert into public.evidence (case_id, user_id, storage_path, sha256, mime, size, source)
     values ($1, $2, $3, $4, 'image/jpeg', 10, 'photo') returning id`,
    [bobCase, BOB, `${BOB}/${bobCase}/photo.jpg`, HASH],
  );
  bobEvidence = evidence.rows[0].id;

  await admin.query(
    `insert into public.transcripts (evidence_id, user_id, text) values ($1, $2, 'hello')`,
    [bobEvidence, BOB],
  );
  await admin.query(
    `insert into public.sar_requests (case_id, user_id, recipient) values ($1, $2, 'Example Ltd')`,
    [bobCase, BOB],
  );
  await admin.query(
    `insert into public.reminders (case_id, user_id, due_at, kind) values ($1, $2, now(), 'sar_due')`,
    [bobCase, BOB],
  );
  await admin.query(
    `insert into storage.objects (bucket_id, name, owner) values ('evidence', $1, $2)`,
    [`${BOB}/${bobCase}/photo.jpg`, BOB],
  );
});

afterAll(async () => {
  await db?.teardown();
});

describe("cases", () => {
  it("a user sees only their own cases", async () => {
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select id from public.cases")).rows,
    );
    expect(rows.map((r) => r.id)).toEqual([aliceCase]);
  });

  it("a user cannot read another user's case by id", async () => {
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select id from public.cases where id = $1", [bobCase])).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it("a user cannot update another user's case", async () => {
    const count = await db.asUser(ALICE, async (c) =>
      (await c.query("update public.cases set title = 'pwned' where id = $1", [bobCase])).rowCount,
    );
    expect(count).toBe(0);
    const { rows } = await db.admin.query("select title from public.cases where id = $1", [bobCase]);
    expect(rows[0].title).toBe("Bob sofa");
  });

  it("a user cannot delete another user's case", async () => {
    const count = await db.asUser(ALICE, async (c) =>
      (await c.query("delete from public.cases where id = $1", [bobCase])).rowCount,
    );
    expect(count).toBe(0);
  });

  it("a user cannot create a case owned by someone else", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.cases (user_id, title) values ($1, 'x')", [BOB]),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("a user cannot hand their case to someone else", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "update public.cases set user_id = $1 where id = $2", [BOB, aliceCase]),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("a user can create a case for themselves, owned by them by default", async () => {
    const row = await db.asUser(ALICE, async (c) =>
      (await c.query("insert into public.cases (title) values ('New') returning user_id")).rows[0],
    );
    expect(row.user_id).toBe(ALICE);
  });
});

describe("child tables", () => {
  for (const table of ["events", "evidence", "transcripts", "sar_requests", "reminders"]) {
    it(`${table}: another user's rows are invisible`, async () => {
      const rows = await db.asUser(ALICE, async (c) =>
        (await c.query(`select id from public.${table} where user_id = $1`, [BOB])).rows,
      );
      expect(rows).toHaveLength(0);
    });
  }

  it("a user cannot add an event to another user's case", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(
        c,
        "insert into public.events (case_id, type, occurred_at) values ($1, 'note', now())",
        [bobCase],
      ),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("a user cannot move their own event into another user's case", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "update public.events set case_id = $1 where id = $2", [bobCase, aliceEvent]),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("a user cannot attach evidence to another user's case", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(
        c,
        `insert into public.evidence (case_id, storage_path, sha256, mime, size, source)
         values ($1, 'x/y.jpg', $2, 'image/jpeg', 1, 'photo')`,
        [bobCase, HASH],
      ),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("a user cannot add a transcript to another user's evidence", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.transcripts (evidence_id, text) values ($1, 'x')", [
        bobEvidence,
      ]),
    );
    expect(err).toMatch(/row-level security/);
  });

  it("a user cannot update another user's event", async () => {
    const count = await db.asUser(ALICE, async (c) =>
      (await c.query("update public.events set notes = 'x' where id = $1", [bobEvent])).rowCount,
    );
    expect(count).toBe(0);
  });

  it("recorded_at is set by the server, not the client", async () => {
    const row = await db.asUser(ALICE, async (c) =>
      (
        await c.query(
          `insert into public.events (case_id, type, occurred_at, recorded_at)
           values ($1, 'note', now(), '2000-01-01') returning recorded_at`,
          [aliceCase],
        )
      ).rows[0],
    );
    expect(new Date(row.recorded_at).getFullYear()).toBeGreaterThan(2000);
  });
});

describe("profiles", () => {
  it("are created on sign-up and visible only to their owner", async () => {
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select id from public.profiles")).rows,
    );
    expect(rows.map((r) => r.id)).toEqual([ALICE]);
  });

  it("cannot be updated by another user", async () => {
    const count = await db.asUser(ALICE, async (c) =>
      (await c.query("update public.profiles set display_name = 'x' where id = $1", [BOB]))
        .rowCount,
    );
    expect(count).toBe(0);
  });
});

describe("audit_log", () => {
  it("records case creation with a SHA-256 hash", async () => {
    const { rows } = await db.admin.query(
      "select action, entity, hash from public.audit_log where entity_id = $1",
      [aliceCase],
    );
    expect(rows[0]).toMatchObject({ action: "insert", entity: "cases" });
    expect(rows[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a user sees only their own entries", async () => {
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select distinct user_id from public.audit_log")).rows,
    );
    expect(rows.map((r) => r.user_id)).toEqual([ALICE]);
  });

  it("cannot be written, edited or deleted by users", async () => {
    await db.asUser(ALICE, async (c) => {
      expect(
        await queryError(
          c,
          "insert into public.audit_log (user_id, action, entity, hash) values ($1, 'x', 'x', 'x')",
          [ALICE],
        ),
      ).toMatch(/permission denied/);
      expect(await queryError(c, "update public.audit_log set action = 'x'")).toMatch(
        /permission denied/,
      );
      expect(await queryError(c, "delete from public.audit_log")).toMatch(/permission denied/);
    });
  });

  it("is append-only even for the database owner", async () => {
    await db.asOwner(async (c) => {
      expect(await queryError(c, "update public.audit_log set action = 'x'")).toMatch(
        /append-only/,
      );
      expect(await queryError(c, "delete from public.audit_log")).toMatch(/append-only/);
      expect(await queryError(c, "truncate public.audit_log")).toMatch(/append-only/);
    });
  });
});

describe("anonymous access", () => {
  for (const table of ["profiles", "cases", "events", "evidence", "audit_log"]) {
    it(`anon cannot read ${table}`, async () => {
      const err = await db.asAnon((c) => queryError(c, `select * from public.${table}`));
      expect(err).toMatch(/permission denied/);
    });
  }
});

describe("storage", () => {
  it("a user cannot read another user's evidence files", async () => {
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select name from storage.objects")).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it("a user can upload into their own folder only", async () => {
    await db.asUser(ALICE, async (c) => {
      expect(
        await queryError(
          c,
          "insert into storage.objects (bucket_id, name) values ('evidence', $1)",
          [`${ALICE}/${aliceCase}/a.jpg`],
        ),
      ).toBeNull();
      expect(
        await queryError(
          c,
          "insert into storage.objects (bucket_id, name) values ('evidence', $1)",
          [`${BOB}/${bobCase}/b.jpg`],
        ),
      ).toMatch(/row-level security/);
    });
  });

  it("uploaded files cannot be overwritten", async () => {
    const count = await db.asUser(BOB, async (c) =>
      (await c.query("update storage.objects set name = name || '.x'")).rowCount,
    );
    expect(count).toBe(0);
  });
});
