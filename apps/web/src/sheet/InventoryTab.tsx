// The inventory as a grid of item tiles (user decisions, 2026-10-22). The main grid shows what
// is carried loose; opening a container shows what is inside it, and the Aetherlock's chambers
// sit in a hexagonal ring. Items are moved by dragging: onto a container tile or into its open
// window, onto a chamber, or back onto the main grid. A plain drag moves one from a stack; Shift
// asks how many. Clicking a tile opens the whole entry; several windows can stay open at once.

import type { LineRow, Weight } from "@hearthtable/system-containers";
import type { WeaponView } from "@hearthtable/system-magazines";
import type { BookView } from "@hearthtable/system-spellbook-readiness";
import { useState, type DragEvent } from "react";
import {
  moveEntry,
  moveItem,
  refusal,
  type ItemRules,
  type Target,
} from "./drag";
import { EntryBody, nameOfRecord, useOpenEntry } from "./entries";
import {
  DetailPanel,
  DropTarget,
  Tile,
  TileGrid,
  type Dragged,
  type DropProps,
} from "./Grid";
import {
  known,
  sheetRecord,
  sheetRecords,
  type Data,
  type TabProps,
} from "./shared";

type Line = Record<string, unknown> & {
  id: string;
  ref: string;
  quantity: number;
  parent?: string;
  slot?: string;
};

interface Sheet {
  readonly props: TabProps;
  readonly rows: readonly LineRow[];
  readonly attuned: readonly string[];
  readonly weapons: readonly WeaponView[];
  readonly books: readonly BookView[];
  readonly open: (lineId: string) => void;
  readonly notice: (message: string) => void;
}

function editLine(
  props: TabProps,
  lineId: string,
  change: (line: Line) => Line,
) {
  const inventory = sheetRecord(props, "inventory");
  if (!inventory) return;
  props.edit(inventory.id, (data: Data) => ({
    ...data,
    lines: (data["lines"] as Line[]).map((l) =>
      l.id === lineId ? change(l) : l,
    ),
  }));
}

/** A book line's own record (title, order, spells), kept as its own document. */
function bookRecordFor(props: TabProps, lineId: string) {
  return sheetRecords(props, "spellbook").find(
    (r) => (r.data as { book?: unknown }).book === lineId,
  );
}

export function displayName(props: TabProps, row: LineRow): string {
  const title = (
    bookRecordFor(props, row.line.id)?.data as { title?: unknown } | undefined
  )?.title;
  return typeof title === "string" ? title : row.name;
}

const rulesOf = (props: TabProps) => (ref: string) =>
  props.records.get(ref)?.data as ItemRules | undefined;
const storedLines = (props: TabProps) =>
  ((sheetRecord(props, "inventory")?.data as { lines?: Line[] } | undefined)
    ?.lines ?? []) as Line[];

/** How many to take: one, or (with Shift) as many as the player asks for. */
function howMany(
  d: Extract<Dragged, { kind: "line" }>,
  e: DragEvent,
): number | undefined {
  if (!e.shiftKey || d.quantity <= 1) return 1;
  const answer = window.prompt(
    `How many do you want to take from the stack? (1–${d.quantity})`,
    String(d.quantity),
  );
  if (answer === null) return undefined;
  const n = Math.floor(Number(answer));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, d.quantity) : undefined;
}

/** Drop handling for an item target (a container, a slot, or the main grid). */
function itemDrop(sheet: Sheet, target: Target): DropProps {
  const { props } = sheet;
  return {
    accept: (d) =>
      d.kind === "line"
        ? refusal(storedLines(props), d.lineId, target, rulesOf(props))
        : "Spells go in spellbooks.",
    onDrop: (d, e) => {
      if (d.kind !== "line") return;
      const count = howMany(d, e);
      if (count === undefined) return;
      const inventory = sheetRecord(props, "inventory");
      if (!inventory) return;
      const result = moveItem(
        storedLines(props),
        d.lineId,
        target,
        count,
        rulesOf(props),
        () => `line-${Date.now().toString(36)}`,
      );
      if (!result.ok) return sheet.notice(result.reason);
      props.edit(inventory.id, (data: Data) => ({
        ...data,
        lines: result.lines,
      }));
    },
  };
}

