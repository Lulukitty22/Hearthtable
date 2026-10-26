// The DM resolves a weapon attack shot by shot (Milestone 5 S10; Aetherlock Engineered Rounds,
// "Firing, loading and clearing in play"). Each shot has its own target, its own attack roll by
// the attacker's player against the target's Armor Class (with Advantage under Precision), and
// its own damage roll for each damage type it deals; a natural 20 doubles that shot's dice.
// Answers fill the panel as they arrive and the DM may set any result or total by hand. Like
// every action it asks for responses first; approving fires the rounds, spends the charges and
// applies the damage in one transaction.

import type { RecordEnvelope } from "@hearthtable/kernel";
import { criticalDice, type WeaponAttackInput } from "@hearthtable/play";
import {
  askRolls,
  type ActionRequest,
  type Poll,
  type RollAsk,
  type RollPrompt,
} from "@hearthtable/storage";
import { useState } from "react";
import { db } from "../firebase";
import type { WeaponRules } from "../play/firing";
import { commitPlan, PollControls, pollDone } from "./ResolvePanel";
import { planWeaponAttack } from "./resolveWeapon";
import type { Participant } from "./useTable";

type Result = "hit" | "miss";

export function WeaponPanel({
  campaign,
  request,
  attacker,
  definition,
  people,
  present,
  rolls,
  polls,
  actions,
  players,
  uid,
  clock,
  onDone,
}: {
  campaign: string;
  request: ActionRequest;
  attacker: Participant;
  definition: (id: string) => RecordEnvelope | undefined;
  people: ReadonlyMap<string, Participant>;
  present: readonly Participant[];
  rolls: readonly RollPrompt[];
  polls: readonly Poll[];
  actions: readonly ActionRequest[];
  players: readonly string[];
  uid: string;
  clock: number;
  onDone: (error?: string) => void;
}) {
  const input = request.input as unknown as WeaponAttackInput;
  const shots = input.shots;
  const [targets, setTargets] = useState<readonly (string | undefined)[]>(
    shots.map((s) => s.target ?? input.targets?.[0]),
  );
  const [results, setResults] = useState<Record<number, Result>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const rulesOf = (ref: string) =>
    definition(ref)?.data as WeaponRules | undefined;
  const nameOf = (ref: string | undefined) =>
    ref ? (rulesOf(ref)?.name ?? ref.split("/").at(-1)) : undefined;

  const mine = rolls.filter(
    (r) => r.action === request.id && r.status !== "cancelled",
  );
  const attackRoll = (i: number) =>
    mine.find((r) => r.target === `shot-${i}` && r.spec.kind === "attack");
  const damageRoll = (i: number, j: number) =>
    mine.find((r) => r.target === `shot-${i}-${j}` && r.spec.kind === "damage");
  const critical = (i: number) => attackRoll(i)?.answer?.natural === 20;
  const answered = (i: number): Result | undefined => {
    const a = attackRoll(i)?.answer;
    if (!a) return undefined;
    if (a.natural === 20) return "hit";
    if (a.natural === 1) return "miss";
    // Rechecked against the target's Armor Class now (a Shield may have come in).
    const t = targets[i];
    const ac = t ? people.get(t)?.ac : undefined;
    return ac !== undefined && a.total >= ac ? "hit" : "miss";
  };
  const resultOf = (i: number): Result => results[i] ?? answered(i) ?? "hit";
  const dice = (i: number, j: number) => {
    const d = shots[i]?.damage?.[j]?.dice ?? "";
    return critical(i) ? criticalDice(d) : d;
  };
  const amountOf = (i: number, j: number) =>
    typed[`${i}-${j}`] ?? String(damageRoll(i, j)?.answer?.total ?? "");

  const ask = (asks: RollAsk[], text: string) =>
    void askRolls(db, campaign, asks, uid, clock, text).then(
      (e) => e && setProblem(e),
    );
  const unaskedAttacks = shots.flatMap((_, i) =>
    targets[i] && !attackRoll(i) ? [i] : [],
  );
  const unaskedDamage = shots.flatMap((s, i) =>
    resultOf(i) === "hit"
      ? (s.damage ?? []).flatMap((_, j) => (damageRoll(i, j) ? [] : [[i, j]]))
      : [],
  );

  return (
    <div className="panel resolve-panel" aria-label="Resolve the request">
      <h3>Approve and resolve</h3>
      <p>
        {attacker.name}: {request.summary} · attack +{input.bonus}
        {input.precision && " with Advantage"}
        {input.note && <span className="muted"> ({input.note})</span>}
      </p>
      <ol className="plain-list">
        {shots.map((shot, i) => {
          const roll = attackRoll(i);
          return (
            <li key={i} className="chips">
              <span>
                {shots.length > 1 ? `Shot ${i + 1}` : "The attack"}
                {shot.round && `: ${nameOf(shot.round)}`}
              </span>
              <select
                aria-label={`Shot ${i + 1}: target`}
                value={targets[i] ?? ""}
                onChange={(e) =>
                  setTargets(
                    targets.map((t, k) =>
                      k === i ? e.target.value || undefined : t,
                    ),
                  )
                }
              >
                <option value="">no target</option>
                {present.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.name}
                  </option>
                ))}
              </select>
              {roll && (
                <span className="muted" data-testid={`shot-${i + 1}-roll`}>
                  {roll.answer
                    ? `rolled ${roll.answer.total}${critical(i) ? " (Critical Hit)" : ""}`
                    : "waiting for the roll"}
                </span>
              )}
              <select
                aria-label={`Shot ${i + 1}: result`}
                value={resultOf(i)}
                onChange={(e) =>
                  setResults({ ...results, [i]: e.target.value as Result })
                }
              >
                <option value="hit">hit</option>
                <option value="miss">miss</option>
              </select>
              {resultOf(i) === "hit" &&
                (shot.damage ?? []).map((part, j) => {
                  const r = damageRoll(i, j);
                  return (
                    <label key={j}>
                      {dice(i, j)} {part.type ?? ""}
                      {r && !r.answer && " (waiting)"}{" "}
                      <input
                        aria-label={`Shot ${i + 1}: ${part.type ?? "damage"} total`}
                        type="number"
                        value={amountOf(i, j)}
                        onChange={(e) =>
                          setTyped({ ...typed, [`${i}-${j}`]: e.target.value })
                        }
                        style={{ width: 70 }}
                      />
                    </label>
                  );
                })}
            </li>
          );
        })}
      </ol>
      <div className="chips">
        {unaskedAttacks.length > 0 && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              ask(
                unaskedAttacks.map((i) => {
                  const target = people.get(targets[i] as string);
                  return {
                    character: attacker.path,
                    purpose: `${input.name}${shots.length > 1 ? `, shot ${i + 1}` : ""} against ${target?.name ?? "the target"}`,
                    spec: {
                      kind: "attack",
                      bonus: input.bonus,
                      ...(target?.ac !== undefined
                        ? { target: target.ac }
                        : {}),
                      ...(input.precision
                        ? { edge: "advantage" as const }
                        : {}),
                    },
                    action: request.id,
                    target: `shot-${i}`,
                  };
                }),
                `The DM asked ${attacker.name} for attack rolls: ${input.name}.`,
              )
            }
          >
            Ask for the attack rolls
          </button>
        )}
        {unaskedDamage.length > 0 && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              ask(
                unaskedDamage.map(([i, j]) => {
                  const part = shots[i as number]?.damage?.[j as number];
                  return {
                    character: attacker.path,
                    purpose: `${input.name}${shots.length > 1 ? `, shot ${(i as number) + 1}` : ""}: ${part?.type ?? ""} damage${critical(i as number) ? " (Critical Hit)" : ""}`,
                    spec: {
                      kind: "damage",
                      dice: dice(i as number, j as number),
                    },
                    action: request.id,
                    target: `shot-${i}-${j}`,
                  };
                }),
                `The DM asked ${attacker.name} to roll damage: ${input.name}.`,
              )
            }
          >
            Ask for the damage rolls
          </button>
        )}
      </div>
      {problem && <div className="error-box">{problem}</div>}
      <div className="chips">
        <button
          type="button"
          disabled={busy}
          hidden={!pollDone(request, polls)}
          onClick={() => {
            setBusy(true);
            void (async () => {
              const plan = await planWeaponAttack({
                request,
                attacker,
                rulesOf,
                results: shots.map((s, i) => {
                  const person = targets[i]
                    ? people.get(targets[i])
                    : undefined;
                  return person
                    ? {
                        person,
                        result: resultOf(i),
                        amounts: (s.damage ?? []).map(
                          (_, j) => Number(amountOf(i, j)) || 0,
                        ),
                      }
                    : undefined;
                }),
              });
              if (typeof plan === "string") return plan;
              return commitPlan({
                campaign,
                request,
                plan,
                actor: attacker,
                people,
                polls,
                uid,
                clock,
              });
            })().then((err) => {
              setBusy(false);
              onDone(err);
            });
          }}
        >
          Approve and resolve
        </button>
        <PollControls
          campaign={campaign}
          request={request}
          polls={polls}
          actions={actions}
          players={players}
          busy={busy}
          uid={uid}
          clock={clock}
          onProblem={setProblem}
          event={() => {
            const hit = shots.flatMap((_, i) =>
              targets[i] && resultOf(i) === "hit"
                ? [people.get(targets[i] as string)?.name ?? ""]
                : [],
            );
            return `${input.name} would hit ${hit.join(", ") || "nobody"}`;
          }}
        />
        <button type="button" className="link-button" onClick={() => onDone()}>
          Back
        </button>
      </div>
    </div>
  );
}
