import { NextResponse, type NextRequest } from "next/server";
import { exportFileName } from "@/lib/export/collect";
import { download, exportSourceOrError } from "@/lib/export/route-helpers";
import { buildOriginalsZip } from "@/lib/export/zip";
import { sha256Hex } from "@/lib/integrity";

export async function GET(_request: NextRequest, { params }: RouteContext<"/cases/[id]/export/originals">) {
  const { id } = await params;
  const source = await exportSourceOrError(id);
  if (source instanceof NextResponse) return source;
  const files = [];
  for (const f of source.data.files) {
    const bytes = await source.bytesFor(f);
    files.push({ ...f, bytes, exportSha256: bytes ? await sha256Hex(bytes) : null });
  }
  const zip = buildOriginalsZip({ caseTitle: source.data.caseTitle, generatedAt: source.data.generatedAt, files });
  return download(zip, "application/zip", exportFileName(source.data.caseTitle, "zip"));
}
