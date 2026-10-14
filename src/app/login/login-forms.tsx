"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { magicLink, passwordAuth, type AuthState } from "./actions";

function Status({ state }: { state: AuthState }) {
  if (state.error) return <p className="error" role="alert">{state.error}</p>;
  if (state.message) return <p className="notice" role="status">{state.message}</p>;
  return null;
}

export function LoginForms() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/cases";
  const linkFailed = params.get("error") === "link";
  const [pwState, pwAction, pwPending] = useActionState(passwordAuth, {});
  const [linkState, linkAction, linkPending] = useActionState(magicLink, {});

  return (
    <div className="stack">
      {linkFailed && (
        <p className="error" role="alert">
          That sign-in link has expired or was already used. Request a new one below.
        </p>
      )}
      <form action={pwAction} className="card stack" aria-labelledby="password-heading">
        <h2 id="password-heading" style={{ marginTop: 0 }}>
          Email and password
        </h2>
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
          <span className="hint">At least 8 characters.</span>
        </div>
        <Status state={pwState} />
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <button className="button" name="intent" value="sign-in" disabled={pwPending}>
            Sign in
          </button>
          <button
            className="button"
            data-variant="secondary"
            name="intent"
            value="sign-up"
            disabled={pwPending}
          >
            Create account
          </button>
        </div>
      </form>

      <form action={linkAction} className="card stack" aria-labelledby="link-heading">
        <h2 id="link-heading" style={{ marginTop: 0 }}>
          Or get a sign-in link by email
        </h2>
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="link-email">Email</label>
          <input id="link-email" name="email" type="email" autoComplete="email" required />
        </div>
        <Status state={linkState} />
        <button className="button" data-variant="secondary" disabled={linkPending}>
          Email me a link
        </button>
      </form>
    </div>
  );
}
