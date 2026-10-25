// The character's conditions on the sheet (Milestone 5 S5; Turns, Encounters and Time,
// "Conditions"): every condition in force, including those another includes and going down,
// each opening its rules text. Whoever edits the sheet can add and remove them; for a player's
// campaign character that is a change the DM reviews, like any other.

import type { ConditionRow } from "@hearthtable/system-conditions";
import { useState } from "react";
import { known, type Data, type TabProps } from "./shared";

type Entry = { id: string; ref: string; level?: number };

export function SheetConditions(props: TabProps) {
  const { resolved, records, characterId, canEdit } = props;
  const rows =
    known(resolved.get<readonly ConditionRow[]>("conditions.list")) ?? [];
  const kinds = [...records.values()]
    .filter((r) => r.kind === "condition")
    .map((r) => ({
      ref: r.id as string,
      name: String((r.data as { name?: unknown }).name ?? r.id),
      levels: (r.data as { levels?: unknown }).levels === true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [choice, setChoice] = useState("");
  const change = (f: (list: Entry[]) => Entry[]) =>
    props.edit(characterId, (data: Data) => ({
      ...data,
      conditions: f((data["conditions"] as Entry[] | undefined) ?? []),
    }));

  if (rows.length === 0 && !canEdit) return null;
  return (
    <div className="chips sheet-conditions" aria-label="Conditions">
      <span className="muted">Conditions:</span>
      {rows.length === 0 && <span className="muted">none</span>}
      {rows.map((c) => (
        <details key={c.id} className="condition">
          <summary className={`chip ${c.origin === "applied" ? "" : "muted"}`}>
            {c.name}
            {c.level ? ` ${c.level}` : ""}
            {c.origin === "down" ? " (down)" : ""}
          </summary>
          <div className="condition-text">
            {c.because && <p className="muted">From {c.because}.</p>}
            {c.text.map((t) => (
              <p key={t}>{t}</p>
            ))}
            {canEdit && c.origin === "applied" && (
              <button
                type="button"
                className="secondary"
                onClick={() => change((l) => l.filter((e) => e.id !== c.id))}
              >
                Remove {c.name}
              </button>
            )}
          </div>
        </details>
      ))}
      {canEdit && (
        <>
          <select
            aria-label="Add a condition"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            <option value="">Add a condition…</option>
            {kinds.map((k) => (
              <option key={k.ref} value={k.ref}>
                {k.levels ? `${k.name} (+1 level)` : k.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            disabled={!choice}
            onClick={() => {
              const kind = kinds.find((k) => k.ref === choice);
              if (!kind) return;
              change((l) => [
                ...l,
                {
                  id: `condition-${Date.now().toString(36)}`,
                  ref: kind.ref,
                  ...(kind.levels ? { level: 1 } : {}),
                },
              ]);
              setChoice("");
            }}
          >
            Add
          </button>
        </>
      )}
    </div>
  );
}
