// The DM approves a request at its eligible moment and resolves it (Milestone 5 S7; Spell Effects
// and Active State, "Casting workflow"). The panel shows the request, its targets (the player's
// picks, which the DM can change), and for attack and save spells a tick per target, hit or
// saved, until S8's roll prompts. Damage or healing is rolled from the caster's current formula
// (bonuses such as Empowered Evocation included) and the DM can type a different total. "Approve
// and resolve" writes everything at once with the request.

import { cryptoRandom, parseDice, roll } from "@hearthtable/kernel";
import type { CastInput, Moment } from "@hearthtable/play";
import { resolveAction, type ActionRequest } from "@hearthtable/storage";
import { useState } from "react";
import { db } from "../firebase";
import { snapshotFrom } from "../sheet/scribe";
import { planCast, spellShape, type TargetResult } from "./resolveSpell";
import type { Participant } from "./useTable";

/** Rolls a snapshot formula: its dice plus every bonus that applies without a choice. */
function rollFormula(
  dice: string,
  bonuses: readonly { readonly value: number; readonly when?: unknown }[],
) {
  const parsed = parseDice(dice);
  const plain = bonuses.filter((b) => !b.when);
  const add = plain.reduce((n, b) => n + b.value, 0);
  if (!parsed.ok) return { total: add, text: `${dice} (cannot roll)` };
  const r = roll(parsed.value, cryptoRandom);
  const faces = r.terms.flatMap((t) => t.faces);
  return {
    total: r.total + add,
    text: `${dice} (${faces.join(", ")})${plain.map((b) => ` + ${b.value}`).join("")} = ${r.total + add}`,
  };
}

export function ResolvePanel({
  campaign,
  request,
  caster,
  spell,
  people,
  present,
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
  const [results, setResults] = useState<Record<string, TargetResult>>({});
  const [rolled] = useState(() =>
    formula ? rollFormula(formula.dice, formula.bonuses) : undefined,
  );
  const [amount, setAmount] = useState(String(rolled?.total ?? 0));
  const [busy, setBusy] = useState(false);
  const defaultResult: TargetResult = shape.attack
    ? "hit"
    : shape.save
      ? "failed"
      : "affected";
  const resultOf = (p: string) => results[p] ?? defaultResult;

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
        {present.map((p) => (
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
            )}
          </div>
        ))}
      </fieldset>
      {(shape.damages || shape.heals) && formula && (
        <p>
          {shape.heals ? "Healing" : "Damage"}: {rolled?.text}{" "}
          <label>
            total{" "}
            <input
              aria-label="Total"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: 80 }}
            />
          </label>
        </p>
      )}
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
              setBusy(false);
              onDone(err);
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
