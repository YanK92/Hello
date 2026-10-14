import Link from "next/link";

export const CASE_TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "timeline", label: "Timeline", path: "/timeline" },
  { key: "recordings", label: "Recordings", path: "/recordings" },
  { key: "sar", label: "Data requests", path: "/sar" },
  { key: "compare", label: "Compare", path: "/compare" },
  { key: "export", label: "Export", path: "/export" },
] as const;

export type CaseTab = (typeof CASE_TABS)[number]["key"];

export function CaseTabs({ caseId, active }: { caseId: string; active: CaseTab }) {
  return (
    <nav className="tabs" aria-label="Case sections">
      {CASE_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/cases/${caseId}${tab.path}`}
          className="tab"
          aria-current={tab.key === active ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
