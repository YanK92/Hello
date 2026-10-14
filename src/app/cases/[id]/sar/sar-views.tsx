import Link from "next/link";
import { CaseTabs } from "@/components/case-tabs";
import { EvidenceList } from "@/components/evidence/evidence-list";
import { RemindersToggle } from "@/components/sar/reminders-toggle";
import { DueText, SAR_STATUS_LABELS } from "@/components/sar/sar-dates";
import { LetterActions, MarkSentForm, ResponseForm, StatusActions } from "@/components/sar/sar-detail-parts";
import { SarExplainer } from "@/components/sar/sar-explainer";
import { SarList } from "@/components/sar/sar-list";
import { UpgradeCard } from "@/components/upgrade-card";
import type { SarDetail, SarSummary } from "@/lib/cases/sar";
import { formatLongDate } from "@/lib/sar/letter-dates";

/** The Data requests tab. Used by the real page and the dev preview. */
export function SarListView({
  caseId,
  title,
  sars,
  remindersOn,
  now,
  paid = true,
}: {
  caseId: string;
  title: string;
  sars: SarSummary[];
  remindersOn: boolean;
  now?: Date;
  paid?: boolean;
}) {
  return (
    <>
      <h1>{title}</h1>
      <CaseTabs caseId={caseId} active="sar" />
      <p className="muted">
        A subject access request (SAR) asks an organisation for a copy of the personal information it holds about you.
        This helper prepares a letter from the options you choose, records when you sent it, and tracks what comes back.
      </p>
      {paid ? (
        <Link href={`/cases/${caseId}/sar/new`} className="button">
          Prepare a request
        </Link>
      ) : (
        <UpgradeCard feature="The data request helper" />
      )}
      <SarList caseId={caseId} sars={sars} now={now} />
      <section className="card stack-sm" aria-label="Reminders">
        <RemindersToggle initial={remindersOn} />
      </section>
      <SarExplainer />
    </>
  );
}

export function SarDetailView({
  caseId,
  userId,
  sar,
  now,
}: {
  caseId: string;
  userId: string;
  sar: SarDetail;
  now?: Date;
}) {
  const subject = `Subject access request: ${sar.requester.fullName}`;
  return (
    <>
      <p>
        <Link href={`/cases/${caseId}/sar`}>← Data requests</Link>
      </p>
      <div className="entry-head">
        <h1 className="break">{sar.recipient}</h1>
        <span className="status-pill" data-status={sar.status}>
          {SAR_STATUS_LABELS[sar.status]}
        </span>
      </div>

      {sar.sentOn && sar.dueOn && (
        <section className="card stack-sm due-card" aria-label="Dates">
          <strong>
            {sar.status === "sent" ? <DueText dueOn={sar.dueOn} now={now} /> : `Response date: ${formatLongDate(sar.dueOn)}`}
          </strong>
          <span className="small">
            Sent {formatLongDate(sar.sentOn)}
            {sar.receivedOn ? ` · received by them ${formatLongDate(sar.receivedOn)}` : " · received date not recorded"}
          </span>
          {sar.extendedDueOn && (
            <span className="small muted">
              If the organisation extends the time limit, the latest date would be {formatLongDate(sar.extendedDueOn)}.
            </span>
          )}
        </section>
      )}

      <section className="card stack-sm" aria-labelledby="letter-heading">
        <h2 id="letter-heading" className="card-title">
          {sar.status === "draft" ? "Your letter (draft)" : "Your letter"}
        </h2>
        <LetterActions caseId={caseId} sarId={sar.id} subject={subject} body={sar.letterText} recipientEmail={sar.recipientEmail} />
        <details>
          <summary className="small">Show the letter</summary>
          <pre className="letter">{sar.letterText}</pre>
        </details>
        {sar.status === "draft" && (
          <Link href={`/cases/${caseId}/sar/new?draft=${sar.id}`} className="small">
            Edit the letter
          </Link>
        )}
      </section>

      <section className="card stack-sm" aria-labelledby="sent-heading">
        <h2 id="sent-heading" className="card-title">
          {sar.sentOn ? "When it was sent" : "Once you have sent it"}
        </h2>
        <MarkSentForm sarId={sar.id} initial={{ sentOn: sar.sentOn, receivedOn: sar.receivedOn, method: sar.sentMethod }} />
      </section>

      {sar.status !== "draft" && (
        <section className="card stack-sm" aria-labelledby="responses-heading">
          <h2 id="responses-heading" className="card-title">
            Responses ({sar.responses.length})
          </h2>
          {sar.responses.map((r) => (
            <div key={r.id} className="response stack-sm">
              <strong className="small">Received {formatLongDate(r.receivedOn)}</strong>
              {r.description && <p className="entry-notes">{r.description}</p>}
              {r.files.length > 0 && <EvidenceList items={r.files} />}
            </div>
          ))}
          <details>
            <summary className="small">Log a response</summary>
            <ResponseForm sarId={sar.id} userId={userId} caseId={caseId} />
          </details>
        </section>
      )}

      <StatusActions sarId={sar.id} caseId={caseId} status={sar.status} />
      <SarExplainer />
    </>
  );
}
