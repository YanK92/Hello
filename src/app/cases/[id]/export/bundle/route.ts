import { NextResponse, type NextRequest } from "next/server";
import { buildBundlePdf } from "@/lib/export/bundle";
import { exportFileName } from "@/lib/export/collect";
import { download, exportSourceOrError } from "@/lib/export/route-helpers";

export async function GET(_request: NextRequest, { params }: RouteContext<"/cases/[id]/export/bundle">) {
  const { id } = await params;
  const source = await exportSourceOrError(id);
  if (source instanceof NextResponse) return source;
  const { pdf } = await buildBundlePdf(source.data, source.bytesFor);
  return download(pdf, "application/pdf", exportFileName(source.data.caseTitle, "pdf"));
}
