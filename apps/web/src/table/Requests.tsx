// Queued requests at the table (Milestone 5 S6; Spell Effects and Active State, "Competing
// submissions and request revisions"): every queued request in the order submitted (a revision
// keeps its place), with what it holds and whether it waits for its turn or is ready for the
// DM. The DM can reject one and its controller cancel it, either way returning its holds. When
// one is ready, the DM approves and resolves it (S7).

import type { RecordEnvelope } from "@hearthtable/kernel";
import {
  attack,
  describeHolds,
  weaponAttack,
  isEligible,
  TIMING_NAMES,
  type AttackInput,
  type Moment,
  type WeaponAttackInput,
} from "@hearthtable/play";
import { useState } from "react";
import {
  endAction,
  submitAction,
  type ActionRequest,
  type EncounterState,
  type Poll,
  type RollPrompt,
} from "@hearthtable/storage";
import { db } from "../firebase";
import type { Control } from "./EncounterPanel";
import { ResolvePanel } from "./ResolvePanel";
import { WeaponPanel } from "./WeaponPanel";
import { prepareAttack, type WeaponRules } from "../play/firing";
import type { Line } from "../sheet/drag";
import type { Participant } from "./useTable";

/** A weapon attack's ordinary shots resolve one by one; a special round like a spell. */
const shotByShot = (a: ActionRequest) => {
  if (a.kind !== "weapon-attack") return false;
  const first = (a.input as unknown as WeaponAttackInput).shots[0];
  return !first?.save && !first?.payload;
};

