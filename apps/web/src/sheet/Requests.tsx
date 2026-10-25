// Casting from the sheet (Milestone 5 S6; Spell Effects and Active State, "Casting workflow").
// Reviewing shows the spell's source, cast level, timing, its costs and the caster's current
// numbers; nothing is spent. Confirming queues a request that holds the costs at once. The
// character's queued requests are listed with what they hold, whether they wait for a turn or
// are ready for the DM, and buttons to revise (in place, keeping their place) or cancel.

import {
  BUDGET_NAMES,
  castSpell,
  describeHolds,
  isEligible,
  TIMING_NAMES,
  type CastInput,
  type Timing,
} from "@hearthtable/play";
import {
  endAction,
  reviseAction,
  submitAction,
  type ActionRequest,
} from "@hearthtable/storage";
import type { SlotLevel } from "@hearthtable/system-spellcasting";
import { useState } from "react";
import { db } from "../firebase";
import { known, type SheetPlay, type TabProps } from "./shared";

interface Profile {
  readonly id: string;
  readonly name: string;
  readonly attack: { readonly kind: string; readonly value?: number };
  readonly dc: { readonly kind: string; readonly value?: number };
}

function slotsNow(props: TabProps): Record<string, number> {
  const slots =
    known(props.resolved.get<readonly SlotLevel[]>("spellcasting.slots")) ?? [];
  return Object.fromEntries(
    slots.map((s) => [
      String(s.level),
      s.available.kind === "known" ? s.available.value : 0,
    ]),
  );
}

const nameOf = (props: TabProps) =>
  String(
    (props.records.get(props.characterId)?.data as { name?: unknown })?.name ??
      "",
  );

