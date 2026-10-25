// Queued requests at the table (Milestone 5 S6; Spell Effects and Active State, "Competing
// submissions and request revisions"): every queued request in the order submitted (a revision
// keeps its place), with what it holds and whether it waits for its turn or is ready for the
// DM. The DM can reject one and its controller cancel it, either way returning its holds.
// Approving and resolving come next (S7).

import { describeHolds, isEligible, TIMING_NAMES } from "@hearthtable/play";
import {
  endAction,
  type ActionRequest,
  type EncounterState,
} from "@hearthtable/storage";
import { db } from "../firebase";
import type { Control } from "./EncounterPanel";
import type { Participant } from "./useTable";

export function RequestsPanel({
  campaign,
  actions,
  people,
  encounter,
  clock,
  control,
  onProblem,
}: {
  campaign: string;
  actions: readonly ActionRequest[];
  people: ReadonlyMap<string, Participant>;
  encounter: EncounterState | undefined;
  clock: number;
  control: Control;
  onProblem: (message: string) => void;
}) {
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
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
