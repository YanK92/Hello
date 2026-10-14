/**
 * Renders search extracts from Postgres ts_headline, where matches are wrapped
 * in <mark>…</mark>. Everything is rendered as text; only the mark tags
 * become elements, so transcript content can never inject HTML.
 */
export function MarkedText({ text }: { text: string }) {
  const parts = text.split(/(<mark>|<\/mark>)/);
  let inMark = false;
  const out: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part === "<mark>") inMark = true;
    else if (part === "</mark>") inMark = false;
    else if (part) out.push(inMark ? <mark key={i}>{part}</mark> : part);
  });
  return <>{out}</>;
}
