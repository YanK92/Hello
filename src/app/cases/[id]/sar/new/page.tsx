import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SarWizard, blankSarValues, type SarValues } from "@/components/sar/sar-wizard";
import { isUuid, requireCaseSummary } from "@/lib/cases/guard";
import { caseDefaults, loadContacts, loadSar } from "@/lib/cases/sar";

export const metadata: Metadata = { title: "Prepare a data request" };

async function NewSar({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { caseId } = await requireCaseSummary(id, "/sar/new");
  const draftId = typeof query.draft === "string" && isUuid(query.draft) ? query.draft : undefined;
  const [contacts, defaults, draft] = await Promise.all([
    loadContacts(),
    caseDefaults(caseId),
    draftId ? loadSar(caseId, draftId) : null,
  ]);

  const initial: SarValues =
    draft && draft.status === "draft"
      ? {
          recipient: {
            contactId: null,
            name: draft.recipient,
            address: draft.recipientAddress ?? "",
            email: draft.recipientEmail ?? "",
            save: false,
          },
          categories: draft.categories,
          dateFrom: draft.dateFrom ?? "",
          dateTo: draft.dateTo ?? "",
          format: draft.format,
          requester: { ...blankSarValues(defaults).requester, ...draft.requester },
        }
      : blankSarValues(defaults);

  return (
    <>
      <p>
        <Link href={`/cases/${caseId}/sar`}>← Data requests</Link>
      </p>
      <h1>Prepare a data request</h1>
      <SarWizard
        caseId={caseId}
        contacts={contacts}
        initial={initial}
        sarId={draft?.status === "draft" ? draft.id : undefined}
      />
    </>
  );
}

export default function NewSarPage({ params, searchParams }: PageProps<"/cases/[id]/sar/new">) {
  return (
    <div className="stack">
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <NewSar params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
