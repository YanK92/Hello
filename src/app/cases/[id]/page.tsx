import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CaseView } from "@/components/case-view";
import type { Entry } from "@/components/entries/entry-list";
import type { EvidenceItem } from "@/components/evidence/evidence-list";
import { formatDateTime } from "@/lib/format";
import { createClient, currentUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Case" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THUMB_SECONDS = 10 * 60;

async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const userId = await currentUserId();
  if (!userId) redirect(`/login?next=/cases/${id}`);

  const supabase = await createClient();
  // RLS returns no row for cases the user does not own, so this is a 404.
  const { data: c } = await supabase
    .from("cases")
    .select("id, title, item_description, trader_name, finance_provider, agreement_reference, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const [{ data: events }, { data: evidence }] = await Promise.all([
    supabase
      .from("events")
      .select("id, type, occurred_at, recorded_at, notes, lat, lng, location_accuracy_m, location_label")
      .eq("case_id", id)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("evidence")
      .select(
        "id, event_id, storage_path, sha256, mime, size, original_name, uploaded_at, hash_verified_at, last_checked_at, last_check_ok",
      )
      .eq("case_id", id)
      .order("uploaded_at", { ascending: false }),
  ]);

  const imagePaths = (evidence ?? []).filter((e) => e.mime.startsWith("image/")).map((e) => e.storage_path);
  const signed = imagePaths.length
    ? (await supabase.storage.from("evidence").createSignedUrls(imagePaths, THUMB_SECONDS)).data ?? []
    : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const entries: Entry[] = (events ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    occurredAt: e.occurred_at,
    recordedAt: e.recorded_at,
    notes: e.notes,
    lat: e.lat,
    lng: e.lng,
    accuracy: e.location_accuracy_m,
    locationLabel: e.location_label,
    evidenceCount: (evidence ?? []).filter((x) => x.event_id === e.id).length,
  }));

  const items: EvidenceItem[] = (evidence ?? []).map((e) => ({
    id: e.id,
    name: e.original_name ?? "Untitled file",
    mime: e.mime,
    size: e.size,
    sha256: e.sha256,
    uploadedAt: e.uploaded_at,
    hashVerifiedAt: e.hash_verified_at,
    lastCheckedAt: e.last_checked_at,
    lastCheckOk: e.last_check_ok,
    thumbUrl: urlFor.get(e.storage_path) ?? null,
  }));

  const details: [string, string | null][] = [
    ["Item", c.item_description],
    ["Seller or trader", c.trader_name],
    ["Finance provider", c.finance_provider],
    ["Reference", c.agreement_reference],
    ["Started", formatDateTime(c.created_at)],
  ];

  return (
    <CaseView
      title={c.title}
      details={details}
      entries={entries}
      items={items}
      uploadTarget={{ userId, caseId: id, eventId: null }}
    />
  );
}

export default function CasePage({ params }: PageProps<"/cases/[id]">) {
  return (
    <div className="stack">
      <p>
        <Link href="/cases">← My cases</Link>
      </p>
      <Suspense fallback={<p className="muted">Loading case…</p>}>
        <CaseDetail params={params} />
      </Suspense>
    </div>
  );
}
