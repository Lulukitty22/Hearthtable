import {
  newEnvelope,
  type RecordEnvelope,
  type RecordId,
} from "@hearthtable/kernel";
import { expect, test } from "vitest";
import { settleDrafts } from "./saveDrafts";

const rec = (id: string, revision: number, data: unknown): RecordEnvelope =>
  newEnvelope({
    id: id as RecordId,
    kind: "character",
    moduleId: "test",
    schemaVersion: 1,
    origin: { scope: "core" },
    source: { status: "homebrew" },
    revision,
    updatedAt: "2026-10-23T00:00:00.000Z",
    data,
  });

test("drafts saved as sent drop away; drafts edited during the save stay, rebased", () => {
  const hpSent = rec("core/A", 1, { hp: 61 });
  const invSent = rec("core/B", 1, { potions: 3 });
  const sent = new Map([
    ["core/A", hpSent],
    ["core/B", invSent],
  ]);
  // While the save was in flight, HP was edited again and a third record was touched.
  const hpLater = rec("core/A", 1, { hp: 40 });
  const other = rec("core/C", 4, { note: "x" });
  const current = new Map([
    ["core/A", hpLater],
    ["core/B", invSent],
    ["core/C", other],
  ]);
  const saved = [
    rec("core/A", 2, { hp: 61 }),
    rec("core/B", 2, { potions: 3 }),
  ];

  const next = settleDrafts(current, sent, saved);
  expect([...next.keys()]).toEqual(["core/A", "core/C"]);
  expect(next.get("core/A")).toMatchObject({ revision: 2, data: { hp: 40 } });
  expect(next.get("core/C")).toBe(other);
});
