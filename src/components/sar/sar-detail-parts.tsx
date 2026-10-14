"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteSarDraft, logSarResponse, markSarSent, setSarStatus } from "@/app/cases/sar-actions";
import { EvidenceUploader } from "@/components/evidence/evidence-uploader";
import { todayInUk } from "@/lib/sar/dates";
import { mailtoLink } from "@/lib/sar/letter";

export function LetterActions({
  caseId,
  sarId,
  subject,
  body,
  recipientEmail,
}: {
  caseId: string;
  sarId: string;
  subject: string;
  body: string;
  recipientEmail: string | null;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="button-row">
      <a className="button" href={`/cases/${caseId}/sar/${sarId}/letter`} download>
        Download PDF
      </a>
      <button
        type="button"
        className="button"
        data-variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(`${subject}\n\n${body}`);
          setCopied(true);
        }}
      >
        {copied ? "Copied" : "Copy text"}
      </button>
      {recipientEmail && (
        <a className="button" data-variant="secondary" href={mailtoLink(recipientEmail, subject, body)}>
          Open in email app
        </a>
      )}
    </div>
  );
}

export function MarkSentForm({
  sarId,
  initial,
}: {
  sarId: string;
  initial?: { sentOn: string | null; receivedOn: string | null; method: string | null };
}) {
  const router = useRouter();
  const [sentOn, setSentOn] = useState(initial?.sentOn ?? "");
  const [receivedOn, setReceivedOn] = useState(initial?.receivedOn ?? "");
  const [method, setMethod] = useState(initial?.method ?? "email");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await markSarSent(sarId, { sentOn: sentOn || todayInUk(), receivedOn, method });
          if (result.ok) router.refresh();
          else setError(result.error);
        });
      }}
    >
      <div className="two-col">
        <div className="field">
          <label htmlFor="sar-sent-on">Date you sent it</label>
          <input id="sar-sent-on" type="date" required value={sentOn} onChange={(e) => setSentOn(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sar-method">How you sent it</label>
          <select id="sar-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="email">Email</option>
            <option value="post">Post</option>
            <option value="online_form">Online form</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="sar-received-on">
          Date the organisation received it <span className="muted">(if you know)</span>
        </label>
        <span className="hint">The time limit starts from this date. If left blank, the sent date is used.</span>
        <input id="sar-received-on" type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : initial?.sentOn ? "Update dates" : "Record as sent"}
      </button>
    </form>
  );
}

export function ResponseForm({ sarId, userId, caseId }: { sarId: string; userId: string; caseId: string }) {
  const router = useRouter();
  const [receivedOn, setReceivedOn] = useState("");
  const [description, setDescription] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (eventId) {
    return (
      <div className="stack-sm">
        <p className="notice">Response logged. Add the files you received:</p>
        <EvidenceUploader target={{ userId, caseId, eventId }} />
        <button
          type="button"
          className="button"
          data-variant="secondary"
          onClick={() => {
            setEventId(null);
            setReceivedOn("");
            setDescription("");
            router.refresh();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await logSarResponse(sarId, { receivedOn: receivedOn || todayInUk(), description });
          if (result.ok) {
            setEventId(result.eventId);
            router.refresh();
          } else setError(result.error);
        });
      }}
    >
      <div className="field">
        <label htmlFor="sar-response-date">Date received</label>
        <input id="sar-response-date" type="date" required value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="sar-response-description">
          What was received <span className="muted">(optional)</span>
        </label>
        <textarea
          id="sar-response-description"
          rows={3}
          maxLength={5000}
          placeholder="For example: covering letter and 42 pages of account notes, by email"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : "Log response"}
      </button>
    </form>
  );
}

export function StatusActions({ sarId, caseId, status }: { sarId: string; caseId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        if (after) after();
        else router.refresh();
      }
      else setError(result.error ?? "That did not work.");
    });
  }

  return (
    <div className="stack-sm">
      <div className="entry-actions">
        {status === "draft" && (
          <button
            type="button"
            className="link-button small danger"
            disabled={pending}
            onClick={() =>
              window.confirm("Delete this draft?") &&
              run(() => deleteSarDraft(sarId), () => router.push(`/cases/${caseId}/sar`))
            }
          >
            Delete draft
          </button>
        )}
        {(status === "sent" || status === "response_received") && (
          <button type="button" className="link-button small" disabled={pending} onClick={() => run(() => setSarStatus(sarId, "closed"))}>
            Mark as closed
          </button>
        )}
        {status === "closed" && (
          <button type="button" className="link-button small" disabled={pending} onClick={() => run(() => setSarStatus(sarId, "sent"))}>
            Reopen
          </button>
        )}
      </div>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
