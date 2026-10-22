// The inventory as a grid of item tiles. Clicking a tile opens the whole entry: its
// definition, source and rules, plus this character's own state, which can be edited there
// (quantity, held or stowed). Attunement order and accessibility show on the tile.

import type { LineRow, Weight } from "@hearthtable/system-containers";
import type { WeaponView } from "@hearthtable/system-magazines";
import { useState } from "react";
import { describeGrants } from "./describe";
import { AllFields, DetailPanel, SourceLine, Tile, TileGrid } from "./Grid";
import { known, sheetRecord, type Data, type TabProps } from "./shared";

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

const WHEN: Record<string, string> = {
  owned: "while owned",
  equipped: "while equipped",
  held: "while held",
  attuned: "while attuned",
  "attuned-and-held": "while attuned and held",
};

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
  const line = row.line as Line & { quantity: number; held?: boolean };
  const def = row.definition as
    | (Record<string, unknown> & {
        weight?: number;
        volume?: number;
        attunement?: { required: boolean; requiresClass?: string };
        grants?: unknown;
        grantsWhen?: string;
        container?: {
          maxWeight?: number;
          maxVolume?: number;
          maxCount?: number;
          contentsAddWeight: boolean;
        };
      })
    | undefined;
  const record = props.records.get(line["ref"] as string);
  const holdable =
    def?.grantsWhen === "held" || def?.grantsWhen === "attuned-and-held";

  return (
    <DetailPanel title={row.name} onClose={onClose}>
      {row.status === "unresolved" ? (
        <p className="unresolved">{row.reason}</p>
      ) : (
        <SourceLine record={record} />
      )}

      <div className="detail-grid">
        <label>
          Quantity{" "}
          <input
            type="number"
            min={0}
            aria-label={`Quantity of ${row.name}`}
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
          Weight:{" "}
          {def?.weight === undefined ? (
            <span className="muted">unknown</span>
          ) : (
            `${def.weight} lb each`
          )}
          {def?.volume !== undefined && ` · ${def.volume} cu ft`}
        </span>
        <span>
          {row.depth === undefined ? (
            <span className="unresolved">placement broken</span>
          ) : row.depth === 0 ? (
            "Carried loose"
          ) : (
            `Packed ${row.depth} deep`
          )}
          {!row.accessible && <span className="badge warn">out of reach</span>}
        </span>
        {def?.attunement?.required && (
          <span>
            Requires attunement
            {def.attunement.requiresClass
              ? ` by ${props.records.get(def.attunement.requiresClass) ? String((props.records.get(def.attunement.requiresClass)?.data as { name?: unknown }).name) : def.attunement.requiresClass}`
              : ""}
            {position >= 0 ? (
              <span className="badge good">attuned, slot {position + 1}</span>
            ) : (
              <span className="badge">not attuned</span>
            )}
          </span>
        )}
        {def?.container && (
          <span>
            Container:{" "}
            {[
              def.container.maxWeight !== undefined &&
                `${def.container.maxWeight} lb`,
              def.container.maxVolume !== undefined &&
                `${def.container.maxVolume} cu ft`,
              def.container.maxCount !== undefined &&
                `${def.container.maxCount} items`,
            ]
              .filter(Boolean)
              .join(", ")}
            {!def.container.contentsAddWeight && " (contents add no weight)"}
          </span>
        )}
      </div>

      {def?.grants !== undefined && (
        <>
          <h3>Grants {def.grantsWhen ? WHEN[def.grantsWhen] : ""}</h3>
          <ul>
            {describeGrants(def.grants).map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
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

      <AllFields record={record} />
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
              name={row.name}
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
          {...(weapons.find((w) => w.lineId === openRow.line.id)
            ? {
                weapon: weapons.find(
                  (w) => w.lineId === openRow.line.id,
                ) as WeaponView,
              }
            : {})}
          onClose={() => setOpen(undefined)}
        />
      )}
    </section>
  );
}