export function CastReview({
  props,
  play,
  spell,
  bookTitle,
  request,
  onDone,
}: {
  props: TabProps;
  play: SheetPlay;
  spell: string;
  bookTitle: string;
  /** Revising this queued request instead of making a new one. */
  request?: ActionRequest;
  onDone: () => void;
}) {
  const data = props.records.get(spell)?.data as
    | {
        name?: string;
        level?: number;
        castingTime?: string;
        classes?: readonly string[];
      }
    | undefined;
  const level = data?.level ?? 0;
  const before = request?.input as Partial<CastInput> | undefined;
  const slots = slotsNow(props);
  // While revising, this request's own held slots count as free again.
  const usable = request
    ? Object.fromEntries(
        Object.entries(slots).map(([l, n]) => [
          l,
          n + ((request.holds.slots ?? {})[l] ?? 0),
        ]),
      )
    : slots;
  const levels = Object.keys(usable)
    .map(Number)
    .filter((l) => l >= level)
    .sort((a, b) => a - b);
  const castingTime = data?.castingTime ?? "Action";
  const defaultTiming: Timing =
    play.encounter && !castingTime.toLowerCase().startsWith("reaction")
      ? "next-turn"
      : "instant";
  const [castLevel, setCastLevel] = useState(
    before?.castLevel ?? (level === 0 ? 0 : (levels[0] ?? level)),
  );
  const [timing, setTiming] = useState<Timing>(
    request?.timing ?? defaultTiming,
  );
  const [note, setNote] = useState(before?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const input: CastInput = {
    spell,
    name: data?.name ?? spell,
    level,
    castLevel,
    castingTime,
    source: { kind: "book", title: bookTitle },
    ...(note.trim() ? { note: note.trim() } : {}),
  };
  const holds = castSpell.holds(input);
  const budget = castSpell.budget(input);
  const who = nameOf(props);
  const warnings = castSpell.warnings(input, {
    name: who,
    slots: usable,
    lines: {},
  });
  const profiles =
    known(props.resolved.get<readonly Profile[]>("spellcasting.profiles")) ??
    [];
  const caster =
    profiles.find((p) => data?.classes?.includes(p.id)) ?? profiles[0];

  return (
    <form
      className="panel cast-review"
      aria-label={`Cast ${input.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        const draft = {
          timing,
          input: { ...input },
          holds,
          ...(budget ? { budget } : {}),
          summary: castSpell.describe(input),
        };
        const done = request
          ? reviseAction(
              db,
              play.campaign,
              request,
              draft,
              play.uid,
              play.clock,
              `${who} revised a request: ${draft.summary} (${TIMING_NAMES[timing]}).`,
            )
          : submitAction(
              db,
              play.campaign,
              { ...draft, kind: castSpell.id, character: props.characterId },
              play.uid,
              play.clock,
              `${who} queued a request: ${draft.summary} (${TIMING_NAMES[timing]}).`,
            );
        void done.then((err) => {
          setBusy(false);
          setError(err);
          if (!err) onDone();
        });
      }}
    >
      <h3>{request ? "Revise the request" : "Review"}</h3>
      <p>
        {input.name} from {bookTitle}
        {caster &&
          ` · ${caster.name}: spell save DC ${caster.dc.value ?? "?"}, attack +${caster.attack.value ?? "?"} (current numbers)`}
      </p>
      {level > 0 && (
        <label>
          Cast at level{" "}
          <select
            aria-label="Cast level"
            value={castLevel}
            onChange={(e) => setCastLevel(Number(e.target.value))}
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {l} ({usable[String(l)] ?? 0} left)
              </option>
            ))}
          </select>
        </label>
      )}{" "}
      <span className="chips" role="radiogroup" aria-label="Timing">
        {(play.encounter
          ? (["instant", "next-turn"] as const)
          : (["instant"] as const)
        ).map((t) => (
          <label key={t}>
            <input
              type="radio"
              name="timing"
              checked={timing === t}
              onChange={() => setTiming(t)}
            />{" "}
            {TIMING_NAMES[t]}
          </label>
        ))}
      </span>
      <div>
        <input
          aria-label="Targets or notes"
          placeholder="Targets, or anything the DM should know"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <p className="muted">
        Holds {describeHolds(holds)}
        {budget ? `; uses ${BUDGET_NAMES[budget]}` : ""}. Nothing is spent until
        the DM approves it.
      </p>
      {warnings.map((w) => (
        <p key={w} className="warn-text" role="status">
          {w} The DM decides.
        </p>
      ))}
      <div className="chips">
        <button type="submit" disabled={busy}>
          {request ? "Save the revision" : "Confirm"}
        </button>
        <button type="button" className="link-button" onClick={onDone}>
          Back
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
    </form>
  );
}

/** The character's queued requests, with revising and cancelling. */
export function SheetRequests({ props }: { props: TabProps }) {
  const play = props.play;
  const [revising, setRevising] = useState<string | undefined>();
  if (!play || play.requests.length === 0) return null;
  const who = nameOf(props);
  return (
    <section className="panel" aria-label="Requests">
      <h2>Requests</h2>
      <ul className="plain-list">
        {play.requests.map((r) => {
          const input = r.input as Partial<CastInput>;
          return (
            <li key={r.id}>
              {r.summary} · {TIMING_NAMES[r.timing]}
              {r.revision > 1 && ` · revision ${r.revision}`} · holds{" "}
              {describeHolds(r.holds)}{" "}
              <span className="badge">
                {isEligible(r.timing, r.character, play.encounter)
                  ? "ready for the DM"
                  : "waits for its turn"}
              </span>{" "}
              {r.kind === castSpell.id && input.spell && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setRevising(r.id)}
                >
                  revise
                </button>
              )}
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  void endAction(
                    db,
                    play.campaign,
                    r,
                    "cancelled",
                    play.uid,
                    play.clock,
                    `${who} cancelled a request: ${r.summary}.`,
                  )
                }
              >
                cancel
              </button>
              {revising === r.id && input.spell && (
                <CastReview
                  props={props}
                  play={play}
                  spell={input.spell}
                  bookTitle={
                    input.source?.kind === "book" ? input.source.title : ""
                  }
                  request={r}
                  onDone={() => setRevising(undefined)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
