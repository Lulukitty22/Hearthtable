// Spell slots, then each spellbook as a grid of spell tiles grouped by level, in the owner's
// saved book order. Clicking a tile opens the whole spell entry: readiness and why, its
// definition and source, and removing it from the book.

import type { ScrollView } from "@hearthtable/system-scrolls";
import type { SlotLevel } from "@hearthtable/system-spellcasting";
import type {
  BookView,
  EntryView,
} from "@hearthtable/system-spellbook-readiness";
import { useState } from "react";
import { Explained } from "./Explained";
import { EntryBody } from "./entries";
import { DetailPanel, DropTarget, Tile, TileGrid } from "./Grid";
import { bookDrop, takeOut } from "./InventoryTab";
import { ScrollFacts } from "./ScrollFacts";
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
    <div className="chips" style={{ marginTop: 10 }}>
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
              // Adding a spell to a book is mounting its scroll (every book entry is a scroll).
              {
                id: `entry-${Date.now()}`,
                ref: choice,
                item: "core/Spell_Scroll",
                scroll: {
                  spell: choice,
                  castLevel: spells.find((x) => x.id === choice)?.level ?? 0,
                },
              },
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

function SpellDetail({
  props,
  entry,
  bookTitle,
  bookRecordId,
  scroll,
  onNotice,
  onClose,
}: {
  props: TabProps;
  entry: EntryView;
  bookTitle: string;
  bookRecordId?: string;
  scroll?: ScrollView;
  onNotice: (message: string) => void;
  onClose: () => void;
}) {
  return (
    <DetailPanel title={entry.name} onClose={onClose}>
      {/* Readiness in each book is shown by the spell body below. */}
      {scroll && bookRecordId && (
        <>
          <h3>Mounted scroll</h3>
          <ScrollFacts
            props={props}
            scroll={scroll}
            {...(props.canEdit
              ? {
                  onToggleSpent: () =>
                    props.edit(bookRecordId, (data: Data) => ({
                      ...data,
                      entries: (data["entries"] as Entry[]).map((x) =>
                        x.id === entry.id
                          ? {
                              ...x,
                              scroll: {
                                ...((x as { scroll?: object }).scroll ?? {}),
                                spent: !scroll.spent,
                              },
                            }
                          : x,
                      ),
                    })),
                }
              : {})}
          />
          {props.canEdit && (
            <p>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  takeOut(
                    { props, notice: onNotice },
                    {
                      kind: "entry",
                      bookRecordId,
                      entryId: entry.id,
                      level: entry.level ?? -1,
                    },
                    { kind: "root" },
                  );
                  onClose();
                }}
              >
                Take the scroll out of {bookTitle}
              </button>
            </p>
          )}
        </>
      )}
      {bookRecordId && !scroll && props.canEdit && (
        <p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              props.edit(bookRecordId, (data: Data) => ({
                ...data,
                entries: (data["entries"] as Entry[]).filter(
                  (x) => x.id !== entry.id,
                ),
              }));
              onClose();
            }}
          >
            Remove from {bookTitle}
          </button>
        </p>
      )}
      <EntryBody props={props} id={entry.ref} />
    </DetailPanel>
  );
}

export function SpellsTab(props: TabProps) {
  const [open, setOpen] = useState<
    { book: string; entry: string } | undefined
  >();
  const slots =
    known(props.resolved.get<readonly SlotLevel[]>("spellcasting.slots")) ?? [];
  const books =
    known(
      props.resolved.get<readonly BookView[]>("spellbook-readiness.books"),
    ) ?? [];
  const bookRecords = sheetRecords(props, "spellbook");
  const recordFor = (book: BookView) =>
    bookRecords.find(
      (r) => (r.data as { book?: unknown }).book === book.lineId,
    );
  const titleOf = (book: BookView) =>
    String(
      (recordFor(book)?.data as { title?: unknown } | undefined)?.title ??
        book.name,
    );

  const [message, setMessage] = useState<string | undefined>();
  const drops = { props, notice: setMessage };

  const scrolls =
    known(props.resolved.get<readonly ScrollView[]>("scrolls.list")) ?? [];
  const openBook = books.find((b) => b.lineId === open?.book);
  const openEntry = openBook?.entries.find((e) => e.id === open?.entry);

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

      {message && (
        <p className="error-box" role="status">
          {message}{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => setMessage(undefined)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </p>
      )}
      {props.canEdit && (
        <p className="muted">
          Drag a spell onto another book to move it; it keeps its level. Drag a
          scroll from the inventory onto a book to mount it.
        </p>
      )}

      {books.map((book) => {
        const record = recordFor(book);
        const title = titleOf(book);
        const byLevel = new Map<number, EntryView[]>();
        for (const e of book.entries)
          byLevel.set(e.level ?? -1, [
            ...(byLevel.get(e.level ?? -1) ?? []),
            e,
          ]);
        return (
          <DropTarget
            key={book.lineId}
            className="panel"
            drop={bookDrop(drops, book.lineId)}
            aria-label={`Book ${title}`}
          >
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
                <div key={level} style={{ marginTop: 10 }}>
                  <div
                    className="vital-label"
                    style={{ textAlign: "left", marginBottom: 4 }}
                  >
                    {level === -1
                      ? "Unresolved"
                      : level === 0
                        ? "Cantrips"
                        : `Level ${level}`}
                  </div>
                  <TileGrid
                    drop={bookDrop(drops, book.lineId, level)}
                    label={`${title}, ${level === 0 ? "cantrips" : `level ${level}`}`}
                  >
                    {entries.map((e) => (
                      <Tile
                        key={e.id}
                        name={e.name}
                        badges={
                          e.scroll
                            ? [e.scroll.spent === true ? "spent" : "scroll"]
                            : []
                        }
                        {...(e.status === "unresolved"
                          ? { tone: "bad" as const }
                          : !e.ready
                            ? { tone: "warn" as const }
                            : {})}
                        onOpen={() =>
                          setOpen({ book: book.lineId, entry: e.id })
                        }
                        {...(record
                          ? {
                              drag: {
                                kind: "entry" as const,
                                bookRecordId: record.id,
                                entryId: e.id,
                                level: e.level ?? -1,
                              },
                            }
                          : {})}
                      />
                    ))}
                  </TileGrid>
                </div>
              ))}
            {record && props.canEdit && (
              <AddSpell
                props={props}
                bookRecordId={record.id}
                present={new Set(book.entries.map((e) => e.ref))}
              />
            )}
          </DropTarget>
        );
      })}

      {openBook && openEntry && (
        <SpellDetail
          props={props}
          entry={openEntry}
          bookTitle={titleOf(openBook)}
          {...(recordFor(openBook)
            ? { bookRecordId: (recordFor(openBook) as { id: string }).id }
            : {})}
          {...(scrolls.find((x) => x.id === openEntry.id)
            ? {
                scroll: scrolls.find(
                  (x) => x.id === openEntry.id,
                ) as ScrollView,
              }
            : {})}
          onNotice={setMessage}
          onClose={() => setOpen(undefined)}
        />
      )}
    </div>
  );
}
