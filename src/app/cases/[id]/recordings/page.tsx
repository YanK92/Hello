import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireCaseSummary } from "@/lib/cases/guard";
import { loadRecordings, recordingNoticeAcknowledged } from "@/lib/cases/recordings";
import { RecordingsView } from "./recordings-view";

export const metadata: Metadata = { title: "Recordings" };

async function Recordings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, caseId, title } = await requireCaseSummary(id, "/recordings");
  const [acknowledged, recordings] = await Promise.all([recordingNoticeAcknowledged(userId), loadRecordings(caseId)]);
  return (
    <RecordingsView caseId={caseId} title={title} userId={userId} acknowledged={acknowledged} recordings={recordings} />
  );
}

export default function RecordingsPage({ params }: PageProps<"/cases/[id]/recordings">) {
  return (
    <div className="stack">
      <p>
        <Link href="/cases">← My cases</Link>
      </p>
      <Suspense fallback={<p className="muted">Loading recordings…</p>}>
        <Recordings params={params} />
      </Suspense>
    </div>
  );
}
