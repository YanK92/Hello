import Link from "next/link";
import { notFound } from "next/navigation";
import { PREVIEW_SCREENS, previewEnabled } from "./screens";

export default function PreviewIndex() {
  if (!previewEnabled()) notFound();
  return (
    <div className="stack">
      <h1>Screen preview</h1>
      <p className="muted">Sample data only. Nothing here is saved. Not available in production.</p>
      <ul>
        {PREVIEW_SCREENS.map((s) => (
          <li key={s}>
            <Link href={`/dev/preview/${s}`}>{s}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
