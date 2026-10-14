import "server-only";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/cases/guard";
import { hasPaidAccess, PAID_FEATURE_MESSAGE } from "@/lib/payments/access";
import { RATE_LIMIT_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/supabase/server";
import { collectExport, MAX_EXPORT_BYTES, type ExportSource } from "./collect";

/** Shared checks for export downloads: signed in, paid, owns the case, within size. */
export async function exportSourceOrError(caseId: string): Promise<ExportSource | NextResponse> {
  if (!isUuid(caseId) || !(await currentUserId())) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await hasPaidAccess())) return NextResponse.json({ error: PAID_FEATURE_MESSAGE }, { status: 402 });
  if (!(await withinLimit("export"))) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  const source = await collectExport(caseId);
  if (!source) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (source.totalBytes > MAX_EXPORT_BYTES) {
    return NextResponse.json({ error: "This case is too large to export in one go." }, { status: 413 });
  }
  return source;
}

export function download(bytes: Uint8Array, type: string, name: string) {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
