import type { LineRow, Weight } from "@hearthtable/system-containers";
import type { WeaponView } from "@hearthtable/system-magazines";
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

export function InventoryTab(props: TabProps) {
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

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
      <section className="panel">
        <h2>Inventory</h2>
        {weight && (
          <p className="muted">
            Carried weight: {weight.pounds} lb known
            {weight.unknown > 0 &&
              `; ${weight.unknown} items of unknown weight not counted`}
          </p>
        )}
        <table className="rows">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Weight</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row) => {
              const line = row.line as Line & {
                quantity: number;
                held?: boolean;
              };
              const position = attuned.indexOf(line.id);
              const grantsWhen = (
                row.definition as { grantsWhen?: string } | undefined
              )?.grantsWhen;
              const holdable =
                grantsWhen === "held" || grantsWhen === "attuned-and-held";
              return (
                <tr key={line.id}>
                  <td>
                    {row.status === "resolved" ? (
                      row.name
                    ) : (
                      <span className="unresolved">{row.reason}</span>
                    )}
                    {row.depth !== undefined && row.depth > 0 && (
                      <span className="badge">inside, depth {row.depth}</span>
                    )}
                    {!row.accessible && (
                      <span className="badge warn">out of reach</span>
                    )}
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      aria-label={`Quantity of ${row.name}`}
                      value={line.quantity}
                      onChange={(e) => {
                        const q = Math.max(
                          0,
                          Math.floor(Number(e.target.value)),
                        );
                        if (Number.isFinite(q))
                          editLine(props, line.id, (l) => ({
                            ...l,
                            quantity: q,
                          }));
                      }}
                      style={{ width: "4.5em" }}
                    />
                  </td>
                  <td className="num muted">
                    {row.definition?.weight === undefined
                      ? "?"
                      : `${row.definition.weight} lb`}
                  </td>
                  <td>
                    {position >= 0 && (
                      <span className="badge good">
                        attuned #{position + 1}
                      </span>
                    )}
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {weapons.map((w) => (
        <section key={w.lineId} className="panel">
          <h2>{w.name}</h2>
          <p>
            Aim:{" "}
            {w.aim ? (
              w.aim.kind === "known" ? (
                `+${w.aim.value}`
              ) : (
                <span className="unresolved">{w.aim.reason}</span>
              )
            ) : (
              "—"
            )}
            {" · "}
            Canister:{" "}
            {w.canister
              ? `${w.canister.charges ?? "?"}/${w.canister.max} charges (${w.canister.name})`
              : "none installed"}
          </p>
          <p className="muted">
            {w.chambersRecorded
              ? `${w.loaded} of ${w.chambers.length} chambers loaded: ${w.chambers.map((c) => c.round?.name ?? "empty").join(", ")}`
              : `${w.chambers.length} chambers; loading not recorded yet`}
          </p>
        </section>
      ))}
    </div>
  );
}
