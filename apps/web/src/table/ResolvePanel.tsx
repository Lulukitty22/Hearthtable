// The DM approves a request at its eligible moment and resolves it (Milestone 5 S7 and S8; Spell
// Effects and Active State, "Casting workflow" and "Who rolls in a cast; critical hits"). The
// panel shows the request and its targets (the player's picks, which the DM can change). For a
// save spell the DM asks each target's player for their save; for an attack spell the caster's
// player rolls an attack against each target's Armor Class; damage or healing is the caster's
// player's roll, with the dice doubled after a Critical Hit. Answers fill the panel as they
// arrive; the DM can roll for anyone from the Rolls panel, or set a result or total by hand.
// "Approve and resolve" writes everything at once with the request, then asks anyone who took
// damage while concentrating for their concentration check.
//
// Every action first asks for responses (S9): once its rolls are known the DM opens its poll,
// players in the scene respond with Instant requests or skip, each response is resolved and a
// fresh round opens, and only when the poll closes can the action resolve. Hits are rechecked
// against each target's current Armor Class, so a Shield that came in between counts. A response
// itself does not poll; resolving it reopens its action's poll.
//
// The same panel resolves using an item (S10: a potion's healing, rolled by its user's player),
// casting from a loose scroll (its stored snapshot, not the caster's current numbers), and a
// weapon's single special round: HE-FRAG's area save against its fixed DC, or a Spellround's
// payload cast from its scroll with the weapon's aim. Firing the round and spending its charges
// happen in the same transaction. Ordinary shots resolve in the weapon panel.

import type { RecordEnvelope } from "@hearthtable/kernel";
import type {
  AttackInput,
  CastInput,
  Moment,
  RollSpec,
  UseItemInput,
  WeaponAttackInput,
} from "@hearthtable/play";
import { criticalDice } from "@hearthtable/play";
import {
  askRolls,
  closePoll,
  openPoll,
  repoll,
  resolveAction,
  type ActionRequest,
  type Poll,
  type RollAsk,
  type RollPrompt,
} from "@hearthtable/storage";
import type { ScrollSnapshot, ScrollView } from "@hearthtable/system-scrolls";
import { useState } from "react";
import { db } from "../firebase";
import type { WeaponRules } from "../play/firing";
import { snapshotFrom } from "../sheet/scribe";
import {
  Ledger,
  planCast,
  spellShape,
  type Plan,
  type TargetResult,
} from "./resolveSpell";
import { planWeaponAttack } from "./resolveWeapon";
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

/**
 * Writes an approved plan with its request, then asks anyone damaged while concentrating for
 * their check, and reopens the poll of the action a response answered.
 */
export async function commitPlan(o: {
  campaign: string;
  request: ActionRequest;
  plan: Plan;
  actor: Participant;
  people: ReadonlyMap<string, Participant>;
  polls: readonly Poll[];
  uid: string;
  clock: number;
}): Promise<string | undefined> {
  const err = await resolveAction(
    db,
    o.campaign,
    o.request,
    o.plan,
    o.uid,
    o.clock,
  );
  if (err) return err;
  const checks = o.plan.damaged.flatMap((d) => {
    const p = o.people.get(d.path);
    const held = p && known<readonly unknown[]>(p, "concentration.maintained");
    return p && held?.length ? [concentrationCheck(p, d.amount)] : [];
  });
  const asked = checks.length
    ? await askRolls(
        db,
        o.campaign,
        checks,
        o.uid,
        o.clock,
        "The DM asked for concentration checks.",
      )
    : undefined;
  // A resolved response reopens the poll of the action it answered.
  const parentPoll = o.request.respondsTo
    ? o.polls.find((p) => p.action === o.request.respondsTo)
    : undefined;
  const again =
    parentPoll && parentPoll.status === "open"
      ? await repoll(
          db,
          o.campaign,
          parentPoll,
          `${parentPoll.event.split(" (after")[0]} (after ${o.actor.name}: ${o.request.summary})`,
          o.uid,
          o.clock,
        )
      : undefined;
  return asked ?? again;
}

/** Opening an action's response poll, its state while open, and force-skipping it (S9). */
export function PollControls({
  campaign,
  request,
  polls,
  actions,
  players,
  event,
  busy,
  uid,
  clock,
  onProblem,
}: {
  campaign: string;
  request: ActionRequest;
  polls: readonly Poll[];
  actions: readonly ActionRequest[];
  players: readonly string[];
  /** What the poll asks responses to, worked out when it opens. */
  event: () => string;
  busy: boolean;
  uid: string;
  clock: number;
  onProblem: (message: string) => void;
}) {
  const poll = polls.find((p) => p.action === request.id);
  if (request.respondsTo) return null;
  if (!poll)
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void openPoll(
            db,
            campaign,
            request.id,
            event(),
            players,
            uid,
            clock,
          ).then((e) => e && onProblem(e))
        }
      >
        Ask for responses
      </button>
    );
  if (poll.status !== "open") return null;
  return (
    <>
      <span className="muted" data-testid="poll-state">
        Waiting for responses (round {poll.round})
      </span>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          void closePoll(
            db,
            campaign,
            poll,
            true,
            actions.filter(
              (a) => a.status === "queued" && a.respondsTo === request.id,
            ),
            uid,
            clock,
          ).then((e) => e && onProblem(e))
        }
      >
        Force-skip
      </button>
    </>
  );
}

