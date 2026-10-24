// The difference window (Milestone 4, S9; Campaigns and Shared Data, Concurrent editing and
// difference review). Someone else saved this sheet while it is being edited: only the items
// that differ from the editor's values are shown, side by side, and the editor picks the saved
// value or their own for each. Picking writes nothing; a later save follows the usual rules.
// Further saves wait their turn and are shown one at a time.

import type { RecordEnvelope } from "@hearthtable/kernel";
import { useState } from "react";
import type { Path } from "../sheetDiff";
import type { Comparison } from "../useSheet";

const nameOf = (r: RecordEnvelope | undefined) =>
  String((r?.data as { name?: unknown } | undefined)?.name ?? "");

/** "Inventory › Potion of Healing" or "Sheet › hitPoints › current". */
function label(
  characterId: string,
  recordId: string,
  path: Path,
  records: ReadonlyMap<string, RecordEnvelope>,
): string {
  const record =
    recordId === characterId ? "Sheet" : recordId.slice(characterId.length + 1);
  const steps = path.map((step) => {
    if (typeof step === "string") return step;
    // A line is named by what it is, falling back to its id.
    const line = ((
      records.get(recordId)?.data as { lines?: unknown[]; entries?: unknown[] }
    )?.lines ??
      (records.get(recordId)?.data as { entries?: unknown[] })?.entries ??
      []) as { id?: string; ref?: string }[];
    const ref = line.find((l) => l.id === step.id)?.ref;
    return nameOf(ref ? records.get(ref) : undefined) || step.id;
  });
  return [record, ...steps].join(" › ");
}

function shown(value: unknown): string {
  if (value === undefined) return "(none)";
  if (typeof value === "string") return value;
  const text = JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export function DifferenceWindow({
  characterId,
  comparison,
  records,
  onResolve,
}: {
  characterId: string;
  comparison: Comparison;
  records: ReadonlyMap<string, RecordEnvelope>;
  onResolve: (keepMine: ReadonlySet<number>) => void;
}) {
  // Nothing is chosen until the editor chooses.
  const [choice, setChoice] = useState<ReadonlyMap<number, "theirs" | "mine">>(
    new Map(),
  );
  const all = (c: "theirs" | "mine") =>
    setChoice(new Map(comparison.items.map((_, n) => [n, c])));
  const done = choice.size === comparison.items.length;

  return (
    <div className="difference-backdrop">
      <section
        className="panel difference-window"
        role="dialog"
        aria-label="Someone else saved this sheet"
      >
        <h2>Someone else saved this sheet</h2>
        <p className="muted">
          Saved {new Date(comparison.at).toLocaleString()}
          {comparison.note && <> with the note “{comparison.note}”</>}.
          {comparison.waiting > 0 &&
            ` ${comparison.waiting} more ${comparison.waiting === 1 ? "save is" : "saves are"} waiting after this one.`}{" "}
          Choose, for each difference, their saved value or yours. Yours stays
          unsaved until you save.
        </p>
        <table className="difference-table">
          <thead>
            <tr>
              <th>What</th>
              <th>Their saved value</th>
              <th>Yours</th>
            </tr>
          </thead>
          <tbody>
            {comparison.items.map((item, n) => {
              const what = label(
                characterId,
                item.recordId,
                item.path,
                records,
              );
              return (
                <tr key={n} aria-label={what}>
                  <td>{what}</td>
                  <td>
                    <label>
                      <input
                        type="radio"
                        name={`difference-${n}`}
                        aria-label={`Use theirs for ${what}`}
                        checked={choice.get(n) === "theirs"}
                        onChange={() =>
                          setChoice((c) => new Map(c).set(n, "theirs"))
                        }
                      />{" "}
                      <code>{shown(item.incoming)}</code>
                    </label>
                  </td>
                  <td>
                    <label>
                      <input
                        type="radio"
                        name={`difference-${n}`}
                        aria-label={`Keep mine for ${what}`}
                        checked={choice.get(n) === "mine"}
                        onChange={() =>
                          setChoice((c) => new Map(c).set(n, "mine"))
                        }
                      />{" "}
                      <code>{shown(item.mine)}</code>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="chips">
          <button
            type="button"
            className="secondary"
            onClick={() => all("theirs")}
          >
            Use all theirs
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => all("mine")}
          >
            Keep all mine
          </button>
          <button
            type="button"
            className="primary"
            disabled={!done}
            onClick={() =>
              onResolve(
                new Set(
                  [...choice].filter(([, c]) => c === "mine").map(([n]) => n),
                ),
              )
            }
          >
            Apply
          </button>
        </p>
      </section>
    </div>
  );
}