/** Drop handling for a spellbook: spells move between books, keeping their level. */
export function bookDrop(
  sheet: Pick<Sheet, "props" | "notice">,
  bookLineId: string,
  level?: number,
): DropProps {
  const { props } = sheet;
  const to = bookRecordFor(props, bookLineId);
  return {
    accept: (d) => {
      if (d.kind !== "entry") return "Only spells go in a spellbook.";
      if (!to) return "This book has no page record.";
      if (d.bookRecordId === to.id) return "It is already in this book.";
      if (level !== undefined && d.level !== level)
        return "A spell stays in its own level.";
      return undefined;
    },
    onDrop: (d) => {
      if (d.kind !== "entry" || !to) return;
      const from = props.records.get(d.bookRecordId);
      if (!from) return;
      const entries = (r: { data: unknown }) =>
        ((r.data as { entries?: [] }).entries ?? []) as {
          id: string;
          ref: string;
        }[];
      const result = moveEntry(entries(from), entries(to), d.entryId);
      if (!result.ok) return sheet.notice(result.reason);
      props.edit(from.id, (data: Data) => ({ ...data, entries: result.from }));
      props.edit(to.id, (data: Data) => ({ ...data, entries: result.to }));
    },
  };
}

/** Where dropping onto an item's own tile sends things. */
function tileDrop(sheet: Sheet, row: LineRow): DropProps | undefined {
  if (bookRecordFor(sheet.props, row.line.id))
    return bookDrop(sheet, row.line.id);
  const container = (row.definition as ItemRules | undefined)?.container;
  if (!container) return undefined;
  const slots = container.slots ?? [];
  if (slots.length === 0)
    return itemDrop(sheet, { kind: "container", lineId: row.line.id });
  // A slotted container's tile fills its first empty slot.
  const used = new Set(
    sheet.rows
      .filter((r) => r.line.parent === row.line.id)
      .map((r) => r.line.slot),
  );
  const free = slots.find((s) => !used.has(s.id));
  if (!free)
    return {
      accept: () => "Every slot is full; drop onto a slot to add another.",
      onDrop: () => undefined,
    };
  return itemDrop(sheet, { kind: "slot", lineId: row.line.id, slot: free.id });
}

function ItemTile({ sheet, row }: { sheet: Sheet; row: LineRow }) {
  const position = sheet.attuned.indexOf(row.line.id);
  const held = (row.line as { held?: boolean }).held === true;
  const drop = tileDrop(sheet, row);
  return (
    <Tile
      name={displayName(sheet.props, row)}
      quantity={row.line.quantity}
      badges={[
        ...(position >= 0 ? [`A${position + 1}`] : []),
        ...(held ? ["held"] : []),
      ]}
      {...(row.status === "unresolved"
        ? { tone: "bad" as const }
        : !row.accessible
          ? { tone: "warn" as const }
          : row.line.quantity === 0
            ? { tone: "muted" as const }
            : {})}
      onOpen={() => sheet.open(row.line.id)}
      drag={{ kind: "line", lineId: row.line.id, quantity: row.line.quantity }}
      {...(drop ? { drop } : {})}
    />
  );
}

/** Attuning sets the line's `attunedTo` to this character and puts it in the last slot. */
function Attunement({
  props,
  line,
  position,
  attunedCount,
}: {
  props: TabProps;
  line: Line;
  position: number;
  attunedCount: number;
}) {
  const to = line["attunedTo"] as string | null | undefined;
  const required = (
    props.records.get(line.ref)?.data as
      { attunement?: { required?: boolean } } | undefined
  )?.attunement?.required;
  if (!required && (to === undefined || to === null)) return null;
  const characterName = String(
    (
      props.records.get(props.characterId)?.data as
        { name?: unknown } | undefined
    )?.name ?? props.characterId,
  );
  return (
    <span>
      {position >= 0 ? (
        <span className="badge good">
          Attuned to {characterName}, slot {position + 1}
        </span>
      ) : to ? (
        <span className="badge warn">Attuned to {to}</span>
      ) : (
        <span className="badge">Not attuned</span>
      )}{" "}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          editLine(props, line.id, (l) =>
            position >= 0
              ? (({ attunedSlot: _slot, ...rest }) =>
                  ({ ...rest, attunedTo: null }) as Line)(l)
              : {
                  ...l,
                  attunedTo: props.characterId,
                  attunedSlot: attunedCount + 1,
                },
          )
        }
      >
        {position >= 0 ? "End attunement" : "Attune"}
      </button>
    </span>
  );
}

