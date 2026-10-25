// The campaign's game clock (Turns, Encounters and Time, "Rounds and the game clock" and
// "Scenes", selected 2026-10-24). It is a count of seconds since midnight before Day 1, kept by
// the campaign; it reads as day and time, such as "Day 3, 2:32 pm". It never moves on its own:
// rounds add six seconds, ending downtime adds the time that passed, and the DM can set it.

export const SECONDS_PER_ROUND = 6;
const DAY = 24 * 60 * 60;

export interface ClockParts {
  /** 1 for the campaign's first day. */
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export function clockParts(seconds: number): ClockParts {
  const s = Math.max(0, Math.floor(seconds));
  const inDay = s % DAY;
  return {
    day: Math.floor(s / DAY) + 1,
    hour: Math.floor(inDay / 3600),
    minute: Math.floor((inDay % 3600) / 60),
    second: inDay % 60,
  };
}

/** Seconds for a day (from 1) and time of day; out-of-range parts are refused. */
export function clockFrom(
  day: number,
  hour: number,
  minute: number,
  second = 0,
): number | undefined {
  const whole = [day, hour, minute, second].every(Number.isInteger);
  if (
    !whole ||
    day < 1 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  )
    return undefined;
  return (day - 1) * DAY + hour * 3600 + minute * 60 + second;
}

/** "Day 3, 2:32 pm"; seconds show only when not zero, as within a fight ("2:32:18 pm"). */
export function formatClock(seconds: number): string {
  const { day, hour, minute, second } = clockParts(seconds);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, "0");
  const ss = second ? `:${String(second).padStart(2, "0")}` : "";
  return `Day ${day}, ${h12}:${mm}${ss} ${hour < 12 ? "am" : "pm"}`;
}

/** A length of time in words, such as "1 h 30 min" or "18 s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const parts = [
    [Math.floor(s / DAY), "d"],
    [Math.floor((s % DAY) / 3600), "h"],
    [Math.floor((s % 3600) / 60), "min"],
    [s % 60, "s"],
  ] as const;
  const shown = parts.filter(([n]) => n > 0).map(([n, u]) => `${n} ${u}`);
  return shown.length ? shown.join(" ") : "0 s";
}
