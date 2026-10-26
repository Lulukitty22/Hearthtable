// The DM approves a request at its eligible moment and resolves it (Milestone 5 S7 and S8; Spell
// Effects and Active State, "Casting workflow" and "Who rolls in a cast; critical hits"). The
// panel shows the request and its targets (the player's picks, which the DM can change). For a
// save spell the DM asks each target's player for their save; for an attack spell the caster's
// player rolls an attack against each target's Armor Class; damage or healing is the caster's
// player's roll, with the dice doubled after a Critical Hit. Answers fill the panel as they
// arrive; the DM can roll for anyone from the Rolls panel, or set a result or total by hand.
// "Approve and resolve" writes everything at once with the request, then asks anyone who took
// damage while concentrating for their concentration check.

import type { CastInput, Moment, RollSpec } from "@hearthtable/play";
import { criticalDice } from "@hearthtable/play";
import {
  askRolls,
  resolveAction,
  type ActionRequest,
  type RollAsk,
  type RollPrompt,
} from "@hearthtable/storage";
import { useState } from "react";
import { db } from "../firebase";
import { snapshotFrom } from "../sheet/scribe";
import { planCast, spellShape, type TargetResult } from "./resolveSpell";
import type { Participant } from "./useTable";

const ABILITY: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

const known = <T,>(p: Participant, key: string): T | undefined => {
  const v = p.resolved.get<T>(key);
  return v.kind === "known" ? v.value : undefined;
};

/** A concentration check for someone who took damage while concentrating (2024: DC 10 or half). */
export function concentrationCheck(
  person: Participant,
  damage: number,
): RollAsk {
  const dc = Math.min(30, Math.max(10, Math.floor(damage / 2)));
  // War Caster and the like give Advantage on these saves.
  const grants =
    known<readonly { grant: { type: string; id?: string } }[]>(
      person,
      "kernel.grants",
    ) ?? [];
  const warCaster = grants.some(
    (g) =>
      g.grant.type === "capability" && g.grant.id === "advantage:concentration",
  );
  return {
    character: person.path,
    purpose: `Constitution save to keep concentrating (DC ${dc})`,
    spec: {
      kind: "save",
      key: "saves.con.total",
      bonus: known<number>(person, "saves.con.total") ?? 0,
      target: dc,
      ...(warCaster ? { edge: "advantage" as const } : {}),
      ...(known<boolean>(person, "saves.con.autoFail")
        ? { autoFail: true }
        : {}),
    },
    consequence: { kind: "concentration" },
  };
}

