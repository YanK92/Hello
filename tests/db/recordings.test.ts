import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, queryError, type TestDb } from "./harness";

// Phase 3 rules: transcripts belong to a recording (audio evidence), are
// searchable within the owner's own cases only, and can carry highlights
// and notes that only the owner can see.

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const HASH = "e".repeat(64);

let db: TestDb;
let aliceCase: string;
let bobCase: string;
let aliceAudio: string;
let aliceAudio2: string;
let bobAudio: string;
let aliceTranscript: string;
let bobTranscript: string;

const SEGMENTS = JSON.stringify([
  { start: 0, end: 4.2, speaker: "Me", text: "Hello, I'm calling about my car." },
  { start: 4.2, end: 9.8, speaker: "Dealer", text: "We can book an inspection for next Tuesday." },
  { start: 9.8, end: 14, speaker: "Me", text: "Can you confirm that by email?" },
]);
const TEXT = "Hello, I'm calling about my car. We can book an inspection for next Tuesday. Can you confirm that by email?";

async function audio(caseId: string, userId: string, name: string) {
  const { rows } = await db.admin.query<{ id: string }>(
    `insert into public.evidence (case_id, user_id, storage_path, sha256, mime, size, source)
     values ($1, $2, $3, $4, 'audio/mp4', 1000, 'audio') returning id`,
    [caseId, userId, `${userId}/${caseId}/${name}`, HASH],
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await createTestDb();
  const { admin } = db;
  await admin.query("insert into auth.users (id, email) values ($1, 'a@example.test'), ($2, 'b@example.test')", [
    ALICE,
    BOB,
  ]);
  const cases = await admin.query<{ id: string }>(
    "insert into public.cases (user_id, title) values ($1, 'Car'), ($2, 'Bob') returning id",
    [ALICE, BOB],
  );
  [aliceCase, bobCase] = cases.rows.map((r) => r.id);
  aliceAudio = await audio(aliceCase, ALICE, "call1.m4a");
  aliceAudio2 = await audio(aliceCase, ALICE, "call2.m4a");
  bobAudio = await audio(bobCase, BOB, "bob.m4a");
  aliceTranscript = (
    await admin.query<{ id: string }>(
      `insert into public.transcripts (evidence_id, user_id, text, segments, status, source)
       values ($1, $2, $3, $4, 'done', 'import') returning id`,
      [aliceAudio, ALICE, TEXT, SEGMENTS],
    )
  ).rows[0].id;
  bobTranscript = (
    await admin.query<{ id: string }>(
      `insert into public.transcripts (evidence_id, user_id, text, status, source)
       values ($1, $2, 'Bob also talks about an inspection', 'done', 'import') returning id`,
      [bobAudio, BOB],
    )
  ).rows[0].id;
});

afterAll(async () => {
  await db?.teardown();
});

describe("transcripts", () => {
  it("know their case, filled in from the recording", async () => {
    const { rows } = await db.admin.query("select case_id from public.transcripts where id = $1", [aliceTranscript]);
    expect(rows[0].case_id).toBe(aliceCase);
  });

  it("one transcript per recording", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.transcripts (evidence_id, text) values ($1, 'again')", [aliceAudio]),
    );
    expect(err).toMatch(/duplicate key|unique/);
  });

  it("a user can add a transcript to their own recording", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.transcripts (evidence_id, text, source) values ($1, 'typed up', 'import')", [
        aliceAudio2,
      ]),
    );
    expect(err).toBeNull();
  });

  it("only audio evidence can have a transcript", async () => {
    const photo = (
      await db.admin.query<{ id: string }>(
        `insert into public.evidence (case_id, user_id, storage_path, sha256, mime, size, source)
         values ($1, $2, $3, $4, 'image/jpeg', 1, 'photo') returning id`,
        [aliceCase, ALICE, `${ALICE}/${aliceCase}/p.jpg`, HASH],
      )
    ).rows[0].id;
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "insert into public.transcripts (evidence_id, text) values ($1, 'x')", [photo]),
    );
    expect(err).toMatch(/recording/);
  });

  it("rejects an unknown status", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(c, "update public.transcripts set status = 'guessed' where id = $1", [aliceTranscript]),
    );
    expect(err).toMatch(/check constraint/);
  });

  it("changes are audited", async () => {
    const { rows } = await db.admin.query(
      "select action from public.audit_log where entity = 'transcripts' and entity_id = $1",
      [aliceTranscript],
    );
    expect(rows.map((r) => r.action)).toContain("insert");
  });
});