/** The chambers as a hexagonal ring: each is a drop slot; the centre is empty. */
function ChamberRing({ sheet, weapon }: { sheet: Sheet; weapon: WeaponView }) {
  const unit = 44;
  return (
    <div
      className="chamber-ring"
      style={{ width: unit * 5 + 8, height: unit * 3 + 40 }}
    >
      {weapon.chambers.map((c) => {
        const round =
          c.round && sheet.rows.find((r) => r.line.id === c.round?.lineId);
        const name = c.slot.label ?? c.slot.id;
        return (
          <DropTarget
            key={c.slot.id}
            className="chamber"
            style={{
              left: (c.slot.x + 2) * unit,
              top: (2 - c.slot.y) * (unit * 0.7),
            }}
            drop={itemDrop(sheet, {
              kind: "slot",
              lineId: weapon.lineId,
              slot: c.slot.id,
            })}
            aria-label={`${name}: ${round ? round.name : "empty"}`}
          >
            {round ? (
              <ItemTile sheet={sheet} row={round} />
            ) : (
              <span className="chamber-empty">{name}</span>
            )}
          </DropTarget>
        );
      })}
    </div>
  );
}

function ItemDetail({
  sheet,
  row,
  onClose,
}: {
  sheet: Sheet;
  row: LineRow;
  onClose: () => void;
}) {
  const { props } = sheet;
  const openEntry = useOpenEntry();
  const line = row.line as Line & { held?: boolean };
  const grantsWhen = (row.definition as { grantsWhen?: string } | undefined)
    ?.grantsWhen;
  const holdable = grantsWhen === "held" || grantsWhen === "attuned-and-held";
  const bookRecord = bookRecordFor(props, line.id);
  const book = sheet.books.find((b) => b.lineId === line.id);
  const weapon = sheet.weapons.find((w) => w.lineId === line.id);
  const container = (row.definition as ItemRules | undefined)?.container;
  const inside = sheet.rows.filter((r) => r.line.parent === line.id);
  const title = displayName(props, row);
  const position = sheet.attuned.indexOf(line.id);

  return (
    <DetailPanel title={title} onClose={onClose} docked>
      {title !== row.name && <p className="muted">{row.name}</p>}
      <h3>
        {String(
          (
            props.records.get(props.characterId)?.data as
              { name?: unknown } | undefined
          )?.name ?? "This character",
        )}
        's copy
      </h3>
      <div className="detail-grid">
        <label>
          Quantity{" "}
          <input
            type="number"
            min={0}
            aria-label={`Quantity of ${title}`}
            value={line.quantity}
            style={{ width: "5em" }}
            onChange={(e) => {
              const q = Math.max(0, Math.floor(Number(e.target.value)));
              if (Number.isFinite(q))
                editLine(props, line.id, (l) => ({ ...l, quantity: q }));
            }}
          />
        </label>
        {holdable && (
          <button
            type="button"
            className="chip"
            aria-pressed={line.held === true}
            onClick={() =>
              editLine(props, line.id, (l) => ({
                ...l,
                held: !(l["held"] === true),
              }))
            }
          >
            {line.held ? "Held" : "Stowed"}
          </button>
        )}
        <span>
          {row.depth === undefined ? (
            <span className="unresolved">placement broken</span>
          ) : row.depth === 0 ? (
            "Carried loose"
          ) : (
            `Inside ${nameOfLine(sheet, line.parent)}${row.depth > 1 ? `, ${row.depth} deep` : ""}`
          )}
          {!row.accessible && <span className="badge warn">out of reach</span>}
        </span>
        <Attunement
          props={props}
          line={line}
          position={position}
          attunedCount={sheet.attuned.length}
        />
      </div>

      {weapon && (
        <>
          <h3>Chambers</h3>
          <ChamberRing sheet={sheet} weapon={weapon} />
          <p>
            Aim:{" "}
            {weapon.aim ? (
              weapon.aim.kind === "known" ? (
                `+${weapon.aim.value}`
              ) : (
                <span className="unresolved">{weapon.aim.reason}</span>
              )
            ) : (
              "—"
            )}
            {" · "}Canister:{" "}
            {weapon.canister
              ? `${weapon.canister.charges ?? "?"}/${weapon.canister.max} charges`
              : "none installed"}
            {" · "}
            {weapon.loaded} of {weapon.chambers.length} chambers loaded
          </p>
        </>
      )}

      {container && !weapon && (
        <>
          <h3>Contents ({inside.length})</h3>
          <TileGrid
            drop={itemDrop(sheet, { kind: "container", lineId: line.id })}
            label={`Contents of ${title}`}
          >
            {inside.map((r) => (
              <ItemTile key={r.line.id} sheet={sheet} row={r} />
            ))}
            {inside.length === 0 && (
              <span className="muted">Empty. Drag items here.</span>
            )}
          </TileGrid>
        </>
      )}

      {book && bookRecord && (
        <>
          <h3>
            Contains {book.entries.length}
            {book.capacity !== undefined && ` of ${book.capacity}`} spells
          </h3>
          <TileGrid
            drop={bookDrop(sheet, line.id)}
            label={`Spells in ${title}`}
          >
            {book.entries.map((e) => (
              <Tile
                key={e.id}
                name={e.name}
                {...(e.status === "unresolved"
                  ? { tone: "bad" as const }
                  : !e.ready
                    ? { tone: "warn" as const }
                    : {})}
                onOpen={() => openEntry(e.ref)}
                drag={{
                  kind: "entry",
                  bookRecordId: bookRecord.id,
                  entryId: e.id,
                  level: e.level ?? -1,
                }}
              />
            ))}
          </TileGrid>
        </>
      )}

      <details className="notes">
        <summary>This copy's own fields</summary>
        <pre className="fields">
          {JSON.stringify(
            bookRecord ? { ...line, book: bookRecord.data } : line,
            null,
            2,
          )}
        </pre>
      </details>

      <h3>{nameOfRecord(props, line.ref)}</h3>
      <EntryBody props={props} id={line.ref} />
    </DetailPanel>
  );
}

