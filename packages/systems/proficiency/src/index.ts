// Proficiency bonus from total character level. `character.level` comes from the game module.
// The `every-four-levels` method is the published pattern, +2 at levels 1–4 and +1 every four
// levels, which Vanilla+ continues past 20 (Character Creation and Advancement).

import {
  DERIVATIONS_POINT,
  known,
  unresolved,
  type Derivation,
  type KernelModule,
} from "@hearthtable/kernel";

const bonus: Derivation = {
  key: "proficiency.bonus",
  compute: (rc) => {
    const level = rc.get<number>("character.level");
    if (level.kind === "unresolved") return level;
    const method = rc.settings.method("proficiency.progression");
    if (method.kind === "unresolved") return method;
    if (level.value < 1) return unresolved("Character level is below 1.");
    return known(2 + Math.floor((level.value - 1) / 4), "Proficiency bonus", {
      note: `total level ${level.value}`,
    });
  },
};

export const proficiency: KernelModule = {
  manifest: {
    id: "proficiency",
    version: "1.0.0",
    requires: [],
    extends: [DERIVATIONS_POINT],
    provides: {
      methods: [{ slot: "progression", options: ["every-four-levels"] }],
    },
  },
  setup: (ctx) => ctx.extend(DERIVATIONS_POINT, bonus),
};
