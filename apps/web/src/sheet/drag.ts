// What a drag may do, as plain functions over stored data (user decisions, 2026-10-22).
//
// Items move between the inventory root, containers and container slots (the Aetherlock's
// chambers). A move is refused when it makes no sense: into itself or something inside it, into
// something that is not a container, or into a container that does not accept that kind (only
// rounds go in chambers). Overfilling is allowed; the engine shows the warning.
// Dragging from a stack moves one; the caller may ask how many instead (Shift). A moved stack part
// joins a matching stack at the destination when nothing distinguishes them.
// Books and Spellrounds are containers (Milestone 5 S0, 2026-10-24): every spell in a book is a
// scroll line inside it, so mounting, taking out and moving between books are ordinary moves of
// that line. A book refuses a second scroll of a spell it already holds.

export type Line = Record<string, unknown> & {
  id: string;
  ref: string;
  quantity: number;
  parent?: string;
  slot?: string;
};

export interface ItemRules {
  readonly container?: {
    readonly slots?: readonly { readonly id: string }[];
    readonly accepts?: readonly string[];
    /** `bound` for spellbooks, `installed` for Spellrounds. */
    readonly scrollUse?: "bound" | "installed";
  };
  readonly tags?: readonly string[];
}

export type Target =
  | { readonly kind: "root" }
  | { readonly kind: "container"; readonly lineId: string }
  | { readonly kind: "slot"; readonly lineId: string; readonly slot: string };

export type MoveResult =
  | { readonly ok: true; readonly lines: Line[] }
  | { readonly ok: false; readonly reason: string };

/** State that makes a line unlike another of the same item, so they must not merge or split. */
const DISTINCT = [
  "attunedTo",
  "attunedSlot",
  "charges",
  "magazine",
  "held",
  "equipped",
  "capacityOverride",
  "scroll",
  "lost",
] as const;

function distinctive(l: Line): boolean {
  return DISTINCT.some((k) => l[k] !== undefined && l[k] !== null);
}

function descendantsOf(lines: readonly Line[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (parent: string) => {
    for (const l of lines) {
      if (l.parent === parent && !out.has(l.id)) {
        out.add(l.id);
        walk(l.id);
      }
    }
  };
  walk(id);
  return out;
}

/** Why `lineId` cannot go to `target`, or undefined when it can. */
export function refusal(
  lines: readonly Line[],
  lineId: string,
  target: Target,
  rulesOf: (ref: string) => ItemRules | undefined,
): string | undefined {
  const line = lines.find((l) => l.id === lineId);
  if (!line) return "That item is no longer in the inventory.";
  if (target.kind === "root") return undefined;
  if (target.lineId === lineId) return "An item cannot go inside itself.";
  if (descendantsOf(lines, lineId).has(target.lineId))
    return "A container cannot go inside something it holds.";
  const holder = lines.find((l) => l.id === target.lineId);
  if (!holder) return "That container is no longer in the inventory.";
  const rules = rulesOf(holder.ref)?.container;
  if (!rules) return "That is not a container.";
  const tags = rulesOf(line.ref)?.tags ?? [];
  if (rules.accepts && !tags.some((t) => rules.accepts?.includes(t)))
    return `It only holds ${rules.accepts.join(", ")}.`;
  if (rules.scrollUse === "bound") {
    const spell = (line["scroll"] as { spell?: unknown } | undefined)?.spell;
    const twin = lines.some(
      (l) =>
        l.id !== line.id &&
        l.parent === holder.id &&
        (l["scroll"] as { spell?: unknown } | undefined)?.spell === spell,
    );
    if (twin) return "That book already holds this spell.";
  }
  const slots = rules.slots ?? [];
  if (target.kind === "slot" && !slots.some((s) => s.id === target.slot))
    return "That slot does not exist.";
  if (target.kind === "container" && slots.length > 0)
    return "Drop it on a slot.";
  return undefined;
}

/** Moves `count` of a line to `target`, splitting and merging stacks as needed. */
export function moveItem(
  lines: readonly Line[],
  lineId: string,
  target: Target,
  count: number,
  rulesOf: (ref: string) => ItemRules | undefined,
  newId: () => string,
): MoveResult {
  const why = refusal(lines, lineId, target, rulesOf);
  if (why) return { ok: false, reason: why };
  const line = lines.find((l) => l.id === lineId) as Line;
  const take = Math.min(Math.max(1, Math.floor(count)), line.quantity);
  if (take < line.quantity && distinctive(line))
    return {
      ok: false,
      reason: "This item has its own state and moves as a whole.",
    };

  const place = (l: Line): Line => {
    const { parent: _p, slot: _s, ...rest } = l;
    return {
      ...rest,
      ...(target.kind === "root" ? {} : { parent: target.lineId }),
      ...(target.kind === "slot" ? { slot: target.slot } : {}),
    } as Line;
  };
  const moved =
    take === line.quantity
      ? place(line)
      : place({ ...line, id: newId(), quantity: take });

  // Join a matching plain stack already at the destination (never into a slot).
  const sameSpot = (l: Line) =>
    (target.kind === "root"
      ? l.parent === undefined
      : l.parent === target.lineId) && l.slot === undefined;
  const mate =
    target.kind === "slot" || distinctive(moved)
      ? undefined
      : lines.find(
          (l) =>
            l.id !== line.id &&
            l.ref === moved.ref &&
            sameSpot(l) &&
            !distinctive(l),
        );

  const out: Line[] = [];
  for (const l of lines) {
    if (l.id === line.id) {
      if (take < line.quantity) out.push({ ...l, quantity: l.quantity - take });
      else if (!mate) out.push(moved);
    } else if (mate && l.id === mate.id) {
      out.push({ ...l, quantity: l.quantity + take });
    } else {
      out.push(l);
    }
  }
  if (take < line.quantity && !mate) out.push(moved);
  return { ok: true, lines: out };
}

/** Takes everything directly inside a container out to where the container itself is. */
export function emptyContainer(lines: readonly Line[], lineId: string): Line[] {
  const holder = lines.find((l) => l.id === lineId);
  if (!holder) return [...lines];
  return lines.map((l) => {
    if (l.parent !== lineId) return l;
    const { parent: _p, slot: _s, ...rest } = l;
    return (
      holder.parent === undefined ? rest : { ...rest, parent: holder.parent }
    ) as Line;
  });
}
