import type { Value } from "@hearthtable/kernel";
import type { AttunedSlot } from "@hearthtable/system-attunement";
import type { ResourcePool } from "@hearthtable/system-resources";
import { Explained } from "./Explained";
import { known, type TabProps } from "./shared";

interface AbilityRow {
  readonly id: string;
  readonly label: string;
  readonly score: Value<number>;
  readonly modifier: Value<number>;
}

interface SkillRow {
  readonly id: string;
  readonly label: string;
  readonly ability: string;
  readonly proficiency: number;
  readonly total: Value<number>;
}

interface SaveRow {
  readonly id: string;
  readonly label: string;
  readonly proficient: boolean;
  readonly total: Value<number>;
}

const MARKS = ["", "●", "●●"];

export function StatsTab(props: TabProps) {
  const { resolved } = props;
  const abilities =
    known(resolved.get<readonly AbilityRow[]>("abilities.all")) ?? [];
  const skills = known(resolved.get<readonly SkillRow[]>("skills.all")) ?? [];
  const saves = known(resolved.get<readonly SaveRow[]>("saves.all")) ?? [];
  const tools =
    known(
      resolved.get<readonly { id: string; sources: string[] }[]>(
        "tools.proficiencies",
      ),
    ) ?? [];
  const pools =
    known(resolved.get<readonly ResourcePool[]>("resources.pools")) ?? [];
  const attunement = known(
    resolved.get<{ used: number; max: number; slots: readonly AttunedSlot[] }>(
      "attunement.slots",
    ),
  );
  const pointBuy = known(
    resolved.get<{ spent: number; budget: number; deficit: number }>(
      "abilities.pointBuy",
    ),
  );

  return (
    <div className="grid">
      <section className="panel">
        <h2>Abilities</h2>
        <div className="abilities" style={{ marginTop: 10 }}>
          {abilities.map((a) => (
            <div key={a.id} className="vital">
              <div className="vital-label">{a.label}</div>
              <div className="vital-value">
                <Explained value={a.score} />
              </div>
              <Explained value={a.modifier} style="signed" />
            </div>
          ))}
        </div>
        {pointBuy && (
          <p className="muted">
            Point buy: {pointBuy.spent} of {pointBuy.budget} points
            {pointBuy.deficit > 0 && (
              <span className="badge warn">{pointBuy.deficit} over budget</span>
            )}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Saving throws</h2>
        <table className="rows" style={{ marginTop: 6 }}>
          <tbody>
            {saves.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.label}
                  {s.proficient && (
                    <span className="badge good">proficient</span>
                  )}
                </td>
                <td className="num">
                  <Explained value={s.total} style="signed" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Skills</h2>
        <table className="rows" style={{ marginTop: 6 }}>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <td>
                  <span
                    className="muted"
                    style={{ display: "inline-block", width: "1.6em" }}
                    title={
                      ["Untrained", "Proficient", "Expertise"][s.proficiency]
                    }
                  >
                    {MARKS[s.proficiency]}
                  </span>
                  {s.label}{" "}
                  <span className="muted">({s.ability.toUpperCase()})</span>
                </td>
                <td className="num">
                  <Explained value={s.total} style="signed" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Resources</h2>
        <table className="rows" style={{ marginTop: 6 }}>
          <tbody>
            {pools.map((p) => (
              <tr key={p.pool}>
                <td>
                  {p.pool.replace(/-/g, " ")}{" "}
                  <span className="muted">({p.reset})</span>
                </td>
                <td className="num">
                  <Explained value={p.remaining} /> /{" "}
                  <Explained value={p.max} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ marginTop: 16 }}>Attunement</h2>
        {attunement ? (
          <ol>
            {attunement.slots.map((s) => (
              <li key={s.lineId}>
                {s.name}
                {s.overLimit && (
                  <span className="badge bad">over the limit</span>
                )}
              </li>
            ))}
            <li className="muted" style={{ listStyle: "none" }}>
              {attunement.used} of {attunement.max} slots used
            </li>
          </ol>
        ) : (
          <p className="unresolved">Unresolved</p>
        )}

        <h2 style={{ marginTop: 16 }}>Tools</h2>
        <ul>
          {tools.map((t) => (
            <li key={t.id}>
              {t.id.replace(/-/g, " ")}{" "}
              <span className="muted">({t.sources.join(", ")})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