describe("transcript search", () => {
  it("finds words in the user's own transcripts, with a highlighted extract", async () => {
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select evidence_id, headline from public.search_transcripts($1, $2)", [aliceCase, "inspection"]))
        .rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].evidence_id).toBe(aliceAudio);
    expect(rows[0].headline).toMatch(/<mark>inspection<\/mark>/i);
  });

  it("matches word forms (stemming) and phrases", async () => {
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select 1 from public.search_transcripts($1, $2)", [aliceCase, '"confirm that" calling'])).rows,
    );
    expect(rows).toHaveLength(1);
  });

  it("never returns another user's transcripts, even with their case id", async () => {
    const rows = await db.asUser(ALICE, async (c) =>
      (await c.query("select 1 from public.search_transcripts($1, $2)", [bobCase, "inspection"])).rows,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("highlights", () => {
  it("a user can highlight segments of their transcript with a note", async () => {
    const row = await db.asUser(ALICE, async (c) =>
      (
        await c.query(
          `insert into public.transcript_highlights (transcript_id, start_segment, end_segment, quote, note)
           values ($1, 1, 1, 'We can book an inspection for next Tuesday.', 'Date offered') returning case_id, user_id`,
          [aliceTranscript],
        )
      ).rows[0],
    );
    expect(row).toEqual({ case_id: aliceCase, user_id: ALICE });
  });

  it("segment ranges must be valid", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(
        c,
        `insert into public.transcript_highlights (transcript_id, start_segment, end_segment, quote)
         values ($1, 2, 1, 'x')`,
        [aliceTranscript],
      ),
    );
    expect(err).toMatch(/check constraint/);
  });

  it("a user cannot highlight another user's transcript", async () => {
    const err = await db.asUser(ALICE, (c) =>
      queryError(
        c,
        `insert into public.transcript_highlights (transcript_id, start_segment, end_segment, quote)
         values ($1, 0, 0, 'x')`,
        [bobTranscript],
      ),
    );
    expect(err).toMatch(/row-level security|transcript/);
  });

  it("other users cannot see, edit or delete highlights", async () => {
    await db.admin.query(
      `insert into public.transcript_highlights (transcript_id, start_segment, end_segment, quote)
       values ($1, 0, 0, 'Bob highlight')`,
      [bobTranscript],
    );
    await db.asUser(ALICE, async (c) => {
      expect((await c.query("select 1 from public.transcript_highlights where quote = 'Bob highlight'")).rows).toHaveLength(0);
      expect((await c.query("update public.transcript_highlights set note = 'x' where quote = 'Bob highlight'")).rowCount).toBe(0);
      expect((await c.query("delete from public.transcript_highlights where quote = 'Bob highlight'")).rowCount).toBe(0);
    });
  });
});

describe("recording notice", () => {
  it("the user's acknowledgement is stored on their profile", async () => {
    const row = await db.asUser(ALICE, async (c) =>
      (
        await c.query("update public.profiles set recording_notice_ack_at = now() where id = $1 returning recording_notice_ack_at", [
          ALICE,
        ])
      ).rows[0],
    );
    expect(row.recording_notice_ack_at).not.toBeNull();
  });
});

describe("evidence bucket", () => {
  it("accepts call recordings up to 100 MB", async () => {
    const { rows } = await db.admin.query(
      "select file_size_limit, allowed_mime_types from storage.buckets where id = 'evidence'",
    );
    expect(Number(rows[0].file_size_limit)).toBe(100 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).toEqual(expect.arrayContaining(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"]));
  });
});
