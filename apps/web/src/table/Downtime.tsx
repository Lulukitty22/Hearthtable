// The downtime panel (Milestone 5 S5; Turns, Encounters and Time, "Downtime"). An open floor:
// whoever controls a character adds activities at any time, everyone sees them as they arrive,
// and the DM approves them in the order submitted. Each character's state shows as if its
// pending activities will be approved, so players can plan on one another, and an activity can
// wait for someone else's. The DM sees each character's summary and ends the downtime by
// entering how much time passed. After a Short Rest the player rolls Hit Point Dice here.

import {
  activityType,
  activityTypes,
  formatDuration,
  summaryLine,
  type CharacterData,
} from "@hearthtable/play";
import {
  doneSpending,
  passTime,
  rollHitDie,
  setActivityStatus,
  submitActivity,
  watchActivities,
  type Activity,
  type PlayState,
} from "@hearthtable/storage";
import type { RecordEnvelope } from "@hearthtable/kernel";
import { useEffect, useRef, useState } from "react";
import { db, repository } from "../firebase";
import type { Control } from "./EncounterPanel";
import { applyRolls, runActivities } from "./runDowntime";
import type { Participant } from "./useTable";

const OPEN = new Set(["pending", "approved"]);

export function useActivities(campaign: string) {
  const [list, setList] = useState<readonly Activity[]>([]);
  useEffect(() => watchActivities(db, campaign, setList, () => {}), [campaign]);
  return list;
}

/** On the DM's view: applies Hit Point Dice rolled after a Short Rest, once each. */
export function useApplyRolls(
  enabled: boolean,
  campaign: string,
  activities: readonly Activity[],
  people: ReadonlyMap<string, Participant> | undefined,
  onProblem: (message: string) => void,
) {
  const busy = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled || !people) return;
    for (const a of activities) {
      const person = people.get(a.character);
      if (!person || a.rolls.length <= a.applied || busy.current.has(a.id))
        continue;
      busy.current.add(a.id);
      void applyRolls(campaign, a, person).then((err) => {
        busy.current.delete(a.id);
        if (err) onProblem(err);
      });
    }
  }, [enabled, campaign, activities, people, onProblem]);
}

/** A character's data after its open activities, as if they are approved and finished. */
function projected(
  person: Participant,
  activities: readonly Activity[],
  clock: number,
): { hp: number; lines: string[] } {
  let data: CharacterData = { hitPoints: { current: person.hp?.current ?? 0 } };
  const lines: string[] = [];
  for (const a of activities) {
    const type = activityType(a.type);
    if (!type) continue;
    const hp = (data["hitPoints"] as { current?: number }).current ?? 0;
    const out = type.finish(
      {
        name: person.name,
        hpCurrent: hp,
        hpMax: person.hp?.max,
        pools: person.pools,
      },
      data,
      clock,
    );
    data = out.data;
    lines.push(`${type.name}: ${out.summary}`);
  }
  return {
    hp: (data["hitPoints"] as { current?: number }).current ?? 0,
    lines,
  };
}