export function RequestsPanel({
  campaign,
  actions,
  people,
  encounter,
  clock,
  control,
  now,
  present,
  definition,
  rolls,
  polls,
  players,
  onProblem,
}: {
  campaign: string;
  actions: readonly ActionRequest[];
  people: ReadonlyMap<string, Participant>;
  encounter: EncounterState | undefined;
  clock: number;
  control: Control;
  now: Moment | undefined;
  /** Everyone in the scene, who can be targets. */
  present: readonly Participant[];
  definition: (id: string) => RecordEnvelope | undefined;
  /** Every roll; a request's own fill its resolve panel (S8). */
  rolls: readonly RollPrompt[];
  /** Response polls, and who must answer them: players with a character in the scene (S9). */
  polls: readonly Poll[];
  players: readonly string[];
  onProblem: (message: string) => void;
}) {
  const [resolving, setResolving] = useState<string | undefined>();
  const queued = actions.filter((a) => a.status === "queued");
  const { uid, isDm } = control;
  const name = (p: string) => people.get(p)?.name ?? p.split("/").at(-1) ?? p;
  const end = (a: ActionRequest, status: "cancelled" | "rejected") =>
    uid &&
    void endAction(
      db,
      campaign,
      a,
      status,
      uid,
      clock,
      status === "rejected"
        ? `The DM rejected ${name(a.character)}'s request: ${a.summary}.`
        : `${name(a.character)} cancelled a request: ${a.summary}.`,
    ).then((err) => err && onProblem(err));

  return (
    <section className="panel" aria-label="Requests">
      <h2>Requests</h2>
      {queued.length === 0 ? (
        <p className="muted">Nothing is queued.</p>
      ) : (
        <ol className="request-list">
          {queued.map((a) => (
            <li key={a.id}>
              <strong>{name(a.character)}</strong>: {a.summary}
              {a.respondsTo && (
                <span className="badge">
                  response to{" "}
                  {polls.find((p) => p.action === a.respondsTo)?.event ??
                    "an action"}
                </span>
              )}{" "}
              · {TIMING_NAMES[a.timing]}
              {a.revision > 1 && ` · revision ${a.revision}`} · holds{" "}
              {describeHolds(
                a.holds,
                (id) =>
                  people.get(a.character)?.lines.find((r) => r.line.id === id)
                    ?.name ?? id,
              )}{" "}
              <span className="badge">
                {isEligible(a.timing, a.character, encounter)
                  ? "ready for the DM"
                  : "waits for its turn"}
              </span>
              {typeof a.input["note"] === "string" && (
                <span className="muted"> ({a.input["note"]})</span>
              )}{" "}
              {isDm && isEligible(a.timing, a.character, encounter) && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setResolving(a.id)}
                >
                  resolve…
                </button>
              )}
              {isDm && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => end(a, "rejected")}
                >
                  reject
                </button>
              )}
              {control.controls(a.character) && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => end(a, "cancelled")}
                >
                  cancel
                </button>
              )}
              {resolving === a.id &&
                uid &&
                people.get(a.character) &&
                shotByShot(a) && (
                  <WeaponPanel
                    campaign={campaign}
                    request={a}
                    attacker={people.get(a.character) as Participant}
                    definition={definition}
                    people={people}
                    present={present}
                    rolls={rolls}
                    polls={polls}
                    actions={actions}
                    players={players}
                    uid={uid}
                    clock={clock}
                    onDone={(err) => {
                      setResolving(undefined);
                      if (err) onProblem(err);
                    }}
                  />
                )}
              {resolving === a.id &&
                uid &&
                people.get(a.character) &&
                !shotByShot(a) && (
                  <ResolvePanel
                    campaign={campaign}
                    request={a}
                    caster={people.get(a.character) as Participant}
                    definition={definition}
                    people={people}
                    present={present}
                    rolls={rolls}
                    polls={polls}
                    actions={actions}
                    players={players}
                    now={now}
                    uid={uid}
                    clock={clock}
                    onDone={(err) => {
                      setResolving(undefined);
                      if (err) onProblem(err);
                    }}
                  />
                )}
            </li>
          ))}
        </ol>
      )}
      {isDm && uid && present.some((p) => p.statActions.length > 0) && (
        <StatBlockAttack
          campaign={campaign}
          present={present}
          definition={definition}
          uid={uid}
          clock={clock}
          onProblem={onProblem}
        />
      )}
      {isDm && uid && (
        <MakeAttack
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

/**
 * The DM queues an NPC's stat-block attack (S10). An attack naming a weapon line uses that weapon
 * like a player's: a bow loads an arrow from the NPC's inventory as part of the shot. With nothing
 * to fire it only warns, and the DM may go ahead.
 */
function StatBlockAttack({
  campaign,
  present,
  definition,
  uid,
  clock,
  onProblem,
}: {
  campaign: string;
  present: readonly Participant[];
  definition: (id: string) => RecordEnvelope | undefined;
  uid: string;
  clock: number;
  onProblem: (message: string) => void;
}) {
  const npcs = present.filter((p) => p.statActions.length > 0);
  const [attacker, setAttacker] = useState(npcs[0]?.path ?? "");
  const who = npcs.find((p) => p.path === attacker) ?? npcs[0];
  const [actionId, setActionId] = useState("");
  const act =
    who?.statActions.find((a) => a.id === actionId) ?? who?.statActions[0];
  const [target, setTarget] = useState(present.find((p) => !p.npc)?.path ?? "");
  if (!who || !act) return null;
  const rulesOf = (ref: string) =>
    definition(ref)?.data as WeaponRules | undefined;
  const weaponRow = act.weapon
    ? who.lines.find((r) => r.line.id === act.weapon)
    : undefined;
  const mode = weaponRow
    ? rulesOf(weaponRow.line.ref)?.attacks?.[0]
    : undefined;
  const prepared = prepareAttack({
    lines: who.lines.map((r) => r.line as unknown as Line),
    held: Object.fromEntries(who.lines.map((r) => [r.line.id, r.held])),
    ...(weaponRow ? { weaponId: weaponRow.line.id } : {}),
    ...(mode ? { mode } : {}),
    rulesOf,
    target,
    fallback: act.damage ?? [],
    aimModifier: 0,
  });
  return (
    <form
      aria-label="Stat block attack"
      className="chips"
      onSubmit={(e) => {
        e.preventDefault();
        if (!target) return;
        const input: WeaponAttackInput = {
          name: `${who.name}: ${act.name}`,
          ...(weaponRow ? { weapon: weaponRow.line.id } : {}),
          ...(mode ? { mode: mode.id } : {}),
          shots: prepared.shots,
          bonus: act.bonus,
          consumes: prepared.holds,
          targets: [target],
          ...(act.rider ? { note: `on a hit, ${act.rider}` } : {}),
        };
        void submitAction(
          db,
          campaign,
          {
            kind: weaponAttack.id,
            character: who.path,
            timing: "instant",
            input: { ...input },
            holds: weaponAttack.holds(input),
            budget: "action",
            summary: weaponAttack.describe(input),
          },
          uid,
          clock,
          `The DM queued ${weaponAttack.describe(input)}.`,
        ).then((err) => err && onProblem(err));
      }}
    >
      <span>Stat block:</span>
      <select
        aria-label="NPC"
        value={who.path}
        onChange={(e) => {
          setAttacker(e.target.value);
          setActionId("");
        }}
      >
        {npcs.map((p) => (
          <option key={p.path} value={p.path}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        aria-label="NPC attack"
        value={act.id}
        onChange={(e) => setActionId(e.target.value)}
      >
        {who.statActions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} (+{a.bonus},{" "}
            {(a.damage ?? [])
              .map((d) => `${d.dice} ${d.type ?? ""}`)
              .join(" + ")}
            )
          </option>
        ))}
      </select>
      <span>at</span>
      <select
        aria-label="NPC target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        {present.map((p) => (
          <option key={p.path} value={p.path}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="submit" className="secondary">
        Queue {act.name}
      </button>
      {prepared.warnings.map((w) => (
        <span key={w} className="warn-text" role="status">
          {w}
        </span>
      ))}
    </form>
  );
}

/** The DM describes an attack, such as an NPC's, as a request (S9). */
function MakeAttack({
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
  const [attacker, setAttacker] = useState(present[0]?.path ?? "");
  const [target, setTarget] = useState(present[1]?.path ?? "");
  const [weapon, setWeapon] = useState("");
  const [bonus, setBonus] = useState("4");
  const [dice, setDice] = useState("1d6+2");
  const [type, setType] = useState("Slashing");
  const who = present.find((p) => p.path === attacker);
  return (
    <form
      aria-label="Make an attack"
      className="chips"
      onSubmit={(e) => {
        e.preventDefault();
        if (!who || !target) return;
        const input: AttackInput = {
          name: `${who.name}'s ${weapon.trim() || "attack"}`,
          bonus: Number(bonus) || 0,
          dice,
          ...(type.trim() ? { damageType: type.trim() } : {}),
          targets: [target],
        };
        void submitAction(
          db,
          campaign,
          {
            kind: attack.id,
            character: who.path,
            timing: "instant",
            input: { ...input },
            holds: {},
            budget: "action",
            summary: attack.describe(input),
          },
          uid,
          clock,
          `The DM queued ${attack.describe(input)}.`,
        ).then((err) => err && onProblem(err));
      }}
    >
      <span>Make an attack:</span>
      <select
        aria-label="Attacker"
        value={attacker}
        onChange={(e) => setAttacker(e.target.value)}
      >
        {present.map((p) => (
          <option key={p.path} value={p.path}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        aria-label="Weapon"
        placeholder="weapon"
        value={weapon}
        onChange={(e) => setWeapon(e.target.value)}
        style={{ width: 110 }}
      />
      <label>
        +
        <input
          aria-label="Attack bonus"
          type="number"
          value={bonus}
          onChange={(e) => setBonus(e.target.value)}
          style={{ width: 55 }}
        />
      </label>
      <input
        aria-label="Damage dice"
        value={dice}
        onChange={(e) => setDice(e.target.value)}
        style={{ width: 80 }}
      />
      <input
        aria-label="Damage type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{ width: 90 }}
      />
      <span>at</span>
      <select
        aria-label="Target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        {present.map((p) => (
          <option key={p.path} value={p.path}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="submit" className="secondary">
        Queue the attack
      </button>
    </form>
  );
}
