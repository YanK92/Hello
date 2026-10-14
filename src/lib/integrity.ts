// SHA-256 fingerprints for evidence files. Uses Web Crypto, so the same code
// runs in the browser (hash before upload) and on the server (verify after).

export type HashInput = ArrayBuffer | Uint8Array | Blob;

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function isSha256Hex(value: string): boolean {
  return SHA256_HEX.test(value);
}

export async function sha256Hex(input: HashInput): Promise<string> {
  const data: BufferSource =
    input instanceof Blob ? await input.arrayBuffer() : (input as BufferSource);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface IntegrityResult {
  ok: boolean;
  /** Hash of the bytes actually checked. */
  actual: string;
}

/** Re-hashes the bytes and compares with the hash recorded at upload. */
export async function checkIntegrity(input: HashInput, expected: string): Promise<IntegrityResult> {
  const actual = await sha256Hex(input);
  const normalised = expected.toLowerCase();
  return { ok: isSha256Hex(normalised) && actual === normalised, actual };
}
