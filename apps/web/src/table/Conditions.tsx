// Conditions at the table (Milestone 5 S5; Turns, Encounters and Time, "Conditions"). Everyone
// sees each participant's conditions, including those another includes and going down, with the
// rules text for what is applied by hand. The DM applies and removes them: a duration ends it on
// the game clock, and a repeat save is shown as a reminder at the end of the character's turns.

import { after, type Moment } from "@hearthtable/play";
import { changeConditions } from "@hearthtable/storage";
import type { ConditionRow } from "@hearthtable/system-conditions";
import { useState, type ReactNode } from "react";
import { db, repository } from "../firebase";
import type { Participant } from "./useTable";

/** What the DM's view gives a participant's row: removing and adding conditions. */
export interface ConditionTools {
  readonly onRemove: (c: ConditionRow) => void;
  readonly add: ReactNode;
}

export interface ConditionKind {
  readonly ref: string;
  readonly name: string;
  readonly levels: boolean;
}

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** "Paralyzed: Wisdom save DC 15" for a condition with a repeat save. */
export function saveReminder(c: ConditionRow): string | undefined {
  return c.save
    ? `${c.name}: ${ABILITY_NAMES[c.save.ability] ?? c.save.ability} save DC ${c.save.dc}`
    : undefined;
}

function label(c: ConditionRow) {
  return `${c.name}${c.level ? ` ${c.level}` : ""}`;
}

export function ConditionChips({
  person,
  onRemove,
}: {
  person: Participant;
  /** Given to the DM: removes an applied condition. */
  onRemove?: (c: ConditionRow) => void;
}) {
  if (person.conditions.length === 0) return null;
  return (
    <div
      className="chips condition-chips"
      aria-label={`${person.name}'s conditions`}
    >
      {person.conditions.map((c) => (
        <details key={c.id} className="condition">
          <summary
            className={`chip ${c.origin === "applied" ? "" : "muted"}`}
            title={c.because ? `From ${c.because}` : undefined}
          >
            {label(c)}
            {c.origin === "down" && " (down)"}
          </summary>
          <div className="condition-text">
            {c.because && <p className="muted">From {c.because}.</p>}
            {c.save && <p>Repeat save: {saveReminder(c)}.</p>}
            {c.text.map((t) => (
              <p key={t}>{t}</p>
            ))}
            {onRemove && c.origin === "applied" && (
              <button
                type="button"
                className="secondary"
                onClick={() => onRemove(c)}
              >
                Remove {c.name}
              </button>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

/** The DM's form for applying a condition to one participant. */
export function AddCondition({
  person,
  kinds,
  now,
  campaign,
  uid,
  clock,
  onProblem,
}: {
  person: Participant;
  kinds: readonly ConditionKind[];
  now: Moment | undefined;
  campaign: string;
  uid: string;
  clock: number;
  onProblem: (message: string) => void;
}) {
  const [ref, setRef] = useState("");
  const [rounds, setRounds] = useState("");
  const [ability, setAbility] = useState("");
  const [dc, setDc] = useState("");
  const kind = kinds.find((k) => k.ref === ref);
  const roundCount = Number(rounds);
  const dcValue = Number(dc);
  return (
    <form
      className="chips add-condition"
      aria-label={`Add a condition to ${person.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!kind) return;
        const entry = {
          id: `condition-${Date.now().toString(36)}`,
          ref: kind.ref,
          ...(kind.levels ? { level: 1 } : {}),
          ...(now && rounds && roundCount > 0
            ? { endsAt: after(now, roundCount * 6) }
            : {}),
          ...(ability && dc && Number.isInteger(dcValue)
            ? { save: { ability, dc: dcValue } }
            : {}),
        };
        const extra = [
          ...(entry.endsAt ? [`for ${roundCount} rounds`] : []),
          ...(entry.save
            ? [`${ABILITY_NAMES[ability]} save DC ${dcValue} to end it`]
            : []),
        ];
        void changeConditions(
          db,
          repository,
          campaign,
          person.path,
          { add: [entry] },
          uid,
          clock,
          `The DM gave ${person.name} ${kind.levels ? `a level of ${kind.name}` : kind.name}${extra.length ? ` (${extra.join("; ")})` : ""}.`,
        ).then((err) => {
          if (err) onProblem(err);
          else setRef("");
        });
      }}
    >
      <select
        aria-label={`Condition for ${person.name}`}
        value={ref}
        onChange={(e) => setRef(e.target.value)}
      >
        <option value="">Add a condition…</option>
        {kinds.map((k) => (
          <option key={k.ref} value={k.ref}>
            {k.levels ? `${k.name} (+1 level)` : k.name}
          </option>
        ))}
      </select>
      {kind && (
        <>
          <input
            type="number"
            min={1}
            placeholder="rounds"
            aria-label="Lasts how many rounds"
            value={rounds}
            onChange={(e) => setRounds(e.target.value)}
            style={{ width: 80 }}
          />
          <select
            aria-label="Repeat save"
            value={ability}
            onChange={(e) => setAbility(e.target.value)}
          >
            <option value="">no repeat save</option>
            {ABILITIES.map((a) => (
              <option key={a} value={a}>
                {ABILITY_NAMES[a]} save
              </option>
            ))}
          </select>
          {ability && (
            <input
              type="number"
              placeholder="DC"
              aria-label="Save DC"
              value={dc}
              onChange={(e) => setDc(e.target.value)}
              style={{ width: 60 }}
            />
          )}
          <button type="submit" className="secondary">
            Apply
          </button>
        </>
      )}
    </form>
  );
}

/** Removing an applied condition, logged. */
export function removeCondition(
  campaign: string,
  person: Participant,
  c: ConditionRow,
  uid: string,
  clock: number,
) {
  return changeConditions(
    db,
    repository,
    campaign,
    person.path,
    { remove: [c.id] },
    uid,
    clock,
    `The DM removed ${label(c)} from ${person.name}.`,
  );
}
