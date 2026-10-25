// A campaign's requests, kept current (Milestone 5 S6), and what each character's queued
// requests hold. Resolution reads the holds from a `holds` record that is never stored, so held
// slots, uses and items are not usable on the sheet or at the table.

import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { addHolds, type Holds } from "@hearthtable/play";
import { watchActions, type ActionRequest } from "@hearthtable/storage";
import { useEffect, useState } from "react";
import { db } from "../firebase";

export function useActions(campaign: string | undefined) {
  const [list, setList] = useState<readonly ActionRequest[]>([]);
  useEffect(() => {
    if (!campaign) return;
    return watchActions(db, campaign, setList, () => {});
  }, [campaign]);
  return list;
}

/** Everything a character's queued requests hold. */
export function heldBy(
  actions: readonly ActionRequest[],
  character: string,
): Required<Holds> {
  return addHolds(
    actions
      .filter((a) => a.status === "queued" && a.character === character)
      .map((a) => a.holds),
  );
}

export function holdsRecord(holds: Holds): RecordEnvelope {
  return {
    id: "holds" as RecordId,
    kind: "holds",
    moduleId: "play",
    schemaVersion: 1,
    origin: { scope: "core" },
    source: { status: "homebrew" },
    revision: 0,
    updatedAt: new Date(0).toISOString(),
    data: { ...holds },
    raw: {},
  };
}
