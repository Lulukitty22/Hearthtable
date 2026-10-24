// Loads a character's sheet records and the definitions they use, keeps unsaved edits as
// drafts, resolves everything once per change, and saves drafts together with a history entry.
// Edits change only the fields they touch, so unknown fields survive (Lessons from Character
// Manager). A save against a newer stored version is refused and shown, never forced.

import { createEngine } from "@hearthtable/engine";
import type { RecordEnvelope, ResolvedCharacter } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import type { Repository, StorageError } from "@hearthtable/storage";
import { historyRecord } from "./history";
import { useCallback, useEffect, useMemo, useState } from "react";
import { settleDrafts } from "./saveDrafts";

export const engine = createEngine(hearthtableVanillaPlus);

/**
 * Folders are ordinary (2026-10-24), so a character reads definitions from its owner's whole
 * account. Other characters there, with their tabs and history, are left out: another sheet must
 * never be resolved as this one.
 */
/**
 * The definition gate is one-way (Campaigns and Shared Data, Custom content; 2026-10-24): an
 * account character may use entries from any campaign, so the campaigns its records refer to are
 * loaded too; a campaign character uses only core and its own campaign.
 */
export function referencedCampaigns(
  records: readonly RecordEnvelope[],
  characterId: string,
): string[] {
  if (!characterId.startsWith("account/")) return [];
  const found = new Set<string>();
  for (const r of records)
    for (const m of JSON.stringify(r.data).matchAll(/"(campaign\/[^/"]+)\//g))
      if (m[1]) found.add(m[1]);
  return [...found];
}

function withoutOtherCharacters(
  records: readonly RecordEnvelope[],
  characterId: string,
): RecordEnvelope[] {
  const others = records
    .filter((r) => r.kind === "character" && r.id !== characterId)
    .map((r) => r.id as string);
  return records.filter(
    (r) => !others.some((o) => r.id === o || r.id.startsWith(`${o}/`)),
  );
}

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
/**
 * Sends changed records somewhere other than storage, such as a proposal to a DM (S7); returns an
 * error message, or undefined when they were sent. The drafts are then cleared.
 */
export type Submit = (
  changed: readonly RecordEnvelope[],
  note: string,
) => Promise<string | undefined>;

export function useSheet(
  repo: Repository,
  characterId: string,
  definitionPaths: readonly string[],
  submit?: Submit,
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
      const own = await repo.listUnder(characterId);
      const referenced = own.ok
        ? referencedCampaigns(own.value, characterId)
        : [];
      const lists = [
        own,
        ...(await Promise.all(
          [...definitionPaths, ...referenced].map((p) => repo.listUnder(p)),
        )),
      ];
      if (cancelled) return;
      const map = new Map<string, RecordEnvelope>();
      for (const list of lists) {
        if (!list.ok) {
          setFailure(list.errors.map((e) => e.message).join("\n"));
          return;
        }
        for (const r of withoutOtherCharacters(list.value, characterId))
          map.set(r.id, r);
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
      if (submit) {
        const failure = await submit([...sent.values()], note);
        setSaving(false);
        if (failure) {
          setSaveErrors([{ code: "unavailable", message: failure }]);
          return false;
        }
        // Edits made while sending stay as drafts; the rest went to the DM.
        setDrafts(
          (current) =>
            new Map([...current].filter(([id, d]) => d !== sent.get(id))),
        );
        setSaveErrors([]);
        return true;
      }
      const now = new Date().toISOString();
      const entry = historyRecord(
        characterId,
        stored?.get(characterId)?.origin ?? { scope: "account" },
        [...sent.keys()],
        note,
        now,
      );
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
    [drafts, repo, characterId, stored, submit],
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
