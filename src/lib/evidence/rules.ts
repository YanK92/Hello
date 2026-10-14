// Upload rules shared by the browser (early feedback) and the server (the
// check that counts). Keep in step with the bucket limits in the migrations.

const MB = 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 25 * MB;
export const MAX_AUDIO_BYTES = 100 * MB;

const TYPES = {
  "image/jpeg": { ext: "jpg", source: "photo" },
  "image/png": { ext: "png", source: "photo" },
  "image/webp": { ext: "webp", source: "photo" },
  "image/heic": { ext: "heic", source: "photo" },
  "image/heif": { ext: "heif", source: "photo" },
  "application/pdf": { ext: "pdf", source: "doc" },
  "audio/mpeg": { ext: "mp3", source: "audio" },
  "audio/mp4": { ext: "m4a", source: "audio" },
  "audio/x-m4a": { ext: "m4a", source: "audio" },
  "audio/aac": { ext: "aac", source: "audio" },
  "audio/wav": { ext: "wav", source: "audio" },
  "audio/x-wav": { ext: "wav", source: "audio" },
  "audio/webm": { ext: "weba", source: "audio" },
  "audio/ogg": { ext: "ogg", source: "audio" },
} as const;

export type EvidenceMime = keyof typeof TYPES;
export type EvidenceSource = (typeof TYPES)[EvidenceMime]["source"];

export const ACCEPTED_MIME_TYPES = Object.keys(TYPES) as EvidenceMime[];
export const AUDIO_MIME_TYPES = ACCEPTED_MIME_TYPES.filter((m) => TYPES[m].source === "audio");
export const DOCUMENT_MIME_TYPES = ACCEPTED_MIME_TYPES.filter((m) => TYPES[m].source !== "audio");

export function maxBytesFor(mime: EvidenceMime): number {
  return TYPES[mime].source === "audio" ? MAX_AUDIO_BYTES : MAX_DOCUMENT_BYTES;
}

export function isAcceptedMime(mime: string): mime is EvidenceMime {
  return Object.hasOwn(TYPES, mime);
}

export function sourceForMime(mime: EvidenceMime): EvidenceSource {
  return TYPES[mime].source;
}

/** Returns a reason the file cannot be uploaded, or null if it is fine. */
export function rejectReason(
  file: { type: string; size: number },
  allowed: readonly EvidenceMime[] = DOCUMENT_MIME_TYPES,
): string | null {
  if (!isAcceptedMime(file.type) || !allowed.includes(file.type)) {
    return allowed.every((m) => TYPES[m].source === "audio")
      ? "Only audio recordings (MP3, M4A, AAC, WAV, WebM, Ogg) can be added here."
      : "Only photos (JPEG, PNG, WebP, HEIC) and PDFs can be added here.";
  }
  if (file.size === 0) return "This file is empty.";
  if (file.size > maxBytesFor(file.type)) {
    return `Files of this type must be ${maxBytesFor(file.type) / MB} MB or smaller.`;
  }
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
  return path.startsWith(prefix) && /^[0-9a-f-]{36}\.[a-z0-9]{3,4}$/.test(path.slice(prefix.length));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
