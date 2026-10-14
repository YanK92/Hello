"use client";

import { usePathname, useRouter } from "next/navigation";

export function ComparePicker({
  options,
  left,
  right,
}: {
  options: { id: string; name: string }[];
  left: string | null;
  right: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  function choose(side: "left" | "right", id: string) {
    const params = new URLSearchParams();
    const l = side === "left" ? id : left;
    const r = side === "right" ? id : right;
    if (l) params.set("left", l);
    if (r) params.set("right", r);
    router.replace(`${pathname}?${params}`);
  }
  return (
    <div className="two-col">
      {(["left", "right"] as const).map((side) => (
        <div className="field" key={side}>
          <label htmlFor={`compare-${side}`}>{side === "left" ? "First document" : "Second document"}</label>
          <select id={`compare-${side}`} value={(side === "left" ? left : right) ?? ""} onChange={(e) => choose(side, e.target.value)}>
            <option value="">Choose a file</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
