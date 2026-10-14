/** Numbered progress indicator for multi-step forms. */
export function Steps({ labels, step }: { labels: readonly string[]; step: number }) {
  return (
    <ol className="steps" aria-label="Progress" style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}>
      {labels.map((label, i) => (
        <li key={label} data-state={i < step ? "done" : i === step ? "current" : "todo"} aria-current={i === step ? "step" : undefined}>
          <span className="step-dot">{i < step ? "✓" : i + 1}</span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
