// Rolls at the table (Milestone 5 S8; Spell Effects and Active State, "Roll ownership and input
// modes"). Every open roll shows who it is asked of and why. Whoever controls that character
// answers it, and the DM can roll it for them instead; either way they choose the app's roll of
// the character's formula (Advantage or Disadvantage adjustable), their own dice expression, or a
// typed total. One answer counts, and it is logged with how it was rolled. The DM can also ask
// for any roll, prefilled so a player only has to press Roll. While the DM's view is open it
// applies what answered rolls decide: a failed concentration check ends concentration, and a
// successful repeat save ends the condition and the effect behind it.

import {
  configuredExpression,
  describeAnswer,
  outcomeOf,
  rollExpression,
  type Edge,
  type RollAnswer,
  type RollOutcome,
  type RollSpec,
} from "@hearthtable/play";
import {
  answerRoll,
  askRolls,
  cancelRoll,
  endEffects,
  markRollApplied,
  watchRolls,
  type RollPrompt,
} from "@hearthtable/storage";
import { useEffect, useRef, useState } from "react";
import { db, repository } from "../firebase";
import type { Control } from "./EncounterPanel";
import type { Participant } from "./useTable";

export function useRolls(campaign: string) {
  const [list, setList] = useState<readonly RollPrompt[]>([]);
  useEffect(() => watchRolls(db, campaign, setList, () => {}), [campaign]);
  return list;
}

const OUTCOME_WORDS: Record<RollOutcome, string> = {
  success: "success",
  failure: "failure",
  hit: "hit",
  miss: "miss",
  critical: "critical hit",
};

