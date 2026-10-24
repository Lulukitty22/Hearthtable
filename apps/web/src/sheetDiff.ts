// Concurrent-edit difference review (Milestone 4, S9; Campaigns and Shared Data, Concurrent
// editing and difference review). When someone else saves a sheet while it is being edited, the
// browser compares that saved update with the editor's local values and shows only what
// differs; the editor chooses the incoming value or their own for each item. Nothing is written
// back by choosing: "keep mine" only keeps the value as a draft for a later, ordinary save.
//
// Items are fields of a record's data. Lists whose elements all have an `id` (inventory lines,
// book entries) are compared element by element, so using one item is one difference; other
// lists are compared whole.

import type { RecordEnvelope } from "@hearthtable/kernel";

/** A step into a record's data: an object key, or a list element by its `id`. */
export type Step = string | { readonly id: string };
export type Path = readonly Step[];

export interface Change {
  readonly recordId: string;
  readonly path: Path;
  /** The value after the incoming save; undefined when it removed it. */
  readonly incoming: unknown;
}

export interface DiffItem extends Change {
  /** The editor's local value: their draft, or the version they started from. */
  readonly mine: unknown;
}

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const idOf = (v: unknown) =>
  isPlain(v) && typeof v["id"] === "string" ? v["id"] : undefined;
const byIds = (v: unknown): v is Plain[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => idOf(x) !== undefined);

export const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** What changed between two values, as paths with their new values. */
export function changes(
  before: unknown,
  after: unknown,
  path: Path = [],
): { path: Path; value: unknown }[] {
  if (same(before, after)) return [];
  if (isPlain(before) && isPlain(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((k) => changes(before[k], after[k], [...path, k]));
  }
  const empty = (v: unknown) => Array.isArray(v) && v.length === 0;
  if ((byIds(before) || empty(before)) && (byIds(after) || empty(after))) {
    const a = before as Plain[];
    const b = after as Plain[];
    const ids = [...new Set([...a, ...b].map((x) => idOf(x) as string))];
    return ids.flatMap((id) => {
      const x = a.find((e) => idOf(e) === id);
      const y = b.find((e) => idOf(e) === id);
      return same(x, y) ? [] : [{ path: [...path, { id }], value: y }];
    });
  }
  return [{ path, value: after }];
}

export function getAt(value: unknown, path: Path): unknown {
  let current = value;
  for (const step of path) {
    if (typeof step === "string")
      current = isPlain(current) ? current[step] : undefined;
    else
      current = Array.isArray(current)
        ? current.find((e) => idOf(e) === step.id)
        : undefined;
  }
  return current;
}

/** A copy of `value` with `next` at `path`; undefined removes it. */
export function setAt(value: unknown, path: Path, next: unknown): unknown {
  const [step, ...rest] = path;
  if (step === undefined) return next;
  if (typeof step === "string") {
    const base = isPlain(value) ? value : {};
    const inner = setAt(base[step], rest, next);
    const { [step]: _old, ...others } = base;
    return inner === undefined ? others : { ...others, [step]: inner };
  }
  const list = Array.isArray(value) ? value : [];
  const at = list.findIndex((e) => idOf(e) === step.id);
  const inner = setAt(at >= 0 ? list[at] : undefined, rest, next);
  if (at < 0) return inner === undefined ? list : [...list, inner];
  return inner === undefined
    ? list.filter((_, i) => i !== at)
    : list.map((e, i) => (i === at ? inner : e));
}

const isPrefix = (a: Path, b: Path) =>
  a.length <= b.length && a.every((step, i) => same(step, b[i]));
/** Two items are about the same thing when one path lies within the other. */
const overlaps = (
  a: { recordId: string; path: Path },
  b: { recordId: string; path: Path },
) =>
  a.recordId === b.recordId &&
  (isPrefix(a.path, b.path) || isPrefix(b.path, a.path));

/** What one incoming save changed: whole records added or removed, otherwise their fields. */
export function incomingChanges(
  before: ReadonlyMap<string, RecordEnvelope>,
  after: ReadonlyMap<string, RecordEnvelope>,
): Change[] {
  const ids = [...new Set([...before.keys(), ...after.keys()])];
  return ids.flatMap((id) => {
    const a = before.get(id);
    const b = after.get(id);
    if (a && b && a.revision === b.revision) return [];
    if (!a || !b) return [{ recordId: id, path: [], incoming: b?.data }];
    return changes(a.data, b.data).map((c) => ({
      recordId: id,
      path: c.path,
      incoming: c.value,
    }));
  });
}

/** The items to show: incoming changes where the editor's local value differs. */
export function comparison(
  incoming: readonly Change[],
  local: (recordId: string) => RecordEnvelope | undefined,
): DiffItem[] {
  return incoming.flatMap((c) => {
    const record = local(c.recordId);
    const mine =
      c.path.length === 0 ? record?.data : getAt(record?.data, c.path);
    return same(mine, c.incoming) ? [] : [{ ...c, mine }];
  });
}

/**
 * The drafts after the editor chose, item by item, whether to keep their value. Each draft is
 * rebuilt on the incoming record (so a later save is not refused as a conflict): the editor's
 * own unsaved edits are carried over except where they chose the incoming value, and every
 * "keep mine" choice puts their value back.
 */
export function resolvedDrafts(
  oldBase: ReadonlyMap<string, RecordEnvelope>,
  newBase: ReadonlyMap<string, RecordEnvelope>,
  drafts: ReadonlyMap<string, RecordEnvelope>,
  items: readonly DiffItem[],
  keepMine: ReadonlySet<number>,
): Map<string, RecordEnvelope> {
  const next = new Map<string, RecordEnvelope>();
  const ids = new Set([...drafts.keys(), ...items.map((i) => i.recordId)]);
  for (const id of ids) {
    const incoming = newBase.get(id);
    const draft = drafts.get(id);
    let data: unknown = incoming?.data;
    // The editor's own edits, except those they gave up for the incoming value.
    if (draft)
      for (const edit of changes(oldBase.get(id)?.data, draft.data)) {
        const change = { recordId: id, path: edit.path };
        const givenUp = items.some(
          (item, n) => !keepMine.has(n) && overlaps(item, change),
        );
        if (!givenUp) data = setAt(data, edit.path, edit.value);
      }
    items.forEach((item, n) => {
      if (item.recordId === id && keepMine.has(n))
        data = setAt(data, item.path, item.mine);
    });
    const template = incoming ?? draft;
    if (!template || data === undefined || same(data, incoming?.data)) continue;
    next.set(id, {
      ...template,
      data,
      // A record the incoming save removed is recreated by a later save.
      revision: incoming?.revision ?? 0,
      ...(incoming ? { updatedAt: incoming.updatedAt, raw: incoming.raw } : {}),
    });
  }
  return next;
}