export function DowntimePanel({
  campaign,
  campaignPath,
  state,
  scene,
  activities,
  people,
  characters,
  control,
  onProblem,
}: {
  campaign: string;
  campaignPath: string;
  state: PlayState;
  scene: RecordEnvelope | undefined;
  activities: readonly Activity[];
  people: ReadonlyMap<string, Participant>;
  characters: readonly string[];
  control: Control;
  onProblem: (message: string) => void;
}) {
  const { uid, isDm } = control;
  const mine = characters.filter((p) => control.controls(p));
  const name = (p: string) => people.get(p)?.name ?? p.split("/").at(-1) ?? p;
  const open = activities.filter((a) => OPEN.has(a.status));
  const report = (err: string | undefined) => err && onProblem(err);
  const typeName = (a: Activity) => activityType(a.type)?.name ?? a.type;

  return (
    <section className="panel" aria-label="Downtime">
      <h2>Downtime activities</h2>
      <p className="muted">
        Add what your character does; the DM approves activities in the order
        they arrive and ends the downtime by entering how much time passed.
      </p>

      {uid && mine.length > 0 && (
        <AddActivity
          key={state.scene}
          characters={mine}
          people={people}
          open={open}
          clock={state.clock}
          name={name}
          onSubmit={(a, text) =>
            void submitActivity(
              db,
              campaign,
              { ...a, scene: state.scene },
              uid,
              state.clock,
              text,
            ).then(report)
          }
        />
      )}

      <ol className="activity-list" aria-label="Activities">
        {open.map((a) => {
          const waits = a.waitsFor
            ? activities.find((x) => x.id === a.waitsFor)
            : undefined;
          return (
            <li key={a.id} className={`activity activity-${a.status}`}>
              <strong>{name(a.character)}</strong>: {typeName(a)}{" "}
              {formatDuration(a.seconds)}
              {a.note && ` (${a.note})`}
              {a.progress > 0 && ` · ${formatDuration(a.progress)} done`}
              {waits &&
                ` · waits for ${name(waits.character)}'s ${typeName(waits)}`}{" "}
              <span
                className={`badge ${a.status === "pending" ? "warn" : "good"}`}
              >
                {a.status}
              </span>
              {isDm && uid && a.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() =>
                      void setActivityStatus(
                        db,
                        campaign,
                        a.id,
                        "approved",
                        uid,
                        state.clock,
                        `The DM approved ${name(a.character)}'s ${typeName(a)}.`,
                      ).then(report)
                    }
                  >
                    approve
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() =>
                      void setActivityStatus(
                        db,
                        campaign,
                        a.id,
                        "rejected",
                        uid,
                        state.clock,
                        `The DM rejected ${name(a.character)}'s ${typeName(a)}.`,
                      ).then(report)
                    }
                  >
                    reject
                  </button>
                </>
              )}
              {uid && control.controls(a.character) && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    void setActivityStatus(
                      db,
                      campaign,
                      a.id,
                      "cancelled",
                      uid,
                      state.clock,
                      `${name(a.character)}'s ${typeName(a)} was cancelled.`,
                    ).then(report)
                  }
                >
                  cancel
                </button>
              )}
            </li>
          );
        })}
        {open.length === 0 && <li className="muted">No activities yet.</li>}
      </ol>

      <h3>As planned</h3>
      <ul className="plain-list" aria-label="As planned">
        {characters.map((p) => {
          const person = people.get(p);
          const theirs = open.filter((a) => a.character === p);
          if (!person) return null;
          const after = projected(person, theirs, state.clock);
          return (
            <li key={p}>
              {summaryLine(person.name, theirs)}
              {theirs.length > 0 && (
                <span className="muted">
                  {" "}
                  → HP {after.hp}
                  {person.hp?.max !== undefined ? ` / ${person.hp.max}` : ""}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {activities
        .filter(
          (a) => a.spend === "open" && uid && control.controls(a.character),
        )
        .map((a) => (
          <SpendHitDice
            key={a.id}
            activity={a}
            person={people.get(a.character)}
            onRoll={(roll, text) =>
              uid &&
              void rollHitDie(
                db,
                campaign,
                a.id,
                roll,
                uid,
                state.clock,
                text,
              ).then(report)
            }
            onDone={() => void doneSpending(db, campaign, a.id).then(report)}
          />
        ))}

      {isDm && uid && scene && (
        <PassTime
          onPass={async (elapsed) => {
            const err = await runActivities(
              campaign,
              activities,
              people,
              uid,
              state.clock,
              elapsed,
            );
            if (err) return onProblem(err);
            report(
              await passTime(db, repository, {
                campaign,
                campaignPath,
                uid,
                state,
                downtime: scene,
                elapsed,
              }),
            );
          }}
        />
      )}
    </section>
  );
}

function AddActivity({
  characters,
  people,
  open,
  clock,
  name,
  onSubmit,
}: {
  characters: readonly string[];
  people: ReadonlyMap<string, Participant>;
  open: readonly Activity[];
  clock: number;
  name: (path: string) => string;
  onSubmit: (
    a: {
      character: string;
      type: string;
      seconds: number;
      note?: string;
      waitsFor?: string;
    },
    text: string,
  ) => void;
}) {
  const [character, setCharacter] = useState(characters[0] ?? "");
  const [type, setType] = useState("");
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [note, setNote] = useState("");
  const [waitsFor, setWaitsFor] = useState("");
  const t = activityType(type);
  const seconds = t?.duration({
    seconds: (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60,
  });
  const person = people.get(character);
  const warnings =
    t && person
      ? t.warnings(
          {
            name: person.name,
            hpCurrent: person.hp?.current ?? 0,
            hpMax: person.hp?.max,
            pools: person.pools,
          },
          {},
          clock,
        )
      : [];
  const ready = !!t && !!seconds && (!t.needsNote || note.trim() !== "");
  return (
    <form
      aria-label="Add an activity"
      className="chips add-activity"
      onSubmit={(e) => {
        e.preventDefault();
        if (!t || !seconds) return;
        onSubmit(
          {
            character,
            type: t.id,
            seconds,
            ...(t.needsNote ? { note: note.trim() } : {}),
            ...(waitsFor ? { waitsFor } : {}),
          },
          `${name(character)} added ${t.name} (${formatDuration(seconds)})${t.needsNote ? `: ${note.trim()}` : ""}.`,
        );
        setType("");
        setNote("");
        setWaitsFor("");
      }}
    >
      {characters.length > 1 && (
        <select
          aria-label="Character"
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
        >
          {characters.map((c) => (
            <option key={c} value={c}>
              {name(c)}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Activity"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="">Add an activity…</option>
        {activityTypes().map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
            {x.duration({})
              ? ` (${formatDuration(x.duration({}) as number)})`
              : ""}
          </option>
        ))}
      </select>
      {t?.needsNote && (
        <>
          <input
            aria-label="What they do"
            placeholder="keep watch, scout…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <input
            aria-label="Hours"
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            style={{ width: 60 }}
          />{" "}
          h
          <input
            aria-label="Minutes"
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            style={{ width: 60 }}
          />{" "}
          min
        </>
      )}
      {t && open.length > 0 && (
        <select
          aria-label="Waits for"
          value={waitsFor}
          onChange={(e) => setWaitsFor(e.target.value)}
        >
          <option value="">starts when ready</option>
          {open.map((a) => (
            <option key={a.id} value={a.id}>
              waits for {name(a.character)}&apos;s{" "}
              {activityType(a.type)?.name ?? a.type}
            </option>
          ))}
        </select>
      )}
      {t && (
        <button type="submit" disabled={!ready}>
          Add
        </button>
      )}
      {warnings.map((w) => (
        <span key={w} className="warn-text" role="status">
          {w}
        </span>
      ))}
    </form>
  );
}

function SpendHitDice({
  activity,
  person,
  onRoll,
  onDone,
}: {
  activity: Activity;
  person: Participant | undefined;
  onRoll: (
    roll: { die: number; face: number; con: number; total: number },
    text: string,
  ) => void;
  onDone: () => void;
}) {
  if (!person) return null;
  // Dice rolled but not yet applied still count as spent here.
  const pending = activity.rolls.slice(activity.applied);
  const left = person.hitDice.map((d) => ({
    ...d,
    remaining: d.remaining - pending.filter((r) => r.die === d.die).length,
  }));
  return (
    <div
      className="panel spend-dice"
      aria-label={`${person.name}'s Hit Point Dice`}
    >
      <p>
        {person.name} may spend Hit Point Dice: roll one, add Constitution (
        {person.conModifier >= 0 ? "+" : ""}
        {person.conModifier}), and decide after each roll.
      </p>
      <div className="chips">
        {left.map((d) => (
          <button
            key={d.die}
            type="button"
            className="secondary"
            disabled={d.remaining <= 0}
            onClick={() => {
              const face = 1 + Math.floor(Math.random() * d.die);
              const total = Math.max(1, face + person.conModifier);
              onRoll(
                { die: d.die, face, con: person.conModifier, total },
                `${person.name} spent a Hit Point Die: d${d.die} (${face}) ${person.conModifier >= 0 ? "+" : "−"} ${Math.abs(person.conModifier)} = ${total} hit points.`,
              );
            }}
          >
            Roll a d{d.die} ({d.remaining} left)
          </button>
        ))}
        <button type="button" className="link-button" onClick={onDone}>
          Done spending
        </button>
      </div>
      {activity.rolls.length > 0 && (
        <p className="muted">
          Rolled:{" "}
          {activity.rolls.map((r) => `d${r.die}: ${r.total}`).join(", ")}
        </p>
      )}
    </div>
  );
}

function PassTime({ onPass }: { onPass: (elapsed: number) => Promise<void> }) {
  const [hours, setHours] = useState("8");
  const [minutes, setMinutes] = useState("0");
  const [busy, setBusy] = useState(false);
  const elapsed = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
  return (
    <form
      aria-label="End the downtime"
      className="chips"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void onPass(elapsed).finally(() => setBusy(false));
      }}
    >
      <span>Time that passed:</span>
      <input
        aria-label="Hours that passed"
        type="number"
        min={0}
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        style={{ width: 60 }}
      />{" "}
      h
      <input
        aria-label="Minutes that passed"
        type="number"
        min={0}
        max={59}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        style={{ width: 60 }}
      />{" "}
      min
      <button type="submit" disabled={busy || elapsed <= 0}>
        End the downtime
      </button>
    </form>
  );
}
