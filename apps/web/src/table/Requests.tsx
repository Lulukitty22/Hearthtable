// Queued requests at the table (Milestone 5 S6; Spell Effects and Active State, "Competing
// submissions and request revisions"): every queued request in the order submitted (a revision
// keeps its place), with what it holds and whether it waits for its turn or is ready for the
// DM. The DM can reject one and its controller cancel it, either way returning its holds. When
// one is ready, the DM approves and resolves it (S7).

import type { RecordEnvelope } from "@hearthtable/kernel";
import {
  describeHolds,
  isEligible,
  TIMING_NAMES,
  type Moment,
} from "@hearthtable/play";
import { useState } from "react";
import {
  endAction,
  type ActionRequest,
  type EncounterState,
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
              <strong>{name(a.character)}</strong>: {a.summary} ·{" "}
              {TIMING_NAMES[a.timing]}
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
    </section>
  );
}
