// The behaviour every Repository must have, run against each adapter. It includes the Milestone
// 2 round-trip acceptance tests: a no-change save and reload is deep-equal (unknown and nested
// fields and quantity 0 included), and changing one field changes only that field.

import { carolElfnein, CAROL_ID } from "@hearthtable/content";
import {
  serializeEnvelope,
  type RecordEnvelope,
  type RecordId,
} from "@hearthtable/kernel";
import { beforeEach, describe, expect, test } from "vitest";
import type { Repository } from "./repository";

const NOW = "2026-10-22T22:00:00.000Z";
const LATER = "2026-10-22T22:05:00.000Z";

/** Carol's records plus fields no current code knows about, at every level. */
function carolWithUnknownFields(): RecordEnvelope[] {
  return carolElfnein.map((r) => {
    const raw = serializeEnvelope(r);
    const data = structuredClone(raw["data"]) as Record<string, unknown>;
    if (r.id === CAROL_ID)
      data["futureField"] = {
        nested: { deeper: [1, { kept: true }] },
        empty: {},
      };
    if (r.id === `${CAROL_ID}/inventory`) {
      data["lines"] = [
        ...(data["lines"] as unknown[]),
        {
          id: "empty-vial",
          ref: "core/potion_of_healing",
          quantity: 0,
          addons: { label: "kept" },
          type: "clothing",
        },
      ];
    }
    return {
      ...r,
      data,
      raw: {
        ...raw,
        futureTopLevel: "kept",
        source: { ...(raw["source"] as object), futureSource: null },
      },
    };
  });
}

const plain = (records: readonly RecordEnvelope[]) =>
  [...records]
    .map(serializeEnvelope)
    .sort((a, b) => String(a["id"]).localeCompare(String(b["id"])));

async function ok<T>(
  p: Promise<
    { ok: true; value: T } | { ok: false; errors: readonly unknown[] }
  >,
): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(JSON.stringify(r.errors, null, 2));
  return r.value;
}

export function repositoryContract(
  name: string,
  make: () => Promise<Repository>,
) {
  describe(`${name} repository`, () => {
    let repo: Repository;
    beforeEach(async () => {
      repo = await make();
    });

    test("no-change round trip: load, save without edits and reload is deep-equal", async () => {
      const original = carolWithUnknownFields();
      await ok(repo.save(original, { now: NOW }));
      const loaded = await ok(repo.listUnder(CAROL_ID));
      expect(loaded).toHaveLength(original.length);
      await ok(repo.save(loaded, { now: LATER }));
      const reloaded = await ok(repo.listUnder(CAROL_ID));
      const strip = (rs: readonly RecordEnvelope[]) =>
        plain(rs).map(({ revision: _r, updatedAt: _u, ...rest }) => rest);
      expect(strip(reloaded)).toEqual(strip(original));
      expect(
        reloaded.every((r) => r.revision === 2 && r.updatedAt === LATER),
      ).toBe(true);
      const inventory = reloaded.find((r) => r.id === `${CAROL_ID}/inventory`);
      expect(
        (
          inventory?.data as { lines: { id: string; quantity: number }[] }
        ).lines.find((l) => l.id === "empty-vial")?.quantity,
      ).toBe(0);
    });

    test("edit round trip: changing one field changes only that field", async () => {
      await ok(repo.save(carolWithUnknownFields(), { now: NOW }));
      const before = await ok(repo.get(CAROL_ID as RecordId));
      if (!before) throw new Error("Carol is missing");
      const data = structuredClone(before.data) as {
        hitPoints: { current: number };
      };
      data.hitPoints.current = 61;
      await ok(repo.save([{ ...before, data }], { now: LATER }));
      const after = await ok(repo.get(CAROL_ID as RecordId));
      if (!after) throw new Error("Carol is missing");
      const expected = serializeEnvelope(before);
      (
        expected["data"] as { hitPoints: { current: number } }
      ).hitPoints.current = 61;
      expect(serializeEnvelope(after)).toEqual({
        ...expected,
        revision: before.revision + 1,
        updatedAt: LATER,
      });
    });

    test("a save edited from an older revision is refused and changes nothing", async () => {
      await ok(repo.save(carolElfnein, { now: NOW }));
      const a = await ok(repo.get(CAROL_ID as RecordId));
      const b = await ok(repo.get(CAROL_ID as RecordId));
      if (!a || !b) throw new Error("Carol is missing");
      await ok(
        repo.save(
          [{ ...a, data: { ...(a.data as object), name: "Carol (tab A)" } }],
          { now: LATER },
        ),
      );
      const stale = await repo.save(
        [{ ...b, data: { ...(b.data as object), name: "Carol (tab B)" } }],
        { now: LATER },
      );
      expect(stale.ok).toBe(false);
      expect(!stale.ok && stale.errors[0]).toMatchObject({
        code: "conflict",
        expected: 1,
        actual: 2,
      });
      const stored = await ok(repo.get(CAROL_ID as RecordId));
      expect((stored?.data as { name: string }).name).toBe("Carol (tab A)");
    });

    test("creating a record that already exists is a conflict, not an overwrite", async () => {
      await ok(repo.save(carolElfnein, { now: NOW }));
      const again = await repo.save([carolElfnein[0] as RecordEnvelope], {
        now: LATER,
      });
      expect(again.ok).toBe(false);
      expect(!again.ok && again.errors[0]?.code).toBe("conflict");
    });

    test("a save of several records is all or nothing", async () => {
      await ok(repo.save(carolElfnein, { now: NOW }));
      const character = await ok(repo.get(CAROL_ID as RecordId));
      const inventory = await ok(repo.get(`${CAROL_ID}/inventory` as RecordId));
      if (!character || !inventory) throw new Error("records missing");
      const result = await repo.save(
        [
          {
            ...character,
            data: { ...(character.data as object), name: "changed" },
          },
          { ...inventory, revision: 0 },
        ],
        { now: LATER },
      );
      expect(result.ok).toBe(false);
      const stored = await ok(repo.get(CAROL_ID as RecordId));
      expect((stored?.data as { name: string }).name).toBe("Carol Elfnein");
    });

    test("a list inside a list is rejected before anything is written", async () => {
      const bad = {
        ...(carolElfnein[0] as RecordEnvelope),
        data: { grid: [[1, 2]] },
      };
      const result = await repo.save([bad], { now: NOW });
      expect(!result.ok && result.errors[0]?.code).toBe("invalid");
      expect(await ok(repo.get(bad.id))).toBeUndefined();
    });

    test("listing a sheet returns it and its tabs, not neighbours with similar names", async () => {
      const neighbour = {
        ...(carolElfnein[0] as RecordEnvelope),
        id: `${CAROL_ID}_2` as RecordId,
        raw: {},
      };
      await ok(repo.save([...carolElfnein, neighbour], { now: NOW }));
      const ids = (await ok(repo.listUnder(CAROL_ID))).map((r) => r.id).sort();
      expect(ids).toEqual(carolElfnein.map((r) => r.id).sort());
    });

    test("delete needs the current revision", async () => {
      await ok(repo.save(carolElfnein, { now: NOW }));
      const id = `${CAROL_ID}/books/workshop` as RecordId;
      expect((await repo.delete(id, 0)).ok).toBe(false);
      await ok(repo.delete(id, 1));
      expect(await ok(repo.get(id))).toBeUndefined();
    });
  });
}
