// Features as tiles grouped by where they came from. Clicking one opens its entry with the
// choices this character made; spells or items it mentions open in turn.

import type { FeatureRow } from "@hearthtable/system-features";
import { useOpenEntry } from "./entries";
import { Tile, TileGrid } from "./Grid";
import { known, type TabProps } from "./shared";

interface FeatureLine {
  readonly ref: string;
  readonly from?: string;
  readonly choices?: Record<string, string>;
}

export function FeaturesTab(props: TabProps) {
  const open = useOpenEntry();
  const rows =
    known(props.resolved.get<readonly FeatureRow[]>("features.list")) ?? [];
  const lines = ((
    props.records.get(props.characterId)?.data as
      { features?: FeatureLine[] } | undefined
  )?.features ?? []) as readonly FeatureLine[];

  const groups = new Map<
    string,
    { row: FeatureRow; line: FeatureLine | undefined }[]
  >();
  rows.forEach((row, i) => {
    const from = row.from ?? "Other";
    groups.set(from, [...(groups.get(from) ?? []), { row, line: lines[i] }]);
  });

  return (
    <div className="grid">
      {[...groups].map(([from, items]) => (
        <section key={from} className="panel">
          <h2>{from}</h2>
          <TileGrid>
            {items.map(({ row, line }, i) => (
              <Tile
                key={`${row.ref}-${i}`}
                name={row.name}
                {...(row.status === "unresolved"
                  ? { tone: "bad" as const }
                  : {})}
                onOpen={() =>
                  open(row.ref, {
                    ...(line?.choices ? { choices: line.choices } : {}),
                    ...(row.from ? { from: row.from } : {}),
                  })
                }
              />
            ))}
          </TileGrid>
        </section>
      ))}
    </div>
  );
}
