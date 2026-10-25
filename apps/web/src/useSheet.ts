// Loads a character's sheet records and the definitions they use, keeps unsaved edits as
// drafts, resolves everything once per change, and saves drafts together with a history entry.
// Edits change only the fields they touch, so unknown fields survive (Lessons from Character
// Manager). A save against a newer stored version is refused and shown, never forced.
//
// The sheet's own records are watched live (S9). While viewing, saved changes simply appear.
// While editing (`review`), each save made elsewhere waits as a comparison: the editor chooses,
// item by item, the incoming value or their own, and their drafts are rebuilt on the incoming
// version (Campaigns and Shared Data, Concurrent editing and difference review). Saves arriving
// meanwhile queue in order; nothing is combined, and nothing is written by choosing.

import { createEngine } from "@hearthtable/engine";
import { isInScene, type Holds, type Moment } from "@hearthtable/play";
import { holdsRecord } from "./play/actions";
import { gameTimeRecord } from "./play/gameTime";
import type { RecordEnvelope, ResolvedCharacter } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import type { Repository, StorageError } from "@hearthtable/storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { historyRecord } from "./history";
import { settleDrafts } from "./saveDrafts";
import {
  comparison,
  incomingChanges,
  resolvedDrafts,
  type DiffItem,
} from "./sheetDiff";

export const engine = createEngine(hearthtableVanillaPlus);

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

/**
 * Folders are ordinary (2026-10-24), so a character reads definitions from its owner's whole
 * account. Other characters there, with their tabs and history, are left out: another sheet must
 * never be resolved as this one.
 */
function withoutOtherCharacters(
  records: readonly RecordEnvelope[],
  characterId: string,
): RecordEnvelope[] {
  const others = records
    .filter((r) => r.kind === "character" && r.id !== characterId)
    .map((r) => r.id as string);
  // Scenes and their NPC instances are play history, not definitions (Milestone 5 S2).
  return records.filter(
    (r) =>
      !isInScene(r.id) &&
      !others.some((o) => r.id === o || r.id.startsWith(`${o}/`)),
  );
}

type Data = Record<string, unknown>;
type Records = ReadonlyMap<string, RecordEnvelope>;
const byId = (records: readonly RecordEnvelope[]): Records =>
  new Map(records.map((r) => [r.id as string, r]));
const sameRevisions = (a: Records, b: Records) =>
  a.size === b.size &&
  [...a].every(([id, r]) => b.get(id)?.revision === r.revision);
/** A report older than what is known for some record, such as half of an earlier save. */
const isStale = (known: Records, incoming: Records) =>
  [...incoming].some(([id, r]) => r.revision < (known.get(id)?.revision ?? 0));

export interface HistoryEntry {
  readonly id: string;
  readonly at: string;
  readonly note?: string;
  readonly changed: readonly string[];
}

/** A save made elsewhere while editing, waiting for the editor's choices (S9). */
export interface Comparison {
  readonly items: readonly DiffItem[];
  /** When the incoming save was made, from its records. */
  readonly at: string;
  /** The note saved with it, if its history entry has one. */
  readonly note?: string;
  /** How many more saves are waiting after this one. */
  readonly waiting: number;
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
      readonly comparison?: Comparison;
    };

export interface SheetActions {
  /** Changes one record's data; `change` gets a copy and returns the new data. */
  edit(id: string, change: (data: Data) => Data): void;
  discard(): void;
  save(note: string): Promise<boolean>;
  reload(): void;
  /** Finishes the shown comparison, keeping the editor's value for these item numbers. */
  resolve(keepMine: ReadonlySet<number>): void;
}

/**
 * Sends changed records somewhere other than storage, such as a proposal to a DM (S7); returns an
 * error message, or undefined when they were sent. The drafts are then cleared.
 */
export type Submit = (
  changed: readonly RecordEnvelope[],
  note: string,
) => Promise<string | undefined>;

interface Incoming {
  readonly before: Records;
  readonly after: Records;
}

