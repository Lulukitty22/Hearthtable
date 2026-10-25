// Exact moments for effects (Spell Effects and Active State, "Exact timing within a round",
// selected 2026-10-25). A moment is the clock in whole seconds plus a step within that second's
// round: during an encounter every turn that starts and every action or reaction is one step of
// 1/40 second, and each round starts six seconds after the last whatever its steps. Outside an
// encounter the step is past every step of the second, so a fight's 1-round effects are over
// once it ends. Effects last exactly their duration from the moment they began.

import { SECONDS_PER_ROUND } from "./clock";

/** Steps in one second of encounter time (1/40 s each; 240 in a round). */
export const STEPS_PER_SECOND = 40;
export const STEPS_PER_ROUND = 6 * STEPS_PER_SECOND;

export interface Moment {
  /** The game clock, in whole seconds. */
  readonly clock: number;
  /** Steps since that second began. */
  readonly step: number;
}

/** A moment past every step of its second (outside an encounter). */
export const LATE = STEPS_PER_ROUND;

/** Negative when `a` is before `b`, 0 when equal, positive when after. */
export function compareMoments(a: Moment, b: Moment): number {
  return a.clock - b.clock || a.step - b.step;
}

/** The moment `seconds` after `m`. */
export function after(m: Moment, seconds: number): Moment {
  return { clock: m.clock + seconds, step: m.step };
}

/** Whether something that ends at `end` is over at `now`. */
export function isOver(end: Moment | undefined, now: Moment | undefined) {
  return !!end && !!now && compareMoments(now, end) >= 0;
}

export interface SpellDuration {
  /** How long it lasts, or undefined when it lasts until ended (or is instantaneous). */
  readonly seconds?: number;
  readonly concentration: boolean;
  readonly instantaneous: boolean;
}

const UNITS: Readonly<Record<string, number>> = {
  round: 6,
  minute: 60,
  hour: 3600,
  day: 86400,
};

/** Reads a spell's duration as written ("1 round", "Concentration, up to 1 minute", "8 hours"). */
export function spellDuration(
  text: string | undefined,
  concentration = false,
): SpellDuration {
  const t = (text ?? "").toLowerCase();
  const m = /(\d+)\s*(round|minute|hour|day)s?/.exec(t);
  const seconds = m ? Number(m[1]) * (UNITS[m[2] as string] ?? 0) : undefined;
  return {
    ...(seconds !== undefined ? { seconds } : {}),
    concentration: concentration || t.startsWith("concentration"),
    instantaneous: t.startsWith("instantaneous"),
  };
}

/** "5 rounds", "9 min 12 s", "1 h": how long is left, from `now` to `end`. */
export function remaining(end: Moment, now: Moment): string {
  const seconds = Math.max(
    0,
    end.clock - now.clock + (end.step - now.step) / STEPS_PER_SECOND,
  );
  if (seconds <= 60) {
    const rounds = Math.ceil(seconds / 6);
    return `${rounds} round${rounds === 1 ? "" : "s"}`;
  }
  const s = Math.ceil(seconds);
  const parts = [
    [Math.floor(s / 3600), "h"],
    [Math.floor((s % 3600) / 60), "min"],
    [s % 60, "s"],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, u]) => `${n} ${u}`)
    .join(" ");
}

/** The current moment: in an encounter, its round's start plus steps; otherwise late in the second. */
export function momentNow(
  clock: number,
  encounter?: {
    readonly startClock: number;
    readonly round: number;
    readonly step: number;
  },
): Moment {
  if (!encounter) return { clock, step: LATE };
  return {
    clock:
      encounter.startClock +
      Math.max(0, encounter.round - 1) * SECONDS_PER_ROUND,
    step: encounter.round >= 1 ? encounter.step : 0,
  };
}
