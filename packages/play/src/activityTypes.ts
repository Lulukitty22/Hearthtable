// The activity types Milestone 5 builds, each a module of its own registered with the downtime
// machinery (Turns, Encounters and Time, "Downtime" and "What rests restore"; SRD 5.2.1 "Short
// Rest" and "Long Rest", checked 2026-10-25):
//
// - Short Rest: 1 hour. Resets short-rest resources, then the player may spend Hit Point Dice one
//   at a time. Needs at least 1 Hit Point to start (a warning). Unfinished, it gives nothing.
// - Long Rest: 8 hours. Restores all hit points and spent Hit Point Dice, all spell slots and
//   short- and long-rest resources, and lowers Exhaustion by one level. Needs at least 1 Hit
//   Point and 16 hours since the last Long Rest ended (warnings). Stopped after at least an hour,
//   it gives a Short Rest's benefits; otherwise nothing.
// - Note with a duration: a short note to the DM (keeping watch, scouting, shopping). It uses the
//   character's time and changes nothing; the DM handles any outcome. It can be split.

import {
  registerActivityType,
  type ActivityType,
  type CharacterData,
  type CharacterFacts,
  type Outcome,
} from "./activities";

const HOUR = 3600;

type Entry = { id: string; ref: string; level?: number };

/** Resets the uses of every pool whose reset is one of `resets`. */
function resetPools(
  data: CharacterData,
  facts: CharacterFacts,
  resets: readonly string[],
): CharacterData {
  const resources =
    (data["resources"] as { used?: Record<string, number> }) ?? {};
  const resetting = new Set(
    facts.pools
      .filter((p) => resets.some((r) => p.reset.toLowerCase().includes(r)))
      .map((p) => p.pool),
  );
  const used = Object.fromEntries(
    Object.entries(resources.used ?? {}).filter(
      ([pool]) => !resetting.has(pool),
    ),
  );
  return { ...data, resources: { ...resources, used } };
}

const warnHp = (facts: CharacterFacts, rest: string) =>
  facts.hpCurrent < 1
    ? [
        `${facts.name} has ${facts.hpCurrent} hit points; a ${rest} needs at least 1 to start.`,
      ]
    : [];

function shortRestBenefits(
  facts: CharacterFacts,
  data: CharacterData,
): Outcome {
  return {
    data: resetPools(data, facts, ["short rest"]),
    summary: "short-rest uses restored; Hit Point Dice may be spent",
    spendHitDice: true,
  };
}

export const shortRest: ActivityType = {
  id: "short-rest",
  name: "Short Rest",
  duration: () => HOUR,
  splittable: false,
  needsNote: false,
  warnings: (facts) => warnHp(facts, "Short Rest"),
  finish: (facts, data) => shortRestBenefits(facts, data),
};

export const longRest: ActivityType = {
  id: "long-rest",
  name: "Long Rest",
  duration: () => 8 * HOUR,
  splittable: false,
  needsNote: false,
  warnings: (facts, data, clock) => {
    const last = data["lastLongRestEnd"];
    return [
      ...warnHp(facts, "Long Rest"),
      ...(typeof last === "number" && clock - last < 16 * HOUR
        ? [
            `${facts.name} finished a Long Rest less than 16 hours ago; the rules ask for 16 hours between them.`,
          ]
        : []),
    ];
  },
  finish: (facts, data, clock) => {
    const restored = resetPools(data, facts, ["short rest", "long rest"]);
    const hp =
      (data["hitPoints"] as { current?: number; temporary?: number }) ?? {};
    // Exhaustion drops by one level: the last entry loses a level, or goes.
    const conditions = [...((data["conditions"] as Entry[] | undefined) ?? [])];
    const i = conditions
      .map((c) => c.ref)
      .lastIndexOf("core/Conditions/Exhaustion");
    if (i >= 0) {
      const e = conditions[i] as Entry;
      if ((e.level ?? 1) > 1)
        conditions[i] = { ...e, level: (e.level ?? 1) - 1 };
      else conditions.splice(i, 1);
    }
    return {
      data: {
        ...restored,
        hitPoints: {
          ...hp,
          ...(facts.hpMax !== undefined ? { current: facts.hpMax } : {}),
        },
        hitPointDice: { spent: {} },
        spellcasting: {
          ...((data["spellcasting"] as object | undefined) ?? {}),
          expended: {},
        },
        conditions,
        lastLongRestEnd: clock,
      },
      summary: `hit points, Hit Point Dice, spell slots and rest uses restored${i >= 0 ? "; Exhaustion lowered by one level" : ""}`,
    };
  },
  unfinished: (ran, facts, data) =>
    ran >= HOUR ? shortRestBenefits(facts, data) : undefined,
};

export const note: ActivityType = {
  id: "note",
  name: "Note",
  duration: (input) =>
    input.seconds !== undefined && input.seconds > 0
      ? input.seconds
      : undefined,
  splittable: true,
  needsNote: true,
  warnings: () => [],
  finish: (_facts, data) => ({
    data,
    summary: "done; the DM handles the outcome",
  }),
};

for (const t of [shortRest, longRest, note]) registerActivityType(t);
