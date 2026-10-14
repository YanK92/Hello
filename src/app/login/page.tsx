import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForms } from "./login-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="stack">
      <h1>Sign in</h1>
      <p className="muted">Your cases and evidence are private to your account.</p>
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <LoginForms />
      </Suspense>
    </div>
  );
}
