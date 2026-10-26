// Queued requests at the table (Milestone 5 S6; Spell Effects and Active State, "Competing
// submissions and request revisions"): every queued request in the order submitted (a revision
// keeps its place), with what it holds and whether it waits for its turn or is ready for the
// DM. The DM can reject one and its controller cancel it, either way returning its holds. When
// one is ready, the DM approves and resolves it (S7).

import type { RecordEnvelope } from "@hearthtable/kernel";
import {
  attack,
  describeHolds,
  isEligible,
  TIMING_NAMES,
  type AttackInput,
  type Moment,
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
import type { Participant } from "./useTable";

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
              {describeHolds(a.holds)}{" "}
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
              {resolving === a.id && uid && people.get(a.character) && (
                <ResolvePanel
                  campaign={campaign}
                  request={a}
                  caster={people.get(a.character) as Participant}
                  spell={
                    definition(String(a.input["spell"]))?.data as
                      Record<string, unknown> | undefined
                  }
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
