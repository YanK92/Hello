import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/cases/guard";
import { renderTextPdf } from "@/lib/pdf/text";
import { createClient, currentUserId } from "@/lib/supabase/server";

/** The SAR letter as a PDF, exactly as saved. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/cases/[id]/sar/[sarId]/letter">) {
  const { id, sarId } = await params;
  if (!isUuid(id) || !isUuid(sarId) || !(await currentUserId())) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const supabase = await createClient();
  // RLS: only the owner's request is returned.
  const { data } = await supabase
    .from("sar_requests")
    .select("letter_text, recipient")
    .eq("case_id", id)
    .eq("id", sarId)
    .maybeSingle();
  if (!data?.letter_text) return NextResponse.json({ error: "not found" }, { status: 404 });

  const pdf = await renderTextPdf({ title: `Subject access request to ${data.recipient}`, body: data.letter_text });
  const name = `subject-access-request-${data.recipient.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 40).toLowerCase() || "letter"}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
