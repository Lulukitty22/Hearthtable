import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { describe, expect, it } from "vitest";
import {
  changes,
  comparison,
  incomingChanges,
  resolvedDrafts,
  setAt,
} from "./sheetDiff";

const record = (
  id: string,
  revision: number,
  data: unknown,
): RecordEnvelope => ({
  id: id as RecordId,
  kind: "character",
  moduleId: "test",
  schemaVersion: 1,
  origin: { scope: "account" },
  source: { status: "homebrew" },
  revision,
  updatedAt: `2026-10-24T00:00:0${revision}.000Z`,
  data,
  raw: {},
});
const map = (...rs: RecordEnvelope[]) =>
  new Map(rs.map((r) => [r.id as string, r]));

const SHEET = "c";
const INV = "c/Inventory";
const base = map(
  record(SHEET, 1, { hitPoints: { current: 95, temporary: 0 }, name: "Carol" }),
  record(INV, 1, {
    lines: [
      { id: "potion", quantity: 3 },
      { id: "rope", quantity: 1 },
    ],
  }),
);

describe("what an incoming save changed", () => {
  it("finds fields, and list lines by id, so one used item is one change", () => {
    const after = map(
      base.get(SHEET) as RecordEnvelope,
      record(INV, 2, {
        lines: [
          { id: "potion", quantity: 2 },
          { id: "rope", quantity: 1 },
        ],
      }),
    );
    expect(incomingChanges(base, after)).toEqual([
      {
        recordId: INV,
        path: ["lines", { id: "potion" }],
        incoming: { id: "potion", quantity: 2 },
      },
    ]);
  });

  it("treats lists without ids as one value", () => {
    expect(changes({ tags: ["a"] }, { tags: ["a", "b"] })).toEqual([
      { path: ["tags"], value: ["a", "b"] },
    ]);
  });
});

describe("comparing with the editor's values", () => {
  const after = map(
    record(SHEET, 2, {
      hitPoints: { current: 70, temporary: 0 },
      name: "Carol",
    }),
    base.get(INV) as RecordEnvelope,
  );
  const incoming = incomingChanges(base, after);

  it("shows changes even when the editor did not touch them", () => {
    const items = comparison(incoming, (id) => base.get(id));
    expect(items).toEqual([
      {
        recordId: SHEET,
        path: ["hitPoints", "current"],
        incoming: 70,
        mine: 95,
      },
    ]);
  });

  it("keeps the editor's other edits and applies each choice", () => {
    const draft = record(SHEET, 1, {
      hitPoints: { current: 50, temporary: 5 },
      name: "Carol",
    });
    const drafts = map(draft);
    const items = comparison(incoming, (id) => drafts.get(id) ?? base.get(id));
    expect(items[0]?.mine).toBe(50);

    const keep = resolvedDrafts(base, after, drafts, items, new Set([0]));
    expect(keep.get(SHEET)?.data).toEqual({
      hitPoints: { current: 50, temporary: 5 },
      name: "Carol",
    });
    expect(keep.get(SHEET)?.revision).toBe(2);

    const take = resolvedDrafts(base, after, drafts, items, new Set());
    // The incoming HP wins; the untouched-by-them temporary HP edit stays.
    expect(take.get(SHEET)?.data).toEqual({
      hitPoints: { current: 70, temporary: 5 },
      name: "Carol",
    });
  });

  it("drops a draft that ends up equal to the incoming record", () => {
    const items = comparison(incoming, (id) => base.get(id));
    expect(resolvedDrafts(base, after, new Map(), items, new Set()).size).toBe(
      0,
    );
    const kept = resolvedDrafts(base, after, new Map(), items, new Set([0]));
    expect(kept.get(SHEET)?.data).toMatchObject({ hitPoints: { current: 95 } });
  });
});

describe("setAt", () => {
  it("adds, replaces and removes list lines by id", () => {
    const lines = { lines: [{ id: "a", q: 1 }] };
    expect(setAt(lines, ["lines", { id: "b" }], { id: "b", q: 2 })).toEqual({
      lines: [
        { id: "a", q: 1 },
        { id: "b", q: 2 },
      ],
    });
    expect(setAt(lines, ["lines", { id: "a" }], undefined)).toEqual({
      lines: [],
    });
  });
});
