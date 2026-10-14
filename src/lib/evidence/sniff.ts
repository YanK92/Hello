// Identifies a file's real type from its first bytes, so the server does not
// rely on the type the browser declared.

type Sniffed =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic"
  | "application/pdf"
  | "audio/mpeg"
  | "audio/mp4"
  | "audio/wav"
  | "audio/ogg"
  | "audio/webm"
  | "audio/aac";

const ascii = (b: Uint8Array, at: number, text: string) =>
  b.length >= at + text.length && [...text].every((c, i) => b[at + i] === c.charCodeAt(0));

const HEIF_BRANDS = ["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"];

export function sniffType(b: Uint8Array): Sniffed | null {
  if (b.length < 4) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(b, 1, "PNG")) return "image/png";
  if (ascii(b, 0, "%PDF-")) return "application/pdf";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE")) return "audio/wav";
  if (ascii(b, 0, "OggS")) return "audio/ogg";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  if (ascii(b, 0, "ID3")) return "audio/mpeg";
  if (ascii(b, 4, "ftyp")) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    return HEIF_BRANDS.includes(brand) ? "image/heic" : "audio/mp4";
  }
  // MPEG audio frame sync (MP3) vs ADTS (AAC): both start 0xFFF; layer bits differ.
  if (b[0] === 0xff && (b[1] & 0xf0) === 0xf0) return (b[1] & 0x06) === 0 ? "audio/aac" : "audio/mpeg";
  return null;
}

/** Declared types that the same content legitimately goes by. */
const SAME_AS: Record<string, Sniffed> = {
  "image/heif": "image/heic",
  "audio/x-m4a": "audio/mp4",
  "audio/x-wav": "audio/wav",
};

export function contentMatchesType(b: Uint8Array, declared: string): boolean {
  const sniffed = sniffType(b);
  return sniffed !== null && sniffed === (SAME_AS[declared] ?? declared);
}
