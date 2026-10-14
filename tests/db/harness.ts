import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const SHIM = path.join(import.meta.dirname, "supabase-shim.sql");

/**
 * Admin connection string for a throwaway Postgres server. Each test file
 * creates its own database on it, applies the shim plus every migration, and
 * drops it afterwards.
 */
export function adminUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Point it at a disposable Postgres server, " +
        "e.g. postgres://postgres:postgres@127.0.0.1:5432/postgres",
    );
  }
  return url;
}

function withDatabase(url: string, db: string): string {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

export interface TestDb {
  /** Superuser connection: bypasses RLS, used for seeding and assertions. */
  admin: Client;
  /** Runs fn as the given user (role authenticated, JWT sub = userId). */
  asUser<T>(userId: string, fn: (c: Client) => Promise<T>): Promise<T>;
  /** Runs fn as the anon role. */
  asAnon<T>(fn: (c: Client) => Promise<T>): Promise<T>;
  /** Runs fn as the superuser inside a rolled-back transaction. */
  asOwner<T>(fn: (c: Client) => Promise<T>): Promise<T>;
  teardown(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const name = `rls_test_${process.pid}_${Date.now()}`;
  const server = new Client({ connectionString: adminUrl() });
  await server.connect();
  await server.query(`create database ${name}`);

  const admin = new Client({ connectionString: withDatabase(adminUrl(), name) });
  await admin.connect();
  await admin.query(readFileSync(SHIM, "utf8"));
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await admin.query(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  async function asRole<T>(
    role: "authenticated" | "anon" | null,
    claims: Record<string, unknown>,
    fn: (c: Client) => Promise<T>,
  ): Promise<T> {
    await admin.query("begin");
    try {
      if (role) await admin.query(`set local role ${role}`);
      await admin.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(claims),
      ]);
      return await fn(admin);
    } finally {
      // Always roll back so each assertion starts from the seeded state.
      await admin.query("rollback");
    }
  }

  return {
    admin,
    asUser: (userId, fn) => asRole("authenticated", { sub: userId, role: "authenticated" }, fn),
    asAnon: (fn) => asRole("anon", { role: "anon" }, fn),
    asOwner: (fn) => asRole(null, {}, fn),
    async teardown() {
      await admin.end();
      await server.query(`drop database if exists ${name} with (force)`);
      await server.end();
    },
  };
}

/** Runs a query inside a savepoint and returns the error message, if any. */
export async function queryError(
  c: Client,
  sql: string,
  params: unknown[] = [],
): Promise<string | null> {
  await c.query("savepoint attempt");
  try {
    await c.query(sql, params);
    await c.query("release savepoint attempt");
    return null;
  } catch (err) {
    await c.query("rollback to savepoint attempt");
    return (err as Error).message;
  }
}
