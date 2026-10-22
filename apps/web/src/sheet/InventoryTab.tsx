// The inventory as a grid of item tiles. Clicking a tile opens the whole entry: this
// character's own copy (quantity, held or stowed, placement, attunement slot, a book's title
// and spells, a weapon's chambers) and then the shared definition it points at.

import type { LineRow, Weight } from "@hearthtable/system-containers";
import type { WeaponView } from "@hearthtable/system-magazines";
import type { BookView } from "@hearthtable/system-spellbook-readiness";
import { useState } from "react";
import { EntryBody, nameOfRecord, useOpenEntry } from "./entries";
import { DetailPanel, Tile, TileGrid } from "./Grid";
import {
  known,
  sheetRecord,
  sheetRecords,
  type Data,
  type TabProps,
} from "./shared";

type Line = Record<string, unknown> & { id: string };

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

function ItemDetail({
  props,
  row,
  position,
  weapon,
  onClose,
}: {
  props: TabProps;
  row: LineRow;
  position: number;
  weapon?: WeaponView;
  onClose: () => void;
}) {
  const openEntry = useOpenEntry();
  const line = row.line as Line & { quantity: number; held?: boolean };
  const grantsWhen = (row.definition as { grantsWhen?: string } | undefined)
    ?.grantsWhen;
  const holdable = grantsWhen === "held" || grantsWhen === "attuned-and-held";
  const bookRecord = bookRecordFor(props, line.id);
  const books =
    known(
      props.resolved.get<readonly BookView[]>("spellbook-readiness.books"),
    ) ?? [];
  const book = books.find((b) => b.lineId === line.id);
  const title = displayName(props, row);

  return (
    <DetailPanel title={title} onClose={onClose}>
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
            `Packed ${row.depth} deep`
          )}
          {!row.accessible && <span className="badge warn">out of reach</span>}
          {position >= 0 && (
            <span className="badge good">attuned, slot {position + 1}</span>
          )}
        </span>
      </div>

      {book && (
        <>
          <h3>
            Contains {book.entries.length}
            {book.capacity !== undefined && ` of ${book.capacity}`} spells
          </h3>
          <TileGrid>
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
              />
            ))}
          </TileGrid>
        </>
      )}

      {weapon && (
        <>
          <h3>Weapon</h3>
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
          </p>
          <p className="muted">
            {weapon.chambersRecorded
              ? `${weapon.loaded} of ${weapon.chambers.length} chambers loaded: ${weapon.chambers.map((c) => c.round?.name ?? "empty").join(", ")}`
              : `${weapon.chambers.length} chambers; loading not recorded yet`}
          </p>
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

      <h3>{nameOfRecord(props, line["ref"] as string)}</h3>
      <EntryBody props={props} id={line["ref"] as string} />
    </DetailPanel>
  );
}

export function InventoryTab(props: TabProps) {
  const [open, setOpen] = useState<string | undefined>();
  const lines =
    known(props.resolved.get<readonly LineRow[]>("containers.lines")) ?? [];
  const weight = known(props.resolved.get<Weight>("containers.carriedWeight"));
  const weapons =
    known(props.resolved.get<readonly WeaponView[]>("magazines.weapons")) ?? [];
  const attuned =
    (
      sheetRecord(props, "inventory")?.data as
        { attuned?: string[] } | undefined
    )?.attuned ?? [];
  const openRow = lines.find((l) => l.line.id === open);
  const openWeapon = weapons.find((w) => w.lineId === open);

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
      <TileGrid>
        {lines.map((row) => {
          const position = attuned.indexOf(row.line.id);
          const held = (row.line as { held?: boolean }).held === true;
          return (
            <Tile
              key={row.line.id}
              name={displayName(props, row)}
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
              onOpen={() => setOpen(row.line.id)}
            />
          );
        })}
      </TileGrid>
      {openRow && (
        <ItemDetail
          props={props}
          row={openRow}
          position={attuned.indexOf(openRow.line.id)}
          {...(openWeapon ? { weapon: openWeapon } : {})}
          onClose={() => setOpen(undefined)}
        />
      )}
    </section>
  );
}
