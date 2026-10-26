// The inventory as a grid of item tiles (user decisions, 2026-10-22). The main grid shows what
// is carried loose; opening a container shows what is inside it, and the Aetherlock's chambers
// sit in a hexagonal ring. Items are moved by dragging: onto a container tile or into its open
// window, onto a chamber, or back onto the main grid. A plain drag moves one from a stack; Shift
// asks how many. Clicking a tile opens the whole entry; several windows can stay open at once.
// Spellbooks and Spellrounds are containers too (Milestone 5 S0): a book's spells are the scroll
// lines inside it, so mounting, taking out and moving between books are ordinary moves.

import type { LineRow, Weight } from "@hearthtable/system-containers";
import { formatPurse, type Wallet } from "@hearthtable/system-currency";
import type { WeaponView } from "@hearthtable/system-magazines";
import type { ScrollView } from "@hearthtable/system-scrolls";
import type { BookView } from "@hearthtable/system-spellbook-readiness";
import { useState, type DragEvent } from "react";
import {
  emptyContainer,
  moveItem,
  refusal,
  type ItemRules,
  type Target,
} from "./drag";
import { EntryBody, nameOfRecord } from "./entries";
import { ScrollFacts } from "./ScrollFacts";
import {
  DetailPanel,
  DropTarget,
  Tile,
  TileGrid,
  type Dragged,
  type DropProps,
} from "./Grid";
import { AttackReview, UseReview, type ItemUse } from "./ItemRequests";
import { CastReview } from "./Requests";
import {
  known,
  sheetRecord,
  type Data,
  type SheetPlay,
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
  readonly scrolls: readonly ScrollView[];
  readonly open: (lineId: string) => void;
  readonly notice: (message: string) => void;
  /** Asks what to do with a container's contents before it moves. */
  readonly askMove: (move: PendingMove) => void;
}

interface PendingMove {
  readonly lineId: string;
  readonly target: Target;
  readonly count: number;
  readonly name: string;
  readonly inside: number;
}

/** Moves a line, optionally emptying it where it stands first. */
function applyMove(
  sheet: Pick<Sheet, "props" | "notice">,
  move: Pick<PendingMove, "lineId" | "target" | "count">,
  emptyFirst: boolean,
) {
  const { props } = sheet;
  const inventory = sheetRecord(props, "inventory");
  if (!inventory) return;
  const start = emptyFirst
    ? emptyContainer(storedLines(props), move.lineId)
    : storedLines(props);
  const result = moveItem(
    start,
    move.lineId,
    move.target,
    move.count,
    rulesOf(props),
    () => `line-${Date.now().toString(36)}`,
  );
  if (!result.ok) return sheet.notice(result.reason);
  props.edit(inventory.id, (data: Data) => ({
    ...data,
    lines: result.lines,
  }));
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

/** How a container uses the scrolls inside it, from its item definition. */
function scrollUseOf(props: TabProps, lineId: string | undefined) {
  const holder = storedLines(props).find((l) => l.id === lineId);
  return holder ? rulesOf(props)(holder.ref)?.container?.scrollUse : undefined;
}

export function displayName(props: TabProps, row: LineRow): string {
  const scroll = (row.line as { scroll?: { spell?: unknown } }).scroll;
  if (scroll && typeof scroll.spell === "string")
    // A spell in a book is shown as the spell; elsewhere it is a scroll.
    return scrollUseOf(props, row.line.parent) === "bound"
      ? nameOfRecord(props, scroll.spell)
      : "Scroll: " + nameOfRecord(props, scroll.spell);
  if (row.definition?.container?.scrollUse === "installed") {
    const payload = storedLines(props).find((l) => l.parent === row.line.id)?.[
      "scroll"
    ] as { spell?: unknown } | undefined;
    if (typeof payload?.spell === "string")
      return `${row.name}: ${nameOfRecord(props, payload.spell)}`;
  }
  const title = (row.line as { title?: unknown }).title;
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
      refusal(storedLines(props), d.lineId, target, rulesOf(props)),
    onDrop: (d, e) => {
      const count = howMany(d, e);
      if (count === undefined) return;
      // Moving a container that holds items asks first (Item lifecycle, 2026-10-23).
      const inside = storedLines(props).filter(
        (l) => l.parent === d.lineId,
      ).length;
      const row = sheet.rows.find((r) => r.line.id === d.lineId);
      if (inside > 0 && row)
        return sheet.askMove({
          lineId: d.lineId,
          target,
          count,
          name: displayName(props, row),
          inside,
        });
      applyMove(sheet, { lineId: d.lineId, target, count }, false);
    },
  };
}

