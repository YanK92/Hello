// Upload rules shared by the browser (early feedback) and the server (the
// check that counts). Keep in step with the bucket limits in the migrations.

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

const TYPES = {
  "image/jpeg": { ext: "jpg", source: "photo" },
  "image/png": { ext: "png", source: "photo" },
  "image/webp": { ext: "webp", source: "photo" },
  "image/heic": { ext: "heic", source: "photo" },
  "image/heif": { ext: "heif", source: "photo" },
  "application/pdf": { ext: "pdf", source: "doc" },
} as const;

export type EvidenceMime = keyof typeof TYPES;
export type EvidenceSource = (typeof TYPES)[EvidenceMime]["source"];

export const ACCEPTED_MIME_TYPES = Object.keys(TYPES) as EvidenceMime[];

export function isAcceptedMime(mime: string): mime is EvidenceMime {
  return Object.hasOwn(TYPES, mime);
}

export function sourceForMime(mime: EvidenceMime): EvidenceSource {
  return TYPES[mime].source;
}

/** Returns a reason the file cannot be uploaded, or null if it is fine. */
export function rejectReason(file: { type: string; size: number }): string | null {
  if (!isAcceptedMime(file.type)) return "Only photos (JPEG, PNG, WebP, HEIC) and PDFs can be added.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_EVIDENCE_BYTES) return "Files must be 25 MB or smaller.";
  return null;
}

/**
 * Storage key for a new file: "<user>/<case>/<random id>.<ext>". The user id
 * prefix is what the storage RLS policy checks; the original file name is
 * kept in the database, never in the path.
 */
export function evidencePath(userId: string, caseId: string, fileId: string, mime: EvidenceMime) {
  return `${userId}/${caseId}/${fileId}.${TYPES[mime].ext}`;
}

/** True if path is a file directly inside this user's folder for this case. */
export function pathBelongsTo(path: string, userId: string, caseId: string): boolean {
  const prefix = `${userId}/${caseId}/`;
  return path.startsWith(prefix) && /^[0-9a-f-]{36}\.[a-z]{3,4}$/.test(path.slice(prefix.length));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
