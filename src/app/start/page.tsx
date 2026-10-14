import type { Metadata } from "next";
import { StartWizard } from "./start-wizard";

export const metadata: Metadata = { title: "Something has gone wrong" };

export default function StartPage() {
  return (
    <div className="stack">
      <div>
        <h1>Something has gone wrong</h1>
        <p className="muted">
          Record the basics now, while they are fresh. It takes about two minutes, and you can add
          more later.
        </p>
      </div>
      <StartWizard />
    </div>
  );
}
