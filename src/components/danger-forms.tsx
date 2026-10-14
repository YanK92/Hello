"use client";

import { useState, useTransition } from "react";
import { deleteAccount, deleteCase } from "@/app/account/actions";

export function DeleteCaseForm({ caseId, title }: { caseId: string; title: string }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <details className="card danger-zone">
      <summary>Delete this case</summary>
      <form
        className="stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await deleteCase(caseId, typed);
            if (result && !result.ok) setError(result.error);
          });
        }}
      >
        <p className="small">
          This permanently deletes the case, its entries, files, recordings, transcripts and data requests. Download an
          export first if you want a copy. This cannot be undone.
        </p>
        <div className="field">
          <label htmlFor="delete-case-confirm">Type the case title to confirm: {title}</label>
          <input id="delete-case-confirm" type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button danger-button" disabled={pending || typed.trim() !== title.trim()}>
          {pending ? "Deleting…" : "Delete this case permanently"}
        </button>
      </form>
    </details>
  );
}

export function DeleteAccountForm() {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await deleteAccount(typed);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <p className="small">
        This permanently deletes your account and everything in it: all cases, files, recordings, transcripts, data
        requests and contacts. Download your data first if you want a copy. This cannot be undone.
      </p>
      <div className="field">
        <label htmlFor="delete-account-confirm">Type DELETE to confirm</label>
        <input id="delete-account-confirm" type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button danger-button" disabled={pending || typed.trim() !== "DELETE"}>
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