function nameOfLine(sheet: Sheet, lineId: string | undefined): string {
  const row = sheet.rows.find((r) => r.line.id === lineId);
  return row ? displayName(sheet.props, row) : String(lineId);
}

export function InventoryTab(props: TabProps) {
  const [openIds, setOpenIds] = useState<readonly string[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const rows =
    known(props.resolved.get<readonly LineRow[]>("containers.lines")) ?? [];
  const weight = known(props.resolved.get<Weight>("containers.carriedWeight"));
  const sheet: Sheet = {
    props,
    rows,
    // Attuned line ids in slot order, as resolved from each line's `attunedTo` and `attunedSlot`.
    attuned:
      known(props.resolved.get<readonly string[]>("attunement.order")) ?? [],
    weapons:
      known(props.resolved.get<readonly WeaponView[]>("magazines.weapons")) ??
      [],
    books:
      known(
        props.resolved.get<readonly BookView[]>("spellbook-readiness.books"),
      ) ?? [],
    open: (id) => setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
    notice: (m) => setMessage(m),
  };
  const loose = rows.filter((r) => r.line.parent === undefined);

  return (
    <section className="panel">
      <h2>Inventory</h2>
      {weight && (
        <p className="muted">
          Carried weight: {weight.pounds} lb known
          {weight.unknown > 0 &&
            `; ${weight.unknown} items of unknown weight not counted`}
        </p>
      )}
      <p className="muted">
        Drag items onto a container or into its open window to pack them;
        Shift-drag to choose how many to take from a stack.
      </p>
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
      <div
        className={
          openIds.length > 0
            ? "inventory-layout with-windows"
            : "inventory-layout"
        }
      >
        <TileGrid
          drop={itemDrop(sheet, { kind: "root" })}
          label="Carried items"
        >
          {loose.map((row) => (
            <ItemTile key={row.line.id} sheet={sheet} row={row} />
          ))}
        </TileGrid>
        <div className="windows">
          {openIds.map((id) => {
            const row = rows.find((r) => r.line.id === id);
            return row ? (
              <ItemDetail
                key={id}
                sheet={sheet}
                row={row}
                onClose={() => setOpenIds((ids) => ids.filter((x) => x !== id))}
              />
            ) : null;
          })}
        </div>
      </div>
    </section>
  );
}
