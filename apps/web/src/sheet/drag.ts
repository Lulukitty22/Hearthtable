// What a drag may do, as plain functions over stored data (user decisions, 2026-10-22).
//
// Items move between the inventory root, containers and container slots (the Aetherlock's
// chambers). A move is refused when it makes no sense: into itself or something inside it, into
// something that is not a container, or into a container that does not accept that kind (only
// rounds go in chambers). Overfilling is allowed; the engine shows the warning.
// Dragging from a stack moves one; the caller may ask how many instead (Shift). A moved stack part
// joins a matching stack at the destination when nothing distinguishes them.
// Spells move only between books, keeping their level. A scroll dropped on a book is mounted:
// its line becomes a book entry with the same id and state, taking one entry; taking it out
// turns the entry back into a line (one physical scroll, 2026-10-23).

type Line = Record<string, unknown> & {
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

type Entry = Record<string, unknown> & { id: string; ref: string };

/** Moves a spell entry from one book's entries to another's. */
export function moveEntry(
  from: readonly Entry[],
  to: readonly Entry[],
  entryId: string,
): { ok: true; from: Entry[]; to: Entry[] } | { ok: false; reason: string } {
  const entry = from.find((e) => e.id === entryId);
  if (!entry)
    return { ok: false, reason: "That spell is no longer in the book." };
  if (to.some((e) => e.ref === entry.ref))
    return { ok: false, reason: "That book already holds this spell." };
  return {
    ok: true,
    from: from.filter((e) => e.id !== entryId),
    to: [...to, entry],
  };
}

/** Mounts a loose scroll line into a book: the line becomes an entry with the same id. */
export function mountScroll(
  lines: readonly Line[],
  entries: readonly Entry[],
  lineId: string,
):
  | { ok: true; lines: Line[]; entries: Entry[] }
  | { ok: false; reason: string } {
  const line = lines.find((l) => l.id === lineId);
  if (!line)
    return { ok: false, reason: "That item is no longer in the inventory." };
  const scroll = line["scroll"] as { spell?: unknown } | undefined;
  if (!scroll || typeof scroll.spell !== "string")
    return { ok: false, reason: "Only spells and scrolls go in a spellbook." };
  if (lines.some((l) => l.parent === lineId))
    return { ok: false, reason: "Take the items out of it first." };
  if (entries.some((e) => e.ref === scroll.spell))
    return { ok: false, reason: "That book already holds this spell." };
  return {
    ok: true,
    lines: lines.filter((l) => l.id !== lineId),
    entries: [
      ...entries,
      { id: line.id, ref: scroll.spell, item: line.ref, scroll },
    ],
  };
}

/** Takes a mounted scroll out of a book, back into the inventory at `target`. */
export function unmountScroll(
  entries: readonly Entry[],
  lines: readonly Line[],
  entryId: string,
  target: Target,
  rulesOf: (ref: string) => ItemRules | undefined,
):
  | { ok: true; lines: Line[]; entries: Entry[] }
  | { ok: false; reason: string } {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry)
    return { ok: false, reason: "That spell is no longer in the book." };
  if (!entry["scroll"])
    return {
      ok: false,
      reason:
        "A written spell cannot leave the book; only mounted scrolls can.",
    };
  if (lines.some((l) => l.id === entry.id))
    return {
      ok: false,
      reason: "An item with this id is already in the inventory.",
    };
  const line: Line = {
    id: entry.id,
    ref:
      typeof entry["item"] === "string" ? entry["item"] : "core/Spell_Scroll",
    quantity: 1,
    attunedTo: null,
    scroll: entry["scroll"],
  };
  const atRoot = [...lines, line];
  const placed =
    target.kind === "root"
      ? ({ ok: true, lines: atRoot } as const)
      : moveItem(atRoot, line.id, target, 1, rulesOf, () => line.id);
  if (!placed.ok) return placed;
  return {
    ok: true,
    lines: placed.lines,
    entries: entries.filter((e) => e.id !== entryId),
  };
}