/** Answers one roll; also used by the DM taking over. */
export function RollForm({
  roll,
  name,
  takeover,
  uid,
  campaign,
  clock,
  onProblem,
}: {
  roll: RollPrompt;
  name: string;
  takeover: boolean;
  uid: string;
  campaign: string;
  clock: number;
  onProblem: (message: string) => void;
}) {
  const d20 = roll.spec.kind !== "damage" && roll.spec.kind !== "custom";
  const [mode, setMode] = useState<"configured" | "custom" | "manual">(
    "configured",
  );
  const [edge, setEdge] = useState<Edge | "">(roll.spec.edge ?? "");
  const [custom, setCustom] = useState(configuredExpression(roll.spec));
  const [total, setTotal] = useState("");
  const [natural, setNatural] = useState<"" | "20" | "1">("");
  const [busy, setBusy] = useState(false);
  const { edge: _asked, ...base } = roll.spec;
  const spec: RollSpec = edge ? { ...base, edge } : base;

  const submit = () => {
    let answer: RollAnswer | string;
    if (roll.spec.autoFail)
      answer = { mode: "manual", total: 0, autoFail: true };
    else if (mode === "manual") {
      const n = Number(total);
      if (total === "" || !Number.isFinite(n)) return;
      answer = {
        mode: "manual",
        total: Math.floor(n),
        ...(natural ? { natural: Number(natural) } : {}),
      };
    } else
      answer = rollExpression(
        mode === "custom" ? custom : configuredExpression(spec),
        mode,
      );
    if (typeof answer === "string") return onProblem(answer);
    const outcome = outcomeOf(spec, answer);
    setBusy(true);
    void answerRoll(
      db,
      campaign,
      roll,
      answer,
      outcome,
      uid,
      takeover,
      clock,
      `${name}: ${roll.purpose}: ${describeAnswer(answer)}${outcome ? `, ${OUTCOME_WORDS[outcome]}` : ""}${takeover ? " (rolled by the DM)" : ""}.`,
    ).then((err) => {
      setBusy(false);
      if (err) onProblem(err);
    });
  };

  return (
    <form
      className="chips roll-form"
      aria-label={`Roll: ${name}, ${roll.purpose}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {roll.spec.autoFail ? (
        <span className="warn-text">Fails automatically.</span>
      ) : (
        <>
          <select
            aria-label="How to roll"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="configured">
              Roll {configuredExpression(spec)}
            </option>
            <option value="custom">My own dice</option>
            <option value="manual">Typed total</option>
          </select>
          {d20 && mode === "configured" && (
            <select
              aria-label="Advantage"
              value={edge}
              onChange={(e) => setEdge(e.target.value as Edge | "")}
            >
              <option value="">straight</option>
              <option value="advantage">Advantage</option>
              <option value="disadvantage">Disadvantage</option>
            </select>
          )}
          {mode === "custom" && (
            <input
              aria-label="Dice"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              style={{ width: 120 }}
            />
          )}
          {mode === "manual" && (
            <>
              <input
                aria-label="Total"
                type="number"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                style={{ width: 80 }}
              />
              {roll.spec.kind === "attack" && (
                <select
                  aria-label="Natural roll"
                  value={natural}
                  onChange={(e) => setNatural(e.target.value as typeof natural)}
                >
                  <option value="">not a 20 or 1</option>
                  <option value="20">natural 20</option>
                  <option value="1">natural 1</option>
                </select>
              )}
            </>
          )}
        </>
      )}
      <button type="submit" disabled={busy}>
        {takeover ? "Roll for them" : "Roll"}
      </button>
    </form>
  );
}

export function RollsPanel({
  campaign,
  rolls,
  people,
  present,
  control,
  clock,
  onProblem,
}: {
  campaign: string;
  rolls: readonly RollPrompt[];
  people: ReadonlyMap<string, Participant>;
  present: readonly Participant[];
  control: Control;
  clock: number;
  onProblem: (message: string) => void;
}) {
  const open = rolls.filter((r) => r.status === "open");
  const name = (p: string) => people.get(p)?.name ?? p.split("/").at(-1) ?? p;
  const { uid, isDm } = control;
  return (
    <section className="panel" aria-label="Rolls">
      <h2>Rolls</h2>
      {open.length === 0 && <p className="muted">No rolls are waiting.</p>}
      <ul className="plain-list">
        {open.map((r) => {
          const mine = uid && control.controls(r.character) && !isDm;
          return (
            <li key={r.id} className="roll">
              <strong>{name(r.character)}</strong>: {r.purpose}
              {r.spec.target !== undefined &&
                ` (${r.spec.kind === "attack" ? "AC" : "DC"} ${r.spec.target})`}{" "}
              {uid && (mine || isDm) && (
                <RollForm
                  roll={r}
                  name={name(r.character)}
                  takeover={
                    !!isDm &&
                    !people.get(r.character)?.npc &&
                    !control.owns(r.character)
                  }
                  uid={uid}
                  campaign={campaign}
                  clock={clock}
                  onProblem={onProblem}
                />
              )}
              {isDm && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    void cancelRoll(db, campaign, r.id).then(
                      (e) => e && onProblem(e),
                    )
                  }
                >
                  withdraw
                </button>
              )}
              {!uid || (!mine && !isDm) ? (
                <span className="muted"> waiting for {name(r.character)}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {isDm && uid && (
        <AskRoll
          campaign={campaign}
          present={present}
          uid={uid}
          clock={clock}
          onProblem={onProblem}
        />
      )}
    </section>
  );
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

/** The DM asks for any roll, prefilled with the character's formula. */
function AskRoll({
  campaign,
  present,
  uid,
  clock,
  onProblem,
}: {
  campaign: string;
  present: readonly Participant[];
  uid: string;
  clock: number;
  onProblem: (message: string) => void;
}) {
  const [who, setWho] = useState(present[0]?.path ?? "");
  const [what, setWhat] = useState("save:dex");
  const [edge, setEdge] = useState<Edge | "">("");
  const [dc, setDc] = useState("");
  const [dice, setDice] = useState("1d20");
  const person = present.find((p) => p.path === who);
  const skills =
    (person?.resolved.get<readonly { id: string; label: string }[]>(
      "skills.all",
    ).kind === "known"
      ? (
          person.resolved.get<readonly { id: string; label: string }[]>(
            "skills.all",
          ) as { value: readonly { id: string; label: string }[] }
        ).value
      : []) ?? [];
  return (
    <form
      aria-label="Ask for a roll"
      className="chips"
      onSubmit={(e) => {
        e.preventDefault();
        if (!person) return;
        const [kind, id] = what.split(":") as [string, string];
        const key =
          kind === "save"
            ? `saves.${id}.total`
            : kind === "skill"
              ? `skills.${id}.total`
              : undefined;
        const bonusValue = key ? person.resolved.get<number>(key) : undefined;
        const autoFail =
          kind === "save" &&
          person.resolved.get<boolean>(`saves.${id}.autoFail`).kind ===
            "known" &&
          (
            person.resolved.get<boolean>(`saves.${id}.autoFail`) as {
              value: boolean;
            }
          ).value;
        const target = dc === "" ? undefined : Number(dc);
        const label =
          kind === "save"
            ? `${ABILITY_NAMES[id]} save`
            : kind === "skill"
              ? `${skills.find((s) => s.id === id)?.label ?? id} check`
              : `Roll ${dice}`;
        const spec: RollSpec =
          kind === "custom"
            ? { kind: "custom", dice }
            : {
                kind: kind === "save" ? "save" : "check",
                ...(key ? { key } : {}),
                bonus: bonusValue?.kind === "known" ? bonusValue.value : 0,
                ...(edge ? { edge } : {}),
                ...(target !== undefined ? { target } : {}),
                ...(autoFail ? { autoFail: true } : {}),
              };
        void askRolls(
          db,
          campaign,
          [{ character: person.path, purpose: label, spec }],
          uid,
          clock,
          `The DM asked ${person.name} for a ${label}${target !== undefined ? ` (DC ${target})` : ""}.`,
        ).then((err) => err && onProblem(err));
      }}
    >
      <span>Ask for a roll:</span>
      <select
        aria-label="Who rolls"
        value={who}
        onChange={(e) => setWho(e.target.value)}
      >
        {present.map((p) => (
          <option key={p.path} value={p.path}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Which roll"
        value={what}
        onChange={(e) => setWhat(e.target.value)}
      >
        {ABILITIES.map((a) => (
          <option key={a} value={`save:${a}`}>
            {ABILITY_NAMES[a]} save
          </option>
        ))}
        {skills.map((s) => (
          <option key={s.id} value={`skill:${s.id}`}>
            {s.label} check
          </option>
        ))}
        <option value="custom:dice">Dice…</option>
      </select>
      {what === "custom:dice" ? (
        <input
          aria-label="Dice to roll"
          value={dice}
          onChange={(e) => setDice(e.target.value)}
          style={{ width: 100 }}
        />
      ) : (
        <>
          <select
            aria-label="With"
            value={edge}
            onChange={(e) => setEdge(e.target.value as Edge | "")}
          >
            <option value="">straight</option>
            <option value="advantage">Advantage</option>
            <option value="disadvantage">Disadvantage</option>
          </select>
          <input
            aria-label="DC"
            type="number"
            placeholder="DC"
            value={dc}
            onChange={(e) => setDc(e.target.value)}
            style={{ width: 70 }}
          />
        </>
      )}
      <button type="submit" className="secondary" disabled={!person}>
        Ask
      </button>
    </form>
  );
}

/** On the DM's view: what answered rolls decide, applied once each. */
export function useApplyRollConsequences(
  enabled: boolean,
  campaign: string,
  rolls: readonly RollPrompt[],
  people: ReadonlyMap<string, Participant> | undefined,
  uid: string | undefined,
  clock: number | undefined,
  onProblem: (message: string) => void,
) {
  const busy = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled || !people || !uid || clock === undefined) return;
    for (const r of rolls) {
      if (r.status !== "answered" || r.applied || !r.consequence) continue;
      if (busy.current.has(r.id)) continue;
      const person = people.get(r.character);
      if (!person) continue;
      busy.current.add(r.id);
      const outcome = r.answer?.outcome;
      const c = r.consequence;
      const work = async () => {
        if (c.kind === "concentration" && outcome === "failure") {
          const held = person.resolved.get<
            readonly { effectId: string; name: string }[]
          >("concentration.maintained");
          const ending = held.kind === "known" ? held.value : [];
          if (ending.length)
            return endEffects(
              db,
              repository,
              campaign,
              person.path,
              person.name,
              ending.map((m) => ({ id: m.effectId, name: m.name })),
              "concentration",
              uid,
              clock,
            );
        }
        if (c.kind === "repeat-save" && outcome === "success" && c.effect) {
          const effect = person.effects.find((e) => e.id === c.effect);
          return endEffects(
            db,
            repository,
            campaign,
            person.path,
            person.name,
            [{ id: c.effect, name: effect?.name ?? "the effect" }],
            "save",
            uid,
            clock,
          );
        }
        return undefined;
      };
      void work().then(async (err) => {
        if (err) {
          busy.current.delete(r.id);
          if (!/conflict|revision|precondition/i.test(err)) onProblem(err);
          return;
        }
        const marked = await markRollApplied(db, campaign, r.id);
        if (marked) onProblem(marked);
      });
    }
  }, [enabled, campaign, rolls, people, uid, clock, onProblem]);
}
