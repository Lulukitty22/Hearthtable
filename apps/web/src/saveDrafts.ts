// What happens to unsaved edits when a save finishes. A save sends a snapshot of the drafts and
// waits for storage; the sheet stays editable meanwhile. A draft still identical to what was
// sent is now saved and drops away. A draft edited again during the wait is kept, rebased onto
// the revision just saved, so the next save goes through instead of losing that edit
// (review finding, 2026-10-22).

import type { RecordEnvelope } from "@hearthtable/kernel";

export function settleDrafts(
  current: ReadonlyMap<string, RecordEnvelope>,
  sent: ReadonlyMap<string, RecordEnvelope>,
  saved: readonly RecordEnvelope[],
): Map<string, RecordEnvelope> {
  const byId = new Map(saved.map((r) => [r.id as string, r]));
  const next = new Map<string, RecordEnvelope>();
  for (const [id, draft] of current) {
    const stored = byId.get(id);
    if (!stored) {
      next.set(id, draft); // not part of this save
    } else if (draft !== sent.get(id)) {
      next.set(id, {
        ...draft,
        revision: stored.revision,
        updatedAt: stored.updatedAt,
        raw: stored.raw,
      });
    }
    // otherwise: saved exactly as drafted
  }
  return next;
}