/** Whether an action may resolve: a response at once, anything else once its poll closed. */
export const pollDone = (request: ActionRequest, polls: readonly Poll[]) =>
  !!request.respondsTo ||
  polls.find((p) => p.action === request.id)?.status === "closed";

export function ResolvePanel({
  campaign,
  request,
  caster,
  definition,
  people,
  present,
  rolls,
  polls,
  actions,
  players,
  now,
  uid,
  clock,
  onDone,
}: {
  campaign: string;
  request: ActionRequest;
  caster: Participant;
  /** Definitions by id: the spell cast, the item used or the round fired. */
  definition: (id: string) => RecordEnvelope | undefined;
  people: ReadonlyMap<string, Participant>;
  /** Who can be a target: everyone in the scene. */
  present: readonly Participant[];
  /** Every roll in the campaign; those of this request fill the panel. */
  rolls: readonly RollPrompt[];
  /** Response polls (S9). */
  polls: readonly Poll[];
  /** Every request, for responses still waiting when a poll is force-skipped. */
  actions: readonly ActionRequest[];
  /** Who must answer this action's poll: players controlling a character in the scene. */
  players: readonly string[];
  now: Moment | undefined;
  uid: string;
  clock: number;
  onDone: (error?: string) => void;
}) {
  const input = request.input as unknown as CastInput & {
    targets?: readonly string[];
  };
  // An attack described at the table (S9) resolves like an attack spell with its own numbers.
  const attackInput =
    request.kind === "attack"
      ? (request.input as unknown as AttackInput)
      : undefined;
  const itemInput =
    request.kind === "use-item"
      ? (request.input as unknown as UseItemInput)
      : undefined;
  // A weapon's special round: HE-FRAG's save, or a Spellround's payload (S10).
  const weaponInput =
    request.kind === "weapon-attack"
      ? (request.input as unknown as WeaponAttackInput)
      : undefined;
  const special = weaponInput?.shots[0];
  const scrollOf = (lineId: string | undefined) =>
    lineId === undefined
      ? undefined
      : known<readonly ScrollView[]>(caster, "scrolls.list")?.find(
          (x) => x.id === lineId,
        );
  const scroll =
    scrollOf(special?.payload) ??
    (input.source?.kind === "scroll"
      ? scrollOf(input.source.lineId)
      : undefined);
  const spellRef = weaponInput ? scroll?.spell : input.spell;
  const spell = spellRef
    ? (definition(spellRef)?.data as Record<string, unknown> | undefined)
    : undefined;
  const effectData: Record<string, unknown> | undefined = attackInput
    ? {
        name: attackInput.name,
        effect: {
          attack: "melee",
          damage: [
            {
              dice: attackInput.dice,
              ...(attackInput.damageType
                ? { type: attackInput.damageType }
                : {}),
            },
          ],
        },
      }
    : itemInput
      ? { name: itemInput.name, effect: { healing: itemInput.healing } }
      : special?.save
        ? {
            name: weaponInput?.name,
            effect: {
              save: special.save,
              damage: (special.damage ?? []).map((d) => ({ type: d.type })),
            },
          }
        : spell;
  const shape = spellShape(effectData as Parameters<typeof spellShape>[0]);
  // A scroll carries its scribe's numbers; a book cast uses the caster's current ones.
  const snapshot = scroll?.snapshot
    ? (scroll.snapshot as unknown as ScrollSnapshot)
    : spell && !attackInput && !itemInput
      ? snapshotFrom(caster.resolved, spell, input.castLevel)
      : undefined;
  const fixed = (dice: string | undefined) =>
    dice
      ? { dice, bonuses: [] as { value: number; when?: unknown }[] }
      : undefined;
  const formula = attackInput
    ? fixed(attackInput.dice)
    : itemInput
      ? fixed(itemInput.healing)
      : special?.save
        ? fixed(special.damage?.[0]?.dice)
        : snapshot?.formulas[0];
  const saveDC = special?.save?.dc ?? snapshot?.spellSaveDC;
  // A Spellround's attack uses the weapon's aim, not the scribe's spell attack.
  const attackBonus = attackInput
    ? attackInput.bonus
    : weaponInput
      ? weaponInput.bonus
      : snapshot?.spellAttackBonus;
  const what = attackInput
    ? attackInput.name
    : itemInput
      ? itemInput.name
      : weaponInput
        ? `${weaponInput.name}${spell ? ` (${String(spell["name"])})` : ""}`
        : input.name;
  const rulesOf = (ref: string) =>
    definition(ref)?.data as WeaponRules | undefined;
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
  const critical = mine.some(
    (r) => r.spec.kind === "attack" && r.answer?.natural === 20,
  );
  const answered = (target: string): TargetResult | undefined => {
    const prompt = promptFor(target);
    const a = prompt?.answer;
    if (!a) return undefined;
    // An attack is rechecked against the target's Armor Class now (a Shield may have come in).
    if (prompt.spec.kind === "attack") {
      if (a.natural === 20) return "hit";
      if (a.natural === 1) return "miss";
      const ac = people.get(target)?.ac;
      return ac !== undefined && a.total >= ac ? "hit" : "miss";
    }
    const o = a.outcome;
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
      {(saveDC !== undefined || attackBonus !== undefined) &&
        (shape.save || shape.attack) && (
          <p className="muted">
            {shape.save
              ? `Save DC ${saveDC ?? "?"}`
              : `Attack +${attackBonus ?? "?"}`}{" "}
            (
            {scroll
              ? "stored on the scroll"
              : special?.save
                ? "the round's"
                : "current numbers"}
            )
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
        {shape.save && unasked.length > 0 && saveDC !== undefined && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const ability = shape.save?.ability ?? "dex";
              const dc = saveDC;
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
                      purpose: `${ABILITY[ability]} save against ${what}`,
                      spec,
                      action: request.id,
                      target: t,
                    },
                  ];
                }),
                `The DM asked for ${ABILITY[ability]} saves against ${what} (DC ${dc}).`,
              );
            }}
          >
            Ask for saves
          </button>
        )}
        {shape.attack && unasked.length > 0 && attackBonus !== undefined && (
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
                      purpose:
                        attackInput || weaponInput
                          ? `${what} against ${p.name}`
                          : `Spell attack with ${input.name} against ${p.name}`,
                      spec: {
                        kind: "attack",
                        ...(snapshot?.casterClass && !scroll && !weaponInput
                          ? {
                              key: `spellcasting.classes.${snapshot.casterClass}.attack`,
                            }
                          : {}),
                        bonus: attackBonus,
                        ...(p.ac !== undefined ? { target: p.ac } : {}),
                      },
                      action: request.id,
                      target: t,
                    },
                  ];
                }),
                `The DM asked ${caster.name} for an attack roll: ${what}.`,
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
                    purpose: `${what} ${shape.heals ? "healing" : "damage"}${critical ? " (Critical Hit)" : ""}`,
                    spec: { kind: "damage", dice: damageDice },
                    action: request.id,
                  },
                ],
                `The DM asked ${caster.name} to roll ${what}'s ${shape.heals ? "healing" : "damage"}.`,
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
            void (async () => {
              // Firing the round and spending its charges come first, in the same ledger.
              const ledger = new Ledger();
              const fired = weaponInput
                ? await planWeaponAttack({
                    request,
                    attacker: caster,
                    rulesOf,
                    results: [],
                    ledger,
                  })
                : undefined;
              if (typeof fired === "string") return fired;
              const plan = await planCast({
                request,
                caster,
                spell: (effectData ?? {}) as Parameters<
                  typeof planCast
                >[0]["spell"],
                spellSaveDC: saveDC,
                targets: targets.flatMap((t) => {
                  const person = people.get(t);
                  return person ? [{ person, result: resultOf(t) }] : [];
                }),
                amount: Number(amount) || 0,
                now,
                people,
                ledger,
                consume: !weaponInput,
                ...(weaponInput
                  ? {
                      as: {
                        spell: spellRef ?? special?.round ?? "",
                        name: what,
                      },
                    }
                  : {}),
              });
              if (typeof plan === "string") return plan;
              return commitPlan({
                campaign,
                request,
                plan: fired
                  ? { ...plan, logs: [...plan.logs, ...fired.logs.slice(1)] }
                  : plan,
                actor: caster,
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
          hidden={!pollDone(request, polls)}
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
            const hits = targets.filter((t) => resultOf(t) !== "miss");
            return shape.attack
              ? `${what} would hit ${hits.map((t) => people.get(t)?.name ?? t).join(", ") || "nobody"}`
              : `${caster.name}: ${request.summary}`;
          }}
        />
        <button type="button" className="link-button" onClick={() => onDone()}>
          Back
        </button>
      </div>
    </div>
  );
}
