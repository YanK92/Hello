import { describe, expect, it } from "vitest";
import { checkIntegrity, isSha256Hex, sha256Hex } from "./integrity";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("sha256Hex", () => {
  it("matches the published SHA-256 test vectors", async () => {
    expect(await sha256Hex(bytes(""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex(bytes("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("accepts ArrayBuffer and Blob input", async () => {
    const expected = await sha256Hex(bytes("abc"));
    expect(await sha256Hex(bytes("abc").buffer)).toBe(expected);
    expect(await sha256Hex(new Blob(["abc"]))).toBe(expected);
  });
});

describe("checkIntegrity", () => {
  it("passes an untouched file", async () => {
    const original = bytes("photo of the dashboard warning light");
    const stored = await sha256Hex(original);
    expect(await checkIntegrity(original, stored)).toEqual({ ok: true, actual: stored });
  });

  it("flags a file with a single changed byte", async () => {
    const original = bytes("photo of the dashboard warning light");
    const stored = await sha256Hex(original);
    const tampered = original.slice();
    tampered[0] ^= 1;
    const result = await checkIntegrity(tampered, stored);
    expect(result.ok).toBe(false);
    expect(result.actual).not.toBe(stored);
  });

  it("flags a truncated file", async () => {
    const original = bytes("receipt.pdf contents");
    const stored = await sha256Hex(original);
    expect((await checkIntegrity(original.slice(0, -1), stored)).ok).toBe(false);
  });

  it("compares case-insensitively but rejects malformed hashes", async () => {
    const original = bytes("abc");
    const stored = await sha256Hex(original);
    expect((await checkIntegrity(original, stored.toUpperCase())).ok).toBe(true);
    expect((await checkIntegrity(original, "not-a-hash")).ok).toBe(false);
  });
});

describe("isSha256Hex", () => {
  it("accepts 64 lowercase hex characters only", () => {
    expect(isSha256Hex("a".repeat(64))).toBe(true);
    expect(isSha256Hex("A".repeat(64))).toBe(false);
    expect(isSha256Hex("a".repeat(63))).toBe(false);
  });
});
