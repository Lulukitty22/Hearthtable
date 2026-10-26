// Response polls at the table (Milestone 5 S9; Spell Effects and Active State, "Scheduling and
// repeating response polls" and "Every action polls; who skips; force-skip"). Each open poll shows
// the event it pauses, its round and who has skipped this round. A player who must answer either
// responds (an Instant request, such as Shield, made on their sheet as a response) or skips; a
// skip counts only for the current round. While the DM's view is open, a poll closes as soon as
// every player has skipped its current round.

import { everyoneSkipped } from "@hearthtable/play";
import { closePoll, skipPoll, type Poll } from "@hearthtable/storage";
import { useEffect, useRef } from "react";
import { db } from "../firebase";

export function PollsPanel({
  campaign,
  polls,
  uid,
  name,
  onProblem,
}: {
  campaign: string;
  polls: readonly Poll[];
  uid: string | undefined;
  /** A member's Alias. */
  name: (uid: string) => string;
  onProblem: (message: string) => void;
}) {
  const open = polls.filter((p) => p.status === "open");
  if (open.length === 0) return null;
  return (
    <section className="panel" aria-label="Responses">
      <h2>Responses</h2>
      <ul className="plain-list">
        {open.map((p) => {
          const skipped = p.players.filter((u) => p.skips[u] === p.round);
          const mustAnswer = !!uid && p.players.includes(uid);
          return (
            <li key={p.action} className="poll">
              <strong>{p.event}</strong>{" "}
              <span className="muted">
                round {p.round}; passed:{" "}
                {skipped.map(name).join(", ") || "nobody yet"}
              </span>{" "}
              {mustAnswer && p.skips[uid] !== p.round && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    void skipPoll(db, campaign, p, uid).then(
                      (e) => e && onProblem(e),
                    )
                  }
                >
                  Pass
                </button>
              )}
              {mustAnswer && p.skips[uid] !== p.round && (
                <span className="muted">
                  {" "}
                  or respond from your sheet with an Instant request
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** On the DM's view: closes a poll once every player has skipped its current round. */
export function useClosePolls(
  enabled: boolean,
  campaign: string,
  polls: readonly Poll[],
  uid: string | undefined,
  clock: number,
  onProblem: (message: string) => void,
) {
  const closing = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled || !uid) return;
    for (const p of polls) {
      const key = `${p.action}:${p.round}`;
      if (p.status !== "open" || closing.current.has(key)) continue;
      if (!everyoneSkipped(p.round, p.skips, p.players)) continue;
      closing.current.add(key);
      void closePoll(db, campaign, p, false, [], uid, clock).then(
        (e) => e && onProblem(e),
      );
    }
  }, [enabled, campaign, polls, uid, clock, onProblem]);
}
