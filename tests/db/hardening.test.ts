import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, queryError, type TestDb } from "./harness";

// Phase 6: per-user rate limits.

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  await db.admin.query("insert into auth.users (id, email) values ($1, 'a@example.test'), ($2, 'b@example.test')", [
    ALICE,
    BOB,
  ]);
});

afterAll(async () => {
  await db?.teardown();
});

const hit = (c: Parameters<Parameters<TestDb["asUser"]>[1]>[0], action = "upload", limit = 3) =>
  c.query("select public.rate_limit($1, $2, 3600) as ok", [action, limit]).then((r) => r.rows[0].ok as boolean);

describe("rate_limit", () => {
  it("allows up to the limit in a window, then refuses", async () => {
    await db.asUser(ALICE, async (c) => {
      expect([await hit(c), await hit(c), await hit(c), await hit(c)]).toEqual([true, true, true, false]);
    });
  });

  it("counts each user and each action separately", async () => {
    await db.asUser(ALICE, async (c) => {
      for (let i = 0; i < 3; i++) await hit(c);
      expect(await hit(c)).toBe(false);
      expect(await hit(c, "export")).toBe(true);
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: BOB })]);
      expect(await hit(c)).toBe(true);
    });
  });

  it("refuses callers who are not signed in", async () => {
    const ok = await db.asAnon(async (c) => {
      const err = await queryError(c, "select public.rate_limit('upload', 3, 3600)");
      return err;
    });
    expect(ok).toMatch(/permission denied/);
  });

  it("the counters cannot be read or reset by users", async () => {
    await db.asUser(ALICE, async (c) => {
      expect(await queryError(c, "select * from public.rate_limits")).toMatch(/permission denied/);
      expect(await queryError(c, "delete from public.rate_limits")).toMatch(/permission denied/);
    });
  });

  it("rejects silly arguments", async () => {
    await db.asUser(ALICE, async (c) => {
      expect(await queryError(c, "select public.rate_limit('', 3, 3600)")).toMatch(/invalid/);
      expect(await queryError(c, "select public.rate_limit('upload', 0, 3600)")).toMatch(/invalid/);
    });
  });
});

describe("audit log erasure", () => {
  it("stays append-only while the account exists", async () => {
    await db.admin.query("insert into public.cases (user_id, title) values ($1, 'x')", [ALICE]);
    await db.asOwner(async (c) => {
      expect(await queryError(c, "delete from public.audit_log where user_id = $1", [ALICE])).toMatch(/append-only/);
      expect(await queryError(c, "update public.audit_log set action = 'x' where user_id = $1", [ALICE])).toMatch(/append-only/);
    });
  });

  it("can be cleared for an account once that account is deleted", async () => {
    await db.asOwner(async (c) => {
      await c.query("delete from auth.users where id = $1", [ALICE]);
      expect(await queryError(c, "delete from public.audit_log where user_id = $1", [ALICE])).toBeNull();
      const { rows } = await c.query("select count(*)::int as n from public.audit_log where user_id = $1", [ALICE]);
      expect(rows[0].n).toBe(0);
    });
  });
});
