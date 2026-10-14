import type { Metadata } from "next";
import { NewCaseForm } from "./new-case-form";

export const metadata: Metadata = { title: "Start a case" };

export default function NewCasePage() {
  return (
    <div className="stack">
      <h1>Start a case</h1>
      <p className="muted">
        Add what you know now. You can add evidence, notes and dates once the case is saved.
      </p>
      <NewCaseForm />
    </div>
  );
}