export function ResolvePanel({
  campaign,
  request,
  caster,
  spell,
  people,
  present,
  rolls,
  now,
  uid,
  clock,
  onDone,
}: {
  campaign: string;
  request: ActionRequest;
  caster: Participant;
  spell: Record<string, unknown> | undefined;
  people: ReadonlyMap<string, Participant>;
  /** Who can be a target: everyone in the scene. */
  present: readonly Participant[];
  /** Every roll in the campaign; those of this request fill the panel. */
  rolls: readonly RollPrompt[];
  now: Moment | undefined;
  uid: string;
  clock: number;
  onDone: (error?: string) => void;
}) {
  const input = request.input as unknown as CastInput & {
    targets?: readonly string[];
  };
  const shape = spellShape(spell as Parameters<typeof spellShape>[0]);
  const snapshot = spell
    ? snapshotFrom(caster.resolved, spell, input.castLevel)
    : undefined;
  const formula = snapshot?.formulas[0];
  const [targets, setTargets] = useState<readonly string[]>(
    input.targets?.length ? input.targets : [caster.path],
  );
  // The DM's own settings, which win over roll answers.
  const [results, setResults] = useState<Record<string, TargetResult>>({});
  const [typed, setTyped] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();

  const mine = rolls.filter(
    (r) => r.action === request.id && r.status !== "cancelled",
  );
  const promptFor = (target: string) =>
    mine.find((r) => r.target === target && r.spec.kind !== "damage");
  const damageRoll = mine.find((r) => r.spec.kind === "damage");
  const critical = mine.some((r) => r.answer?.outcome === "critical");
  const answered = (target: string): TargetResult | undefined => {
    const o = promptFor(target)?.answer?.outcome;
    if (!o) return undefined;
    return o === "success"
      ? "saved"
      : o === "failure"
        ? "failed"
        : o === "miss"
          ? "miss"
          : "hit";
  };
  const defaultResult: TargetResult = shape.attack
    ? "hit"
    : shape.save
      ? "failed"
      : "affected";
  const resultOf = (p: string) => results[p] ?? answered(p) ?? defaultResult;
  const amount = typed ?? String(damageRoll?.answer?.total ?? "");
  const plainBonus = (formula?.bonuses ?? [])
    .filter((b) => !b.when)
    .reduce((n, b) => n + b.value, 0);
  const damageDice = formula
    ? `${critical ? criticalDice(formula.dice) : formula.dice}${plainBonus ? `${plainBonus < 0 ? "-" : "+"}${Math.abs(plainBonus)}` : ""}`
    : undefined;

  const ask = (asks: RollAsk[], text: string) =>
    void askRolls(db, campaign, asks, uid, clock, text).then(
      (e) => e && setProblem(e),
    );
  const unasked = targets.filter((t) => !promptFor(t));

  return (
    <div className="panel resolve-panel" aria-label="Resolve the request">
      <h3>Approve and resolve</h3>
      <p>
        {caster.name}: {request.summary}
        {input.note && <span className="muted"> ({input.note})</span>}
      </p>
      {snapshot?.spellSaveDC !== undefined && (shape.save || shape.attack) && (
        <p className="muted">
          Spell save DC {snapshot.spellSaveDC}, attack +
          {snapshot.spellAttackBonus ?? "?"} (current numbers)
        </p>
      )}
      <fieldset>
        <legend>Targets</legend>
        {present.map((p) => {
          const prompt = promptFor(p.path);
          return (
            <div key={p.path} className="chips">
              <label>
                <input
                  type="checkbox"
                  checked={targets.includes(p.path)}
                  onChange={() =>
                    setTargets(
                      targets.includes(p.path)
                        ? targets.filter((t) => t !== p.path)
                        : [...targets, p.path],
                    )
                  }
                />{" "}
                {p.name}
              </label>
              {targets.includes(p.path) && (shape.attack || shape.save) && (
                <>
                  {prompt && (
                    <span className="muted" data-testid={`roll-${p.name}`}>
                      {prompt.answer
                        ? `rolled ${prompt.answer.autoFail ? "an automatic failure" : prompt.answer.total}`
                        : "waiting for the roll"}
                    </span>
                  )}
                  <select
                    aria-label={`${p.name}: result`}
                    value={resultOf(p.path)}
                    onChange={(e) =>
                      setResults({
                        ...results,
                        [p.path]: e.target.value as TargetResult,
                      })
                    }
                  >
                    {shape.attack ? (
                      <>
                        <option value="hit">hit</option>
                        <option value="miss">miss</option>
                      </>
                    ) : (
                      <>
                        <option value="failed">failed the save</option>
                        <option value="saved">made the save</option>
                      </>
                    )}
                  </select>
                </>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="chips">
        {shape.save &&
          unasked.length > 0 &&
          snapshot?.spellSaveDC !== undefined && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const ability = shape.save?.ability ?? "dex";
                const dc = snapshot.spellSaveDC as number;
                ask(
                  unasked.flatMap((t) => {
                    const p = people.get(t);
                    if (!p) return [];
                    const spec: RollSpec = {
                      kind: "save",
                      key: `saves.${ability}.total`,
                      bonus: known<number>(p, `saves.${ability}.total`) ?? 0,
                      target: dc,
                      ...(known<boolean>(p, `saves.${ability}.autoFail`)
                        ? { autoFail: true }
                        : {}),
                    };
                    return [
                      {
                        character: t,
                        purpose: `${ABILITY[ability]} save against ${input.name}`,
                        spec,
                        action: request.id,
                        target: t,
                      },
                    ];
                  }),
                  `The DM asked for ${ABILITY[ability]} saves against ${input.name} (DC ${dc}).`,
                );
              }}
            >
              Ask for saves
            </button>
          )}
        {shape.attack && unasked.length > 0 && snapshot?.casterClass && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              ask(
                unasked.flatMap((t) => {
                  const p = people.get(t);
                  if (!p) return [];
                  return [
                    {
                      character: caster.path,
                      purpose: `Spell attack with ${input.name} against ${p.name}`,
                      spec: {
                        kind: "attack",
                        key: `spellcasting.classes.${snapshot.casterClass}.attack`,
                        bonus: snapshot.spellAttackBonus ?? 0,
                        ...(p.ac !== undefined ? { target: p.ac } : {}),
                      },
                      action: request.id,
                      target: t,
                    },
                  ];
                }),
                `The DM asked ${caster.name} for a spell attack roll with ${input.name}.`,
              )
            }
          >
            Ask for the attack roll
          </button>
        )}
        {(shape.damages || shape.heals) && damageDice && !damageRoll && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              ask(
                [
                  {
                    character: caster.path,
                    purpose: `${input.name} ${shape.heals ? "healing" : "damage"}${critical ? " (Critical Hit)" : ""}`,
                    spec: { kind: "damage", dice: damageDice },
                    action: request.id,
                  },
                ],
                `The DM asked ${caster.name} to roll ${input.name}'s ${shape.heals ? "healing" : "damage"}.`,
              )
            }
          >
            Ask for the {shape.heals ? "healing" : "damage"} roll
          </button>
        )}
      </div>
      {(shape.damages || shape.heals) && formula && (
        <p>
          {shape.heals ? "Healing" : "Damage"}: {damageDice}
          {damageRoll &&
            (damageRoll.answer
              ? ` rolled ${damageRoll.answer.total}`
              : " (waiting for the roll)")}{" "}
          <label>
            total{" "}
            <input
              aria-label="Total"
              type="number"
              value={amount}
              onChange={(e) => setTyped(e.target.value)}
              style={{ width: 80 }}
            />
          </label>
        </p>
      )}
      {problem && <div className="error-box">{problem}</div>}
      <div className="chips">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void planCast({
              request,
              caster,
              spell: (spell ?? {}) as Parameters<typeof planCast>[0]["spell"],
              spellSaveDC: snapshot?.spellSaveDC,
              targets: targets.flatMap((t) => {
                const person = people.get(t);
                return person ? [{ person, result: resultOf(t) }] : [];
              }),
              amount: Number(amount) || 0,
              now,
              people,
            }).then(async (plan) => {
              if (typeof plan === "string") {
                setBusy(false);
                return onDone(plan);
              }
              const err = await resolveAction(
                db,
                campaign,
                request,
                plan,
                uid,
                clock,
              );
              // Concentration checks for anyone damaged while concentrating.
              const checks = err
                ? []
                : plan.damaged.flatMap((d) => {
                    const p = people.get(d.path);
                    const held =
                      p &&
                      known<readonly unknown[]>(p, "concentration.maintained");
                    return p && held?.length
                      ? [concentrationCheck(p, d.amount)]
                      : [];
                  });
              const asked = checks.length
                ? await askRolls(
                    db,
                    campaign,
                    checks,
                    uid,
                    clock,
                    "The DM asked for concentration checks.",
                  )
                : undefined;
              setBusy(false);
              onDone(err ?? asked);
            });
          }}
        >
          Approve and resolve
        </button>
        <button type="button" className="link-button" onClick={() => onDone()}>
          Back
        </button>
      </div>
    </div>
  );
}
