// The sheet header: identity, HP (editable), AC, initiative, proficiency, spellcasting, and
// switches for active effects. Every number comes from the same resolved character as the tabs.

import type { ActiveEffectRow } from "@hearthtable/system-active-effects";
import type { BookView } from "@hearthtable/system-spellbook-readiness";
import { Explained } from "./Explained";
import { known, type Data, type TabProps } from "./shared";

interface ClassLevel {
  readonly id: string;
  readonly name: string;
  readonly level: number;
}

type ActiveEntry = { id: string; ref: string; activatedAt: string };

export function Header(props: TabProps) {
  const { resolved, records, characterId } = props;
  const character = records.get(characterId)?.data as Data & {
    name?: string;
    species?: string;
    background?: string;
    subclasses?: Record<string, string>;
  };
  const classes =
    known(resolved.get<readonly ClassLevel[]>("character.classes")) ?? [];
  const hp = known(
    resolved.get<{ current: number; temporary: number }>("hit-points.state"),
  );
  const effects =
    known(resolved.get<readonly ActiveEffectRow[]>("active-effects.list")) ??
    [];
  const books =
    known(resolved.get<readonly BookView[]>("spellbook-readiness.books")) ?? [];
  const casters = classes.filter(
    (c) => resolved.get(`spellcasting.classes.${c.id}.attack`).kind === "known",
  );

  // Effects that can be switched on: spells in her books whose definitions carry `whileActive`.
  const switchable = [
    ...new Set(books.flatMap((b) => b.entries.map((e) => e.ref))),
  ].flatMap((ref) => {
    const r = records.get(ref);
    return r && (r.data as { whileActive?: unknown }).whileActive !== undefined
      ? [{ ref: r.id, name: String((r.data as { name: unknown }).name) }]
      : [];
  });
  const activeRefs = new Set(
    effects.filter((e) => e.status === "active").map((e) => e.ref),
  );

  const setHp = (field: "current" | "temporary", value: number) =>
    props.edit(characterId, (data) => ({
      ...data,
      hitPoints: { ...(data["hitPoints"] as Data), [field]: value },
    }));

  const toggle = (ref: string) =>
    props.edit(characterId, (data) => {
      const list = (data["activeEffects"] as ActiveEntry[] | undefined) ?? [];
      return activeRefs.has(ref)
        ? { ...data, activeEffects: list.filter((e) => e.ref !== ref) }
        : {
            ...data,
            activeEffects: [
              ...list,
              {
                id: `effect-${Date.now()}`,
                ref,
                activatedAt: new Date().toISOString(),
              },
            ],
          };
    });

  return (
    <header className="sheet-header">
      <div className="sheet-title">
        <h1>{character?.name ?? characterId}</h1>
        <span className="muted">
          {[character?.species, character?.background]
            .filter(Boolean)
            .join(" · ")}
          {" · "}
          {classes
            .map(
              (c) =>
                `${character?.subclasses?.[c.id] ? `${character.subclasses[c.id]} ` : ""}${c.name} ${c.level}`,
            )
            .join(" / ")}
          {" · Level "}
          <Explained value={resolved.get<number>("character.level")} />
        </span>
      </div>

      <div className="vitals">
        <div className="vital">
          <div className="vital-label">Hit points</div>
          <div className="vital-value hp-edit">
            {hp && !props.canEdit ? (
              <span aria-label="Current hit points">{hp.current}</span>
            ) : hp ? (
              <input
                type="number"
                aria-label="Current hit points"
                value={hp.current}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value));
                  if (Number.isFinite(n)) setHp("current", n);
                }}
              />
            ) : (
              <span className="unresolved">?</span>
            )}
            <span className="muted">/</span>
            <Explained value={resolved.get<number>("hit-points.max")} />
          </div>
          {hp && !props.canEdit && hp.temporary > 0 && (
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Temp {hp.temporary}
            </span>
          )}
          {hp && props.canEdit && (
            <label className="muted" style={{ fontSize: "0.8rem" }}>
              Temp{" "}
              <input
                type="number"
                min={0}
                aria-label="Temporary hit points"
                value={hp.temporary}
                style={{ width: "3.5em" }}
                onChange={(e) => {
                  const n = Math.max(0, Math.floor(Number(e.target.value)));
                  if (Number.isFinite(n)) setHp("temporary", n);
                }}
              />
            </label>
          )}
        </div>
        <div className="vital">
          <div className="vital-label">Armor class</div>
          <div className="vital-value" data-testid="armor-class">
            <Explained value={resolved.get<number>("armor-class.total")} />
          </div>
        </div>
        <div className="vital">
          <div className="vital-label">Initiative</div>
          <div className="vital-value">
            <Explained
              value={resolved.get<number>("initiative.total")}
              style="signed"
            />
          </div>
        </div>
        <div className="vital">
          <div className="vital-label">Proficiency</div>
          <div className="vital-value">
            <Explained
              value={resolved.get<number>("proficiency.bonus")}
              style="signed"
            />
          </div>
        </div>
        {casters.map((c) => (
          <div key={c.id} className="vital">
            <div className="vital-label">{c.name} spells</div>
            <div
              className="vital-value"
              data-testid={`spell-attack-${c.name.toLowerCase()}`}
            >
              <Explained
                value={resolved.get<number>(
                  `spellcasting.classes.${c.id}.attack`,
                )}
                style="signed"
              />
            </div>
            <span className="muted">
              DC{" "}
              <Explained
                value={resolved.get<number>(`spellcasting.classes.${c.id}.dc`)}
              />
            </span>
          </div>
        ))}
      </div>

      {!props.canEdit && (
        <div className="chips">
          <span className="muted">Active:</span>
          {switchable.filter((s) => activeRefs.has(s.ref)).length === 0 && (
            <span className="muted">none</span>
          )}
          {switchable
            .filter((s) => activeRefs.has(s.ref))
            .map((s) => (
              <span key={s.ref} className="chip">
                {s.name}
              </span>
            ))}
        </div>
      )}
      {props.canEdit && switchable.length > 0 && (
        <div className="chips">
          <span className="muted">Active:</span>
          {switchable.map((s) => (
            <button
              key={s.ref}
              type="button"
              className="chip"
              aria-pressed={activeRefs.has(s.ref)}
              onClick={() => toggle(s.ref)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
