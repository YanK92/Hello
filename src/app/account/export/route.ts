import { strToU8, zipSync, type Zippable } from "fflate";
import { NextResponse } from "next/server";
import { listEvidencePaths } from "@/lib/account/storage";
import { RATE_LIMIT_MESSAGE, withinLimit } from "@/lib/rate-limit";
import { createClient, currentUserId } from "@/lib/supabase/server";

// Everything stored about the signed-in user, as JSON, plus their files.
// Read through the user's own client, so RLS guarantees it is only theirs.

const TABLES = [
  "profiles",
  "cases",
  "events",
  "event_revisions",
  "event_evidence",
  "evidence",
  "transcripts",
  "transcript_highlights",
  "sar_requests",
  "sar_responses",
  "reminders",
  "contacts",
  "document_notes",
  "entitlements",
  "audit_log",
] as const;

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!(await withinLimit("account_export"))) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });

  const supabase = await createClient();
  const data: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: userId };
  for (const table of TABLES) {
    const columns = table === "transcripts" ? "id, evidence_id, case_id, text, segments, model, status, source, created_at, updated_at" : "*";
    const { data: rows, error } = await supabase.from(table).select(columns);
    if (error) return NextResponse.json({ error: `Could not read ${table}` }, { status: 500 });
    data[table] = rows;
  }

  const entries: Zippable = { "data.json": strToU8(JSON.stringify(data, null, 2)) };
  const sums: string[] = [];
  const hashFor = new Map(((data.evidence as { storage_path: string; sha256: string }[]) ?? []).map((e) => [e.storage_path, e.sha256]));
  for (const path of await listEvidencePaths(supabase, userId)) {
    const { data: blob } = await supabase.storage.from("evidence").download(path);
    if (!blob) continue;
    const name = `files/${path.slice(userId.length + 1)}`;
    entries[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    const sha = hashFor.get(path);
    if (sha) sums.push(`${sha}  ${name}\n`);
  }
  entries["SHA256SUMS"] = strToU8(sums.join(""));
  entries["README.txt"] = strToU8(
    "Your Evidence Locker data.\n\ndata.json holds every record stored for your account. files/ holds your uploaded files,\narranged by case id. Check the files with: sha256sum -c SHA256SUMS\n",
  );

  return new NextResponse(Buffer.from(zipSync(entries)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="evidence-locker-my-data-${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
