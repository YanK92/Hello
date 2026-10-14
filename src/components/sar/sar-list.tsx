import Link from "next/link";
import type { SarSummary } from "@/lib/cases/sar";
import { formatLongDate } from "@/lib/sar/letter-dates";
import { DueText, SAR_STATUS_LABELS } from "./sar-dates";

export function SarList({ caseId, sars, now }: { caseId: string; sars: SarSummary[]; now?: Date }) {
  if (!sars.length) return <p className="muted">No requests yet.</p>;
  return (
    <ul className="evidence-list">
      {sars.map((s) => (
        <li key={s.id} className="card sar-item">
          <div className="entry-head">
            <Link href={`/cases/${caseId}/sar/${s.id}`} className="entry-type">
              {s.recipient}
            </Link>
            <span className="status-pill" data-status={s.status}>
              {SAR_STATUS_LABELS[s.status]}
            </span>
          </div>
          {s.sentOn ? (
            <span className="small">
              Sent {formatLongDate(s.sentOn)}
              {s.receivedOn && ` · received by them ${formatLongDate(s.receivedOn)}`}
            </span>
          ) : (
            <span className="small muted">Not sent yet</span>
          )}
          {s.dueOn && s.status === "sent" && (
            <span className="small">
              <DueText dueOn={s.dueOn} now={now} />
            </span>
          )}
          {s.responseCount > 0 && (
            <span className="small muted">
              {s.responseCount} response{s.responseCount === 1 ? "" : "s"} logged
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
