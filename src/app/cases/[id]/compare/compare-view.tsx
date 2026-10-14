import { CaseTabs } from "@/components/case-tabs";
import { ComparePicker } from "@/components/compare/compare-picker";
import { DocumentPane, type PaneDocument } from "@/components/compare/document-pane";

export function CompareView({
  caseId,
  title,
  options,
  left,
  right,
}: {
  caseId: string;
  title: string;
  options: { id: string; name: string }[];
  left: PaneDocument | null;
  right: PaneDocument | null;
}) {
  return (
    <>
      <h1>{title}</h1>
      <CaseTabs caseId={caseId} active="compare" />
      <p className="muted">
        Look at two files next to each other and add your own notes to each. Notes are private to you and appear only
        here.
      </p>
      {options.length < 2 ? (
        <p className="muted">Add at least two files to the case to compare them.</p>
      ) : (
        <>
          <ComparePicker options={options} left={left?.id ?? null} right={right?.id ?? null} />
          <div className="compare">
            {left ? <DocumentPane doc={left} side="left" /> : <div className="card muted pane-empty">Choose the first document.</div>}
            {right ? <DocumentPane doc={right} side="right" /> : <div className="card muted pane-empty">Choose the second document.</div>}
          </div>
        </>
      )}
    </>
  );
}
