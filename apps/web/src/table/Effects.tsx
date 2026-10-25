// Active effects at the table (Milestone 5 S4): each participant's effects with the time left;
// the DM can end one early. While the DM's view is open, it clears effects whose time is up from
// their characters and logs each ending once (they already stopped counting at that moment).

import { remaining, type Moment } from "@hearthtable/play";
import { endEffects } from "@hearthtable/storage";
import { useEffect, useRef } from "react";
import { db, repository } from "../firebase";
import type { Participant } from "./useTable";

export function EffectChips({
  person,
  now,
  onEnd,
}: {
  person: Participant;
  now: Moment | undefined;
  /** Given to the DM: ends an effect early. */
  onEnd?: (effect: { id: string; name: string }) => void;
}) {
  const active = person.effects.filter((e) => e.status === "active");
  if (active.length === 0) return null;
  return (
    <div className="chips effect-chips" aria-label={`${person.name}'s effects`}>
      {active.map((e) => (
        <span key={e.id} className="chip">
          {e.name}
          {e.endsAt && now ? ` · ${remaining(e.endsAt, now)}` : ""}
          {onEnd && (
            <button
              type="button"
              className="link-button"
              aria-label={`End ${e.name} on ${person.name}`}
              onClick={() => onEnd({ id: e.id, name: e.name })}
            >
              end
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

/** On the DM's view: clears effects whose time is up, once each. */
export function useClearEndedEffects(
  enabled: boolean,
  campaign: string,
  people: ReadonlyMap<string, Participant> | undefined,
  uid: string | undefined,
  clock: number | undefined,
  onProblem: (message: string) => void,
) {
  const clearing = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled || !people || !uid || clock === undefined) return;
    for (const person of people.values()) {
      const ended = person.effects.filter(
        (e) => e.status === "ended" && !clearing.current.has(e.id),
      );
      if (ended.length === 0) continue;
      for (const e of ended) clearing.current.add(e.id);
      void endEffects(
        db,
        repository,
        campaign,
        person.path,
        person.name,
        ended.map((e) => ({ id: e.id, name: e.name })),
        "expired",
        uid,
        clock,
      ).then((err) => {
        // A refused save (someone else saved the character first) is tried again on the
        // next change; only other problems are shown.
        if (!err) return;
        for (const e of ended) clearing.current.delete(e.id);
        if (!/conflict|revision|precondition/i.test(err)) onProblem(err);
      });
    }
  }, [enabled, campaign, people, uid, clock, onProblem]);
}