/** Takes a scroll out of its book into the carried grid (the same scroll, not a copy). */
export function takeOut(
  sheet: Pick<Sheet, "props" | "notice">,
  lineId: string,
) {
  applyMove(sheet, { lineId, target: { kind: "root" }, count: 1 }, false);
}

/** Drop handling for a spellbook: only scrolls, and a spell keeps its level row. */
export function bookDrop(
  sheet: Pick<Sheet, "props" | "notice">,
  bookLineId: string,
  level?: number,
): DropProps {
  const { props } = sheet;
  const target: Target = { kind: "container", lineId: bookLineId };
  return {
    accept: (d) => {
      const why = refusal(storedLines(props), d.lineId, target, rulesOf(props));
      if (why) return why;
      if (level === undefined) return undefined;
      const spell = (
        storedLines(props).find((l) => l.id === d.lineId)?.["scroll"] as
          { spell?: string } | undefined
      )?.spell;
      const spellLevel = spell
        ? (props.records.get(spell)?.data as { level?: unknown } | undefined)
            ?.level
        : undefined;
      return spellLevel === level
        ? undefined
        : "A spell stays in its own level.";
    },
    onDrop: (d) =>
      applyMove(sheet, { lineId: d.lineId, target, count: 1 }, false),
  };
}

/** Where dropping onto an item's own tile sends things. */
function tileDrop(sheet: Sheet, row: LineRow): DropProps | undefined {
  if (row.definition?.container?.scrollUse === "bound")
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
  const spent =
    (row.line as { scroll?: { spent?: unknown } }).scroll?.spent === true;
  const drop = tileDrop(sheet, row);
  return (
    <Tile
      name={displayName(sheet.props, row)}
      quantity={row.line.quantity}
      badges={[
        ...(position >= 0 ? [`A${position + 1}`] : []),
        ...(held ? ["held"] : []),
        // Held by a queued request (S6): not usable until it resolves or returns.
        ...(row.held > 0 ? [`${row.held} in a request`] : []),
        ...(spent ? ["spent"] : []),
        ...(row.lost ? [row.lost] : []),
      ]}
      {...(spent || row.lost
        ? { tone: "muted" as const }
        : row.status === "unresolved"
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
      {props.canEdit && (
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
      )}
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
  const line = row.line as Line & { held?: boolean };
  const grantsWhen = (row.definition as { grantsWhen?: string } | undefined)
    ?.grantsWhen;
  const holdable = grantsWhen === "held" || grantsWhen === "attuned-and-held";
  const book = sheet.books.find((b) => b.lineId === line.id);
  const weapon = sheet.weapons.find((w) => w.lineId === line.id);
  const scroll = sheet.scrolls.find((x) => x.id === line.id);
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
        {!props.canEdit && <span>Quantity {line.quantity}</span>}
        {props.canEdit && (
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
        )}
        {holdable && !props.canEdit && (
          <span className="badge">{line.held ? "Held" : "Stowed"}</span>
        )}
        {holdable && props.canEdit && (
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
      <Lifecycle props={props} row={row} />
      {props.play && <ItemActions sheet={sheet} row={row} play={props.play} />}

      {scroll && (
        <>
          <h3>Scroll</h3>
          <ScrollFacts
            props={props}
            scroll={scroll}
            {...(props.canEdit && scroll.place.kind === "loose"
              ? {
                  onToggleSpent: () =>
                    editLine(props, line.id, (l) => ({
                      ...l,
                      scroll: {
                        ...(l["scroll"] as object),
                        spent: !scroll.spent,
                      },
                    })),
                }
              : {})}
          />
          {props.canEdit && (
            <p className="muted">
              Drag it onto a spellbook to mount it there; it takes one entry.
            </p>
          )}
        </>
      )}

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
          <h3>
            {book
              ? `Contains ${book.entries.length}${book.capacity !== undefined ? ` of ${book.capacity}` : ""} spells`
              : `Contents (${inside.length})`}
          </h3>
          <TileGrid
            drop={
              book
                ? bookDrop(sheet, line.id)
                : itemDrop(sheet, { kind: "container", lineId: line.id })
            }
            label={book ? `Spells in ${title}` : `Contents of ${title}`}
          >
            {inside.map((r) => (
              <ItemTile key={r.line.id} sheet={sheet} row={r} />
            ))}
            {inside.length === 0 && (
              <span className="muted">
                {props.canEdit ? "Empty. Drag items here." : "Empty."}
              </span>
            )}
          </TileGrid>
        </>
      )}

      <details className="notes">
        <summary>This copy's own fields</summary>
        <pre className="fields">{JSON.stringify(line, null, 2)}</pre>
      </details>

      <h3>{nameOfRecord(props, line.ref)}</h3>
      <EntryBody props={props} id={line.ref} />
      {scroll && (
        <>
          <h3>{scroll.name}</h3>
          <EntryBody props={props} id={scroll.spell} />
        </>
      )}
    </DetailPanel>
  );
}

/**
 * What a character can do with an item in play (Milestone 5 S10): use it (a potion), cast from
 * it (a loose scroll) or attack with it (a weapon with attack actions). Each opens a review.
 */
function ItemActions({
  sheet,
  row,
  play,
}: {
  sheet: Sheet;
  row: LineRow;
  play: SheetPlay;
}) {
  const { props } = sheet;
  // Requests come from play, like casting: no edit mode is needed.
  const [open, setOpen] = useState<"use" | "cast" | "attack" | undefined>();
  const definition = row.definition as
    { use?: ItemUse; attacks?: readonly unknown[] } | undefined;
  const scroll = sheet.scrolls.find(
    (x) => x.id === row.line.id && x.place.kind === "loose" && !x.spent,
  );
  const usable = definition?.use && row.line.quantity - row.held > 0;
  const armed = (definition?.attacks?.length ?? 0) > 0;
  if (!usable && !scroll && !armed) return null;
  if (open === "use" && definition?.use)
    return (
      <UseReview
        props={props}
        play={play}
        row={row}
        use={definition.use}
        onDone={() => setOpen(undefined)}
      />
    );
  if (open === "cast" && scroll)
    return (
      <CastReview
        props={props}
        play={play}
        spell={scroll.spell}
        bookTitle=""
        scroll={scroll}
        onDone={() => setOpen(undefined)}
      />
    );
  if (open === "attack")
    return (
      <AttackReview
        props={props}
        play={play}
        row={row}
        onDone={() => setOpen(undefined)}
      />
    );
  return (
    <p className="chips">
      {usable && (
        <button type="button" onClick={() => setOpen("use")}>
          Use…
        </button>
      )}
      {scroll && (
        <button type="button" onClick={() => setOpen("cast")}>
          Cast from this scroll…
        </button>
      )}
      {armed && (
        <button type="button" onClick={() => setOpen("attack")}>
          Attack…
        </button>
      )}
    </p>
  );
}

/** Marking an item lost or destroyed, or restoring it (Item lifecycle, 2026-10-23). */
function Lifecycle({ props, row }: { props: TabProps; row: LineRow }) {
  const own = (row.line as { lost?: "lost" | "destroyed" }).lost;
  const canBeLost =
    (row.definition as { canBeLost?: boolean } | undefined)?.canBeLost !==
    false;
  const set = (lost: "lost" | "destroyed" | undefined) =>
    editLine(props, row.line.id, (l) => {
      const { lost: _old, ...rest } = l;
      return (lost ? { ...rest, lost } : rest) as Line;
    });
  if (row.lost && !own)
    return (
      <p className="muted">
        <span className="badge warn">{row.lost}</span> with the container it is
        in.
      </p>
    );
  if (own)
    return (
      <p>
        <span className="badge warn">{own}</span>{" "}
        <span className="muted">
          Kept as a record: no weight, no effects; any attunement stays until
          ended.
        </span>{" "}
        {props.canEdit && (
          <button
            type="button"
            className="secondary"
            onClick={() => set(undefined)}
          >
            Restore
          </button>
        )}
      </p>
    );
  if (!props.canEdit) return null;
  if (!canBeLost)
    return <p className="muted">This item cannot be lost or destroyed.</p>;
  return (
    <p className="chips">
      <button type="button" className="secondary" onClick={() => set("lost")}>
        Mark lost
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() => set("destroyed")}
      >
        Mark destroyed
      </button>
    </p>
  );
}

function nameOfLine(sheet: Sheet, lineId: string | undefined): string {
  const row = sheet.rows.find((r) => r.line.id === lineId);
  return row ? displayName(sheet.props, row) : String(lineId);
}

export function InventoryTab(props: TabProps) {
  const [openIds, setOpenIds] = useState<readonly string[]>([]);
  const [message, setMessage] = useState<string | undefined>();
  const [pending, setPending] = useState<PendingMove | undefined>();
  const rows =
    known(props.resolved.get<readonly LineRow[]>("containers.lines")) ?? [];
  const weight = known(props.resolved.get<Weight>("containers.carriedWeight"));
  const wallet = known(props.resolved.get<Wallet>("currency.wallet"));
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
    scrolls:
      known(props.resolved.get<readonly ScrollView[]>("scrolls.list")) ?? [],
    open: (id) => setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
    notice: (m) => setMessage(m),
    askMove: (m) => setPending(m),
  };
  const loose = rows.filter((r) => r.line.parent === undefined);

  return (
    <section className="panel">
      <h2>Inventory</h2>
      {weight && (
        <p className="muted">
          Carried weight: {Number(weight.pounds.toFixed(2))} lb known
          {weight.unknown > 0 &&
            `; ${weight.unknown} items of unknown weight not counted`}
        </p>
      )}
      {wallet && (
        <p data-testid="wallet">
          Wallet: {formatPurse(wallet.purse)}{" "}
          <span className="muted">
            (worth {Number((wallet.totalCp / 100).toFixed(2))} gp)
          </span>
        </p>
      )}
      {props.canEdit && (
        <p className="muted">
          Drag items onto a container or into its open window to pack them;
          Shift-drag to choose how many to take from a stack.
        </p>
      )}
      {pending && (
        <div
          className="error-box"
          role="alertdialog"
          aria-label="Move a container"
        >
          <p>
            {pending.name} holds {pending.inside}{" "}
            {pending.inside === 1 ? "item" : "items"}. What should happen to
            {pending.inside === 1 ? " it" : " them"}?
          </p>
          <p className="chips">
            <button
              type="button"
              onClick={() => {
                applyMove(sheet, pending, false);
                setPending(undefined);
              }}
            >
              Move with its contents
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                applyMove(sheet, pending, true);
                setPending(undefined);
              }}
            >
              Leave the contents here
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setPending(undefined)}
            >
              Cancel
            </button>
          </p>
        </div>
      )}
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
