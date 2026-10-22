import type { SlotLevel } from "@hearthtable/system-spellcasting";
import type { BookView } from "@hearthtable/system-spellbook-readiness";
import { useState } from "react";
import { Explained } from "./Explained";
import { known, sheetRecords, type Data, type TabProps } from "./shared";

type Entry = { id: string; ref: string };

function AddSpell({
  props,
  bookRecordId,
  present,
}: {
  props: TabProps;
  bookRecordId: string;
  present: ReadonlySet<string>;
}) {
  const [choice, setChoice] = useState("");
  const spells = [...props.records.values()]
    .filter((r) => r.kind === "spell" && !present.has(r.id))
    .map((r) => ({
      id: r.id,
      name: String((r.data as { name?: unknown }).name ?? r.id),
      level: Number((r.data as { level?: unknown }).level),
    }))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return (
    <div className="chips" style={{ marginTop: 8 }}>
      <select
        aria-label="Spell to add"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
      >
        <option value="">Add a spell…</option>
        {spells.map((s) => (
          <option key={s.id} value={s.id}>
            {s.level === 0 ? "Cantrip" : `Level ${s.level}`}: {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="secondary"
        disabled={!choice}
        onClick={() => {
          props.edit(bookRecordId, (data: Data) => ({
            ...data,
            entries: [
              ...(data["entries"] as Entry[]),
              { id: `entry-${Date.now()}`, ref: choice },
            ],
          }));
          setChoice("");
        }}
      >
        Add
      </button>
    </div>
  );
}

export function SpellsTab(props: TabProps) {
  const slots =
    known(props.resolved.get<readonly SlotLevel[]>("spellcasting.slots")) ?? [];
  const books =
    known(
      props.resolved.get<readonly BookView[]>("spellbook-readiness.books"),
    ) ?? [];
  const bookRecords = sheetRecords(props, "spellbook");

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
      <section className="panel">
        <h2>Spell slots</h2>
        <div className="chips" style={{ marginTop: 8 }}>
          {slots.map((s) => (
            <span key={s.level} className="vital" style={{ minWidth: 80 }}>
              <span className="vital-label">Level {s.level}</span>
              <br />
              <Explained value={s.available} /> / <Explained value={s.max} />
            </span>
          ))}
        </div>
      </section>

      {books.map((book, index) => {
        const record =
          bookRecords.find(
            (r) => (r.data as { book?: unknown }).book === book.lineId,
          ) ?? bookRecords[index];
        const title = String(
          (record?.data as { title?: unknown } | undefined)?.title ?? book.name,
        );
        const byLevel = new Map<number, typeof book.entries>();
        for (const e of book.entries)
          byLevel.set(e.level ?? -1, [
            ...(byLevel.get(e.level ?? -1) ?? []),
            e,
          ]);
        return (
          <section key={book.lineId} className="panel">
            <h2>
              {title}{" "}
              <span
                className={`badge ${book.capacity !== undefined && book.entries.length > book.capacity ? "warn" : ""}`}
              >
                {book.entries.length}
                {book.capacity !== undefined && ` / ${book.capacity}`} entries
              </span>
              {!book.accessible && (
                <span className="badge warn">book out of reach</span>
              )}
            </h2>
            {[...byLevel.entries()]
              .sort(([a], [b]) => a - b)
              .map(([level, entries]) => (
                <div key={level} style={{ marginTop: 8 }}>
                  <div className="vital-label" style={{ textAlign: "left" }}>
                    {level === -1
                      ? "Unresolved"
                      : level === 0
                        ? "Cantrips"
                        : `Level ${level}`}
                  </div>
                  <div className="chips">
                    {entries.map((e) => (
                      <span
                        key={e.id}
                        className="chip"
                        title={e.reasons.join("; ")}
                      >
                        {e.status === "unresolved" ? (
                          <span className="unresolved">{e.name}</span>
                        ) : (
                          e.name
                        )}
                        {!e.ready && e.status === "resolved" && (
                          <span className="badge warn">not ready</span>
                        )}
                        {record && (
                          <button
                            type="button"
                            className="link-button"
                            aria-label={`Remove ${e.name} from ${title}`}
                            onClick={() =>
                              props.edit(record.id, (data: Data) => ({
                                ...data,
                                entries: (data["entries"] as Entry[]).filter(
                                  (x) => x.id !== e.id,
                                ),
                              }))
                            }
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            {record && (
              <AddSpell
                props={props}
                bookRecordId={record.id}
                present={new Set(book.entries.map((e) => e.ref))}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}
