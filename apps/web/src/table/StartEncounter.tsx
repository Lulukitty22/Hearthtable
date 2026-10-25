// The DM's tools between encounters (Milestone 5 S3): making a quick NPC template, and starting
// an encounter (Turns, Encounters and Time, "Templates and instances", "Encounters", "Round 1").
// Starting one ends the downtime scene after the time the DM enters, places the chosen campaign
// characters, deploys numbered NPC instances from templates and rolls their initiative at once
// (with Disadvantage for anyone marked surprised).

import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { instanceNames, rollInitiative } from "@hearthtable/play";
import {
  startEncounter,
  type Deployment,
  type PlayState,
} from "@hearthtable/storage";
import { useState } from "react";
import { db, repository } from "../firebase";
import { nameProblem, segmentFor } from "../home/names";
import type { Participant, Template } from "./useTable";

/** Deployments for chosen counts of templates, with names and automatic rolls. */
export function deploymentsFor(
  templates: readonly Template[],
  counts: Readonly<Record<string, number>>,
  takenNames: readonly string[],
  surprised: (template: string) => boolean,
): Deployment[] {
  const taken = [...takenNames];
  return templates.flatMap((t) => {
    const count = Math.max(0, Math.floor(counts[t.path] ?? 0));
    if (!count) return [];
    const names = instanceNames(t.name, count, taken);
    taken.push(...names);
    return [
      {
        template: t.records,
        names,
        rolls: names.map(() =>
          rollInitiative(t.initiativeBonus, surprised(t.path)),
        ),
        surprised: surprised(t.path),
      },
    ];
  });
}

export function NewNpcTemplate({
  campaignPath,
  templates,
  onProblem,
}: {
  campaignPath: string;
  templates: readonly Template[];
  onProblem: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [hp, setHp] = useState("10");
  const [ac, setAc] = useState("12");
  const [init, setInit] = useState("0");
  const taken = templates
    .filter((t) => !t.core)
    .map((t) => t.path.split("/").at(-1) as string);
  const problem = name ? nameProblem(name, taken) : undefined;
  const numbers = [hp, ac, init].map(Number);
  const valid =
    !!name.trim() &&
    !problem &&
    numbers.every(Number.isInteger) &&
    (numbers[0] ?? 0) > 0;

  return (
    <form
      aria-label="New NPC template"
      className="chips"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const path = `${campaignPath}/NPCs/${segmentFor(name)}`;
        const base = {
          moduleId: "dnd5e-2024",
          schemaVersion: 1,
          origin: {
            scope: "campaign" as const,
            ownerId: campaignPath.split("/")[1] as string,
          },
          source: { status: "homebrew" as const },
          revision: 0,
          updatedAt: new Date().toISOString(),
          raw: {},
        };
        const [maxHp, armor, bonus] = numbers as [number, number, number];
        const records: RecordEnvelope[] = [
          {
            ...base,
            id: path as RecordId,
            kind: "character",
            data: {
              name: name.trim(),
              classLevels: [],
              abilities: {
                base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
              },
              features: [],
              hitPoints: { current: maxHp, temporary: 0 },
              activeEffects: [],
              authored: {
                "hit-points.max": maxHp,
                "armor-class.total": armor,
                "initiative.total": bonus,
              },
            },
          },
          {
            ...base,
            id: `${path}/Inventory` as RecordId,
            kind: "inventory",
            moduleId: "containers",
            data: { lines: [] },
          },
        ];
        void repository.save(records).then((r) => {
          if (!r.ok) onProblem(r.errors.map((x) => x.message).join("\n"));
          else setName("");
        });
      }}
    >
      <label>
        Name{" "}
        <input
          aria-label="NPC name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        HP{" "}
        <input
          aria-label="NPC HP"
          type="number"
          min={1}
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          style={{ width: 70 }}
        />
      </label>
      <label>
        AC{" "}
        <input
          aria-label="NPC AC"
          type="number"
          value={ac}
          onChange={(e) => setAc(e.target.value)}
          style={{ width: 60 }}
        />
      </label>
      <label>
        Initiative{" "}
        <input
          aria-label="NPC initiative bonus"
          type="number"
          value={init}
          onChange={(e) => setInit(e.target.value)}
          style={{ width: 60 }}
        />
      </label>
      <button type="submit" className="secondary" disabled={!valid}>
        Make template
      </button>
      {problem && <span className="unresolved">{problem}</span>}
    </form>
  );
}

