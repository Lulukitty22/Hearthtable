// Game-style grids (user decisions, 2026-10-22): every item or spell is a tile showing its name
// until pictures are added. Hovering shows the name; clicking opens the whole entry in a window.
// Tiles can be dragged; grids, tiles and slots can accept drops. Windows float, can be moved by
// their title bar, and stay open until closed, so items can be dragged into them. On the
// view-only sheet (`Draggable` false) nothing is dragged or dropped.

import type { RecordEnvelope } from "@hearthtable/kernel";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/** What is being dragged right now; drag events cannot read their data until the drop. */
export type Dragged =
  | {
      readonly kind: "line";
      readonly lineId: string;
      readonly quantity: number;
    }
  | {
      readonly kind: "entry";
      readonly bookRecordId: string;
      readonly entryId: string;
      readonly level: number;
    };

/** False on the view-only sheet: tiles do not drag and nothing accepts drops. */
export const Draggable = createContext(true);

let current: Dragged | undefined;
export const dragged = () => current;

/** Props that make an element accept drops; `accept` returns why it refuses, or undefined. */
export interface DropProps {
  readonly accept: (d: Dragged) => string | undefined;
  readonly onDrop: (d: Dragged, e: DragEvent) => void;
}

function useDrop(drop: DropProps | undefined) {
  const [state, setState] = useState<"none" | "ok" | "no">("none");
  const allowed = useContext(Draggable);
  if (!drop || !allowed) return { state, handlers: {} };
  return {
    state,
    handlers: {
      onDragOver: (e: DragEvent) => {
        const d = dragged();
        if (!d) return;
        const why = drop.accept(d);
        e.stopPropagation();
        if (why === undefined) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
        setState(why === undefined ? "ok" : "no");
      },
      onDragLeave: () => setState("none"),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setState("none");
        const d = dragged();
        if (d && drop.accept(d) === undefined) drop.onDrop(d, e);
      },
    },
  };
}

export function Tile({
  name,
  quantity,
  badges = [],
  tone,
  onOpen,
  drag,
  drop,
  label,
}: {
  name: string;
  quantity?: number;
  badges?: readonly string[];
  tone?: "warn" | "bad" | "muted";
  onOpen: () => void;
  /** Makes the tile draggable, carrying this. */
  drag?: Dragged;
  /** Makes the tile accept drops, such as a bag taking an item. */
  drop?: DropProps;
  /** Accessible name when it should differ from `name`. */
  label?: string;
}) {
  const { state, handlers } = useDrop(drop);
  const draggable = useContext(Draggable) && drag !== undefined;
  return (
    <button
      type="button"
      className={`tile${tone ? ` tile-${tone}` : ""}${state === "ok" ? " drop-ok" : state === "no" ? " drop-no" : ""}`}
      title={name}
      aria-label={label ?? name}
      onClick={onOpen}
      draggable={draggable}
      onDragStart={(e) => {
        if (!drag || !draggable) return;
        current = drag;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", name);
      }}
      onDragEnd={() => {
        current = undefined;
      }}
      {...handlers}
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

export function TileGrid({
  children,
  drop,
  label,
}: {
  children: ReactNode;
  drop?: DropProps;
  label?: string;
}) {
  const { state, handlers } = useDrop(drop);
  const dropZone = useContext(Draggable) && drop !== undefined;
  return (
    <div
      className={`tile-grid${dropZone ? " drop-zone" : ""}${state === "ok" ? " drop-ok" : state === "no" ? " drop-no" : ""}`}
      aria-label={label}
      {...handlers}
    >
      {children}
    </div>
  );
}

/** Any element that accepts drops, such as a chamber slot. */
export function DropTarget({
  drop,
  className,
  children,
  ...rest
}: { drop: DropProps; className?: string; children: ReactNode } & Record<
  string,
  unknown
>) {
  const { state, handlers } = useDrop(drop);
  return (
    <div
      className={`${className ?? ""}${state === "ok" ? " drop-ok" : state === "no" ? " drop-no" : ""}`}
      {...rest}
      {...handlers}
    >
      {children}
    </div>
  );
}

let opened = 0;

/**
 * A window for one entry. It stays open until its Close button. Floating windows can be moved by
 * their title bar; docked windows sit in a column beside the inventory so they never cover the
 * tiles being dragged into them.
 */
export function DetailPanel({
  title,
  onClose,
  children,
  docked = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  docked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pos, setPos] = useState(() => {
    const n = opened++ % 6;
    return {
      x: Math.max(16, window.innerWidth - 600 - n * 32),
      y: 72 + n * 32,
    };
  });
  useEffect(() => {
    const dialog = ref.current;
    if (!docked && dialog && !dialog.open) dialog.show();
  }, [docked]);
  const head = (
    <div
      className="detail-head"
      {...(docked
        ? {}
        : { onPointerDown: (e: ReactPointerEvent) => startMove(e) })}
    >
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
  );
  if (docked) {
    return (
      <section className="panel window" role="dialog" aria-label={title}>
        {head}
        {children}
      </section>
    );
  }
  function startMove(e: ReactPointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    const start = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    const move = (ev: PointerEvent) =>
      setPos({
        x: Math.max(0, ev.clientX - start.x),
        y: Math.max(0, ev.clientY - start.y),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  return (
    <dialog
      ref={ref}
      className="detail"
      aria-label={title}
      style={{ left: pos.x, top: pos.y }}
      onCancel={(e) => e.preventDefault()}
    >
      {head}
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
