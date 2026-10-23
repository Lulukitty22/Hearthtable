// Loads a character's sheet records and the definitions they use, keeps unsaved edits as
// drafts, resolves everything once per change, and saves drafts together with a history entry.
// Edits change only the fields they touch, so unknown fields survive (Lessons from Character
// Manager). A save against a newer stored version is refused and shown, never forced.

import { createEngine } from "@hearthtable/engine";
import type {
  RecordEnvelope,
  RecordId,
  ResolvedCharacter,
} from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import type { Repository, StorageError } from "@hearthtable/storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { settleDrafts } from "./saveDrafts";

export const engine = createEngine(hearthtableVanillaPlus);

type Data = Record<string, unknown>;

export interface HistoryEntry {
  readonly id: string;
  readonly at: string;
  readonly note?: string;
  readonly changed: readonly string[];
}

export type SheetState =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly message: string }
  | { readonly status: "missing" }
  | {
      readonly status: "ready";
      readonly resolved: ResolvedCharacter;
      readonly records: ReadonlyMap<string, RecordEnvelope>;
      readonly history: readonly HistoryEntry[];
      readonly dirty: readonly string[];
      readonly saving: boolean;
      readonly saveErrors: readonly StorageError[];
    };

export interface SheetActions {
  /** Changes one record's data; `change` gets a copy and returns the new data. */
  edit(id: string, change: (data: Data) => Data): void;
  discard(): void;
  save(note: string): Promise<boolean>;
  reload(): void;
}

/** A path segment cannot contain "/" or spaces; keep the timestamp's digits and T/Z. */
const historyKey = (iso: string) => iso.replace(/[^0-9TZ]/g, "");

export function useSheet(
  repo: Repository,
  characterId: string,
  definitionPaths: readonly string[],
): [SheetState, SheetActions] {
  const [stored, setStored] = useState<
    ReadonlyMap<string, RecordEnvelope> | undefined
  >();
  const [drafts, setDrafts] = useState<ReadonlyMap<string, RecordEnvelope>>(
    new Map(),
  );
  const [failure, setFailure] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<readonly StorageError[]>([]);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lists = await Promise.all(
        [characterId, ...definitionPaths].map((p) => repo.listUnder(p)),
      );
      if (cancelled) return;
      const map = new Map<string, RecordEnvelope>();
      for (const list of lists) {
        if (!list.ok) {
          setFailure(list.errors.map((e) => e.message).join("\n"));
          return;
        }
        for (const r of list.value) map.set(r.id, r);
      }
      setFailure(undefined);
      setStored(map);
      setDrafts(new Map());
      setSaveErrors([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, characterId, definitionPaths, generation]);

  const merged = useMemo(() => {
    if (!stored) return undefined;
    const m = new Map(stored);
    for (const [id, r] of drafts) m.set(id, r);
    return m;
  }, [stored, drafts]);

  // One resolution per change; every view renders from it.
  const resolved = useMemo(
    () =>
      merged
        ? engine.resolve(
            [...merged.values()].filter((r) => r.kind !== "history"),
          )
        : undefined,
    [merged],
  );

  const history = useMemo(
    () =>
      merged
        ? [...merged.values()]
            .filter(
              (r) =>
                r.kind === "history" &&
                r.id.startsWith(`${characterId}/History/`),
            )
            .map((r) => ({ id: r.id, ...(r.data as Omit<HistoryEntry, "id">) }))
            .sort((a, b) => b.at.localeCompare(a.at))
        : [],
    [merged, characterId],
  );

  const edit = useCallback(
    (id: string, change: (data: Data) => Data) => {
      setDrafts((current) => {
        const base = current.get(id) ?? stored?.get(id);
        if (!base) return current;
        const next = new Map(current);
        next.set(id, {
          ...base,
          data: change(structuredClone(base.data) as Data),
        });
        return next;
      });
    },
    [stored],
  );

  const save = useCallback(
    async (note: string) => {
      if (drafts.size === 0) return true;
      // The drafts as sent; edits made while the save is in flight are kept (settleDrafts).
      const sent = drafts;
      setSaving(true);
      const now = new Date().toISOString();
      const entry: RecordEnvelope = {
        id: `${characterId}/History/${historyKey(now)}` as RecordId,
        kind: "history",
        moduleId: "sheet",
        schemaVersion: 1,
        origin: stored?.get(characterId)?.origin ?? { scope: "account" },
        source: { status: "homebrew" },
        revision: 0,
        updatedAt: now,
        data: {
          at: now,
          changed: [...sent.keys()],
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        raw: {},
      };
      const result = await repo.save([...sent.values(), entry], { now });
      setSaving(false);
      if (!result.ok) {
        setSaveErrors(result.errors);
        return false;
      }
      setStored((current) => {
        const next = new Map(current);
        for (const r of result.value) next.set(r.id, r);
        return next;
      });
      setDrafts((current) => settleDrafts(current, sent, result.value));
      setSaveErrors([]);
      return true;
    },
    [drafts, repo, characterId, stored],
  );

  const actions: SheetActions = {
    edit,
    save,
    discard: () => {
      setDrafts(new Map());
      setSaveErrors([]);
    },
    reload: () => setGeneration((g) => g + 1),
  };

  if (failure) return [{ status: "failed", message: failure }, actions];
  if (!merged || !resolved) return [{ status: "loading" }, actions];
  if (!merged.has(characterId)) return [{ status: "missing" }, actions];
  return [
    {
      status: "ready",
      resolved,
      records: merged,
      history,
      dirty: [...drafts.keys()],
      saving,
      saveErrors,
    },
    actions,
  ];
}