/** The items a waiting save shows, against the editor's current base and drafts. */
function itemsFor(entry: Incoming, sheet: Records, drafts: Records) {
  const changes = incomingChanges(entry.before, entry.after).filter(
    (c) =>
      (entry.after.get(c.recordId) ?? entry.before.get(c.recordId))?.kind !==
      "history",
  );
  return comparison(changes, (id) => drafts.get(id) ?? sheet.get(id));
}

/**
 * Applies waiting saves from the front of the queue that differ in nothing the editor sees
 * (only history, or values they already have); they need no window.
 */
function settle(queue: readonly Incoming[], sheet: Records, drafts: Records) {
  let q = queue;
  let base = sheet;
  let d = drafts;
  for (
    let head = q[0];
    head && itemsFor(head, base, d).length === 0;
    head = q[0]
  ) {
    d = resolvedDrafts(base, head.after, d, [], new Set());
    base = head.after;
    q = q.slice(1);
  }
  return { queue: q, sheet: base, drafts: d };
}

export function useSheet(
  repo: Repository,
  characterId: string,
  definitionPaths: readonly string[],
  submit?: Submit,
  review = false,
  /** The campaign's current game moment (Milestone 5 S4), so effects whose time is up end. */
  gameNow?: Moment,
  /** What the character's queued requests hold (Milestone 5 S6), so it is not usable. */
  holds?: Holds,
): [SheetState, SheetActions] {
  const [definitions, setDefinitions] = useState<Records | undefined>();
  // The sheet's own records as the editor last accepted them: what drafts are edits of.
  const [sheet, setSheet] = useState<Records | undefined>();
  const [drafts, setDrafts] = useState<Records>(new Map());
  const [queue, setQueue] = useState<readonly Incoming[]>([]);
  const [failure, setFailure] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<readonly StorageError[]>([]);
  const [generation, setGeneration] = useState(0);

  // The latest version seen from storage, and one held back while our own save is in flight.
  const latest = useRef<Records>(new Map());
  const held = useRef<Records | undefined>(undefined);
  const savingRef = useRef(false);
  // The current state, for callbacks from storage that run outside rendering.
  const now = useRef({ review, queue, sheet, drafts });
  useEffect(() => {
    now.current = { review, queue, sheet, drafts };
  }, [review, queue, sheet, drafts]);

  const receive = useCallback((incoming: Records) => {
    if (sameRevisions(latest.current, incoming)) return;
    if (isStale(latest.current, incoming)) return;
    if (savingRef.current) {
      held.current = incoming;
      return;
    }
    const before = latest.current;
    latest.current = incoming;
    const { review: editing, queue: q, sheet: base, drafts: d } = now.current;
    if (!editing || !base) {
      now.current = { ...now.current, sheet: incoming };
      return setSheet(incoming);
    }
    const next = settle([...q, { before, after: incoming }], base, d);
    // Kept current at once, in case another report arrives before the next render.
    now.current = { ...now.current, ...next };
    setQueue(next.queue);
    setSheet(next.sheet);
    setDrafts(next.drafts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    latest.current = new Map();
    const stop = repo.watchUnder(
      characterId,
      (records) => {
        if (cancelled) return;
        const incoming = byId(records);
        if (!first) return receive(incoming);
        first = false;
        latest.current = incoming;
        void (async () => {
          const paths = [
            ...definitionPaths,
            ...referencedCampaigns(records, characterId),
          ];
          const lists = await Promise.all(paths.map((p) => repo.listUnder(p)));
          if (cancelled) return;
          const map = new Map<string, RecordEnvelope>();
          for (const list of lists) {
            if (!list.ok) {
              setFailure(list.errors.map((e) => e.message).join("\n"));
              return;
            }
            for (const r of withoutOtherCharacters(list.value, characterId))
              if (r.id !== characterId && !r.id.startsWith(`${characterId}/`))
                map.set(r.id, r);
          }
          setFailure(undefined);
          setDefinitions(map);
          setSheet(latest.current);
          setQueue([]);
          setDrafts(new Map());
          setSaveErrors([]);
        })();
      },
      (message) => !cancelled && setFailure(message),
    );
    return () => {
      cancelled = true;
      stop();
    };
  }, [repo, characterId, definitionPaths, generation, receive]);

  const stored = useMemo(() => {
    if (!definitions || !sheet) return undefined;
    const m = new Map(definitions);
    for (const [id, r] of sheet) m.set(id, r);
    return m;
  }, [definitions, sheet]);

  const merged = useMemo(() => {
    if (!stored) return undefined;
    const m = new Map(stored);
    for (const [id, r] of drafts) m.set(id, r);
    return m;
  }, [stored, drafts]);

  // The comparison shown now: the oldest waiting save, against the editor's local values.
  const current = queue[0];
  const items = useMemo(
    () => (current && sheet ? itemsFor(current, sheet, drafts) : []),
    [current, sheet, drafts],
  );

  const resolve = useCallback(
    (keepMine: ReadonlySet<number>) => {
      if (!current || !sheet) return;
      const next = settle(
        queue.slice(1),
        current.after,
        resolvedDrafts(sheet, current.after, drafts, items, keepMine),
      );
      setQueue(next.queue);
      setSheet(next.sheet);
      setDrafts(next.drafts);
    },
    [current, sheet, drafts, items, queue],
  );

  // One resolution per change; every view renders from it.
  const clock = gameNow?.clock;
  const step = gameNow?.step;
  const heldKey = holds ? JSON.stringify(holds) : "";
  const resolved = useMemo(
    () =>
      merged
        ? engine.resolve([
            ...[...merged.values()].filter((r) => r.kind !== "history"),
            ...(clock !== undefined && step !== undefined
              ? [gameTimeRecord({ clock, step })]
              : []),
            ...(heldKey ? [holdsRecord(JSON.parse(heldKey) as Holds)] : []),
          ])
        : undefined,
    [merged, clock, step, heldKey],
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
        const failed = await submit([...sent.values()], note);
        setSaving(false);
        if (failed) {
          setSaveErrors([{ code: "unavailable", message: failed }]);
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
      const at = new Date().toISOString();
      const entry = historyRecord(
        characterId,
        stored?.get(characterId)?.origin ?? { scope: "account" },
        [...sent.keys()],
        note,
        at,
      );
      savingRef.current = true;
      const result = await repo.save([...sent.values(), entry], { now: at });
      savingRef.current = false;
      setSaving(false);
      if (result.ok) {
        // Our own save comes back from storage too; it is not someone else's change.
        const mine = new Map(latest.current);
        for (const r of result.value) mine.set(r.id, r);
        latest.current = mine;
        const base = new Map(now.current.sheet);
        for (const r of result.value) base.set(r.id, r);
        const d = settleDrafts(now.current.drafts, sent, result.value);
        now.current = { ...now.current, sheet: base, drafts: d };
        setSheet(base);
        setDrafts(d);
        setSaveErrors([]);
      } else setSaveErrors(result.errors);
      // Anything that arrived meanwhile is handled now, against the saved version.
      const waiting = held.current;
      held.current = undefined;
      if (waiting) receive(waiting);
      return result.ok;
    },
    [drafts, repo, characterId, stored, submit, receive],
  );

  const actions: SheetActions = {
    edit,
    save,
    discard: () => {
      setDrafts(new Map());
      setSaveErrors([]);
    },
    reload: () => setGeneration((g) => g + 1),
    resolve,
  };

  if (failure) return [{ status: "failed", message: failure }, actions];
  if (!merged || !resolved) return [{ status: "loading" }, actions];
  if (!merged.has(characterId)) return [{ status: "missing" }, actions];
  const note = current
    ? [...current.after.values()].find(
        (r) => r.kind === "history" && !current.before.has(r.id),
      )?.data
    : undefined;
  return [
    {
      status: "ready",
      resolved,
      records: merged,
      history,
      dirty: [...drafts.keys()],
      saving,
      saveErrors,
      ...(current && items.length > 0
        ? {
            comparison: {
              items,
              at:
                [...current.after.values()]
                  .map((r) => r.updatedAt)
                  .sort()
                  .at(-1) ?? "",
              ...(typeof (note as { note?: unknown } | undefined)?.note ===
              "string"
                ? { note: (note as { note: string }).note }
                : {}),
              waiting: queue.length - 1,
            },
          }
        : {}),
    },
    actions,
  ];
}
