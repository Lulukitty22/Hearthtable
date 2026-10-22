// A resolved number with its explanation (user decision, 2026-10-22): hovering shows a
// one-line summary; clicking or tapping opens the full breakdown. Unresolved values show as
// visibly unresolved with the reason, never as a usable-looking number.

import {
  formatExplanation,
  type Explanation,
  type Value,
} from "@hearthtable/kernel";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type NumberStyle = "plain" | "signed";

export function formatNumber(n: number, style: NumberStyle = "plain"): string {
  return style === "signed" && n >= 0 ? `+${n}` : String(n);
}

function Tree({ e }: { e: Explanation }) {
  return (
    <>
      <span>
        {e.label}
        {e.value !== undefined && <strong> {e.value}</strong>}
        {e.note && <span className="muted"> ({e.note})</span>}
      </span>
      {e.parts && e.parts.length > 0 && (
        <ul>
          {e.parts.map((p, i) => (
            <li key={i}>
              <Tree e={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Explained({
  value,
  style = "plain",
  children,
}: {
  value: Value<number>;
  style?: NumberStyle;
  children?: (n: number) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (value.kind === "unresolved") {
    return (
      <span className="unresolved" title={value.reason}>
        Unresolved
      </span>
    );
  }
  return (
    <span className="explained" ref={ref}>
      <button
        type="button"
        title={formatExplanation(value.explain)}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {children ? children(value.value) : formatNumber(value.value, style)}
      </button>
      {open && (
        <span className="explain-panel" role="dialog">
          <Tree e={value.explain} />
        </span>
      )}
    </span>
  );
}
