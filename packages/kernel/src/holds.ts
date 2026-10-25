// Resources held by queued requests (Spell Effects and Active State, "Queued resource holds";
// Milestone 5 S6). The app supplies them as a `holds` record that is never stored, the totals of
// the character's open requests; systems subtract them from what the character can use.

import { z } from "zod";
import { readField } from "./read";
import type { ResolveContext } from "./resolve";

export const HOLDS_KIND = "holds";

const Amounts = z.record(z.string(), z.number()).optional();

/** Held amounts of one kind of resource: spell slots by level, lines by id, pools by name. */
export function heldAmounts(
  ctx: ResolveContext,
  part: "slots" | "lines" | "pools",
): Readonly<Record<string, number>> {
  return readField(ctx, HOLDS_KIND, part, Amounts)[0]?.value ?? {};
}
