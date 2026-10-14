import "server-only";

/**
 * Malware scan hook for uploads. Off until a scanning service is chosen.
 * When VIRUS_SCAN_URL is set, each uploaded file is POSTed to it as raw bytes
 * (Content-Type set to the file's type, optional bearer VIRUS_SCAN_TOKEN) and
 * the service must answer JSON { "clean": boolean }. A small adapter in front
 * of ClamAV, or a hosted scanner, can provide this.
 *
 * Fails closed: if the scanner is configured but errors, the upload is refused.
 */
export async function scanUpload(blob: Blob, mime: string): Promise<{ clean: boolean; scanned: boolean }> {
  const url = process.env.VIRUS_SCAN_URL;
  if (!url) return { clean: true, scanned: false };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": mime,
        ...(process.env.VIRUS_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.VIRUS_SCAN_TOKEN}` } : {}),
      },
      body: blob,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { clean: false, scanned: true };
    const body = (await res.json()) as { clean?: unknown };
    return { clean: body.clean === true, scanned: true };
  } catch {
    return { clean: false, scanned: true };
  }
}
