import type { FeatureRow } from "@hearthtable/system-features";
import { known, type TabProps } from "./shared";

export function FeaturesTab(props: TabProps) {
  const features =
    known(props.resolved.get<readonly FeatureRow[]>("features.list")) ?? [];
  const groups = new Map<string, FeatureRow[]>();
  for (const f of features)
    groups.set(f.from ?? "Other", [
      ...(groups.get(f.from ?? "Other") ?? []),
      f,
    ]);

  return (
    <div className="grid">
      {[...groups].map(([from, rows]) => (
        <section key={from} className="panel">
          <h2>{from}</h2>
          <ul>
            {rows.map((f, i) => (
              <li key={`${f.ref}-${i}`}>
                {f.status === "resolved" ? (
                  f.name
                ) : (
                  <span className="unresolved">{f.name}</span>
                )}
                {f.status === "unresolved" && (
                  <span className="muted"> — {f.reason}</span>
                )}
                {f.grants.length > 0 && (
                  <span className="muted">
                    {" "}
                    (
                    {f.grants
                      .map((g) =>
                        g.type === "capability"
                          ? g.id
                          : "target" in g
                            ? g.target
                            : g.pool,
                      )
                      .join(", ")}
                    )
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
