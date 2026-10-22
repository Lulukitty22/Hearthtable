import { describe, expect, test } from "vitest";
import {
  parseEnvelope,
  serializeEnvelope,
  type RecordEnvelope,
} from "./envelope";

const stored = {
  id: "campaign:bag_of_holding",
  kind: "item",
  moduleId: "containers",
  schemaVersion: 1,
  origin: {
    scope: "campaign",
    ownerId: "moonlit_coast",
    futureOriginField: "kept",
  },
  source: {
    status: "published",
    edition: "2024",
    reference: "PHB p. 225",
    futureSourceField: [1, 2],
  },
  revision: 7,
  updatedAt: "2026-10-22T19:00:00.000Z",
  data: {
    quantity: 0,
    contents: [{ ref: "core:rope", quantity: 1, addons: { knot: "bowline" } }],
    clothing: true,
  },
  futureTopLevelField: { nested: { deeper: null } },
};

function parse(input: unknown): RecordEnvelope {
  const result = parseEnvelope(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

describe("record envelope", () => {
  test("a no-change round trip is deep-equal, including unknown and nested fields and quantity 0", () => {
    expect(serializeEnvelope(parse(stored))).toEqual(stored);
  });

  test("changing one field changes only that field", () => {
    const record = parse(stored);
    const edited = serializeEnvelope({ ...record, revision: 8 });
    expect(edited).toEqual({ ...stored, revision: 8 });
  });

  test("removing an optional known field removes it and keeps unknown neighbours", () => {
    const record = parse(stored);
    const { edition: _removed, ...source } = record.source;
    const edited = serializeEnvelope({ ...record, source });
    expect(edited["source"]).toEqual({
      status: "published",
      reference: "PHB p. 225",
      futureSourceField: [1, 2],
    });
  });

  test("editing the parsed object does not alter the stored copy", () => {
    const input = structuredClone(stored);
    const record = parse(input);
    input.data.quantity = 99;
    expect(serializeEnvelope(record)["data"]).toEqual(stored.data);
  });

  test("a missing or unknown status is an error, never a default", () => {
    const { source: _source, ...noSource } = stored;
    const missing = parseEnvelope(noSource);
    const wrong = parseEnvelope({ ...stored, source: { status: "parked" } });
    expect(missing.ok).toBe(false);
    expect(wrong.ok).toBe(false);
    expect(wrong.issues.map((i) => i.code)).toContain("envelope.bad-status");
  });

  test("reports every bad field at once", () => {
    const result = parseEnvelope({
      id: "no-scope",
      kind: "",
      schemaVersion: 0,
      revision: -1,
      updatedAt: "soon",
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toEqual(
      expect.arrayContaining([
        "id",
        "kind",
        "moduleId",
        "schemaVersion",
        "revision",
        "updatedAt",
        "data",
        "origin.scope",
        "source.status",
      ]),
    );
  });
});
