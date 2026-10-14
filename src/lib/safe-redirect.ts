/** Only allow same-site relative paths, so `next` cannot send users elsewhere. */
export function safeNextPath(next: string | null | undefined, fallback = "/cases"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
