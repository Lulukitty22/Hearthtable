// Game-style grids (user decision, 2026-10-22): every item or spell is a tile showing its name
// until pictures are added. Hovering shows the name; clicking opens the whole entry in a panel.

import type { RecordEnvelope } from "@hearthtable/kernel";
import { useEffect, useRef, type ReactNode } from "react";

export function Tile({
  name,
  quantity,
  badges = [],
  tone,
  onOpen,
}: {
  name: string;
  quantity?: number;
  badges?: readonly string[];
  tone?: "warn" | "bad" | "muted";
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={`tile${tone ? ` tile-${tone}` : ""}`}
      title={name}
      aria-label={name}
      onClick={onOpen}
    >
      <span className="tile-name">{name}</span>
      {quantity !== undefined && quantity !== 1 && (
        <span className="tile-qty">×{quantity}</span>
      )}
      {badges.length > 0 && (
        <span className="tile-badges">
          {badges.map((b) => (
            <span key={b} className="tile-badge">
              {b}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="tile-grid">{children}</div>;
}

/** A modal panel for one entry; Escape or the close button closes it. */
export function DetailPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="detail"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="detail-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="secondary"
          onClick={onClose}
          aria-label="Close"
        >
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}

/** The definition's source line, e.g. "published · 2024 · Player's Handbook (2024)". */
export function SourceLine({ record }: { record: RecordEnvelope | undefined }) {
  if (!record) return null;
  const s = record.source;
  return (
    <p className="muted">
      {[s.status, s.edition, s.reference].filter(Boolean).join(" · ")}
      {s.confidence && <span className="badge warn">{s.confidence}</span>}
    </p>
  );
}

/** Every stored field of the definition, for the full entry. */
export function AllFields({ record }: { record: RecordEnvelope | undefined }) {
  if (!record) return null;
  return (
    <details className="notes">
      <summary>All fields ({record.id})</summary>
      <pre className="fields">{JSON.stringify(record.data, null, 2)}</pre>
    </details>
  );
}