export function StartEncounter({
  id,
  campaignPath,
  uid,
  state,
  downtime,
  characters,
  templates,
  onProblem,
}: {
  id: string;
  campaignPath: string;
  uid: string;
  state: PlayState;
  downtime: RecordEnvelope | undefined;
  characters: readonly Participant[];
  templates: readonly Template[];
  onProblem: (message: string) => void;
}) {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(characters.map((c) => c.path)),
  );
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [surprised, setSurprised] = useState<ReadonlySet<string>>(new Set());
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [busy, setBusy] = useState(false);
  const elapsed = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
  const npcCount = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const toggle = (set: ReadonlySet<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  return (
    <form
      aria-label="Start an encounter"
      onSubmit={(e) => {
        e.preventDefault();
        if (!downtime) return;
        setBusy(true);
        const characterPaths = characters
          .map((c) => c.path)
          .filter((p) => chosen.has(p));
        const deployments = deploymentsFor(templates, counts, [], (t) =>
          surprised.has(t),
        );
        void startEncounter(db, repository, {
          campaign: id,
          campaignPath,
          uid,
          state,
          downtime,
          elapsed,
          characters: characterPaths,
          deployments,
          surprised: characterPaths.filter((p) => surprised.has(p)),
          names: new Map(characters.map((c) => [c.path, c.name])),
        }).then((err) => {
          setBusy(false);
          if (err) onProblem(err);
        });
      }}
    >
      <h3>Start an encounter</h3>
      <fieldset>
        <legend>Characters</legend>
        {characters.map((c) => (
          <div key={c.path} className="chips">
            <label>
              <input
                type="checkbox"
                checked={chosen.has(c.path)}
                onChange={() => setChosen(toggle(chosen, c.path))}
              />{" "}
              {c.name}
            </label>
            {chosen.has(c.path) && (
              <label className="muted">
                <input
                  type="checkbox"
                  checked={surprised.has(c.path)}
                  onChange={() => setSurprised(toggle(surprised, c.path))}
                  aria-label={`${c.name} is surprised`}
                />{" "}
                surprised
              </label>
            )}
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend>NPCs</legend>
        {templates.length === 0 && (
          <p className="muted">No NPC templates yet: make one below.</p>
        )}
        {templates.map((t) => (
          <div key={t.path} className="chips">
            <label>
              <input
                type="number"
                min={0}
                max={50}
                value={counts[t.path] ?? 0}
                onChange={(e) =>
                  setCounts({ ...counts, [t.path]: Number(e.target.value) })
                }
                aria-label={`How many ${t.name}`}
                style={{ width: 60 }}
              />{" "}
              × {t.name}
              {t.core && <span className="badge">core</span>}
            </label>
            {(counts[t.path] ?? 0) > 0 && (
              <label className="muted">
                <input
                  type="checkbox"
                  checked={surprised.has(t.path)}
                  onChange={() => setSurprised(toggle(surprised, t.path))}
                  aria-label={`${t.name} surprised`}
                />{" "}
                surprised
              </label>
            )}
          </div>
        ))}
      </fieldset>
      <div className="chips">
        <span>Time that passed in this downtime:</span>
        <label>
          <input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            aria-label="Hours passed"
            style={{ width: 60 }}
          />{" "}
          h
        </label>
        <label>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label="Minutes passed"
            style={{ width: 60 }}
          />{" "}
          min
        </label>
        <button
          type="submit"
          disabled={busy || !downtime || chosen.size + npcCount === 0}
        >
          Start the encounter
        </button>
      </div>
    </form>
  );
}
