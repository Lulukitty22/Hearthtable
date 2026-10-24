// What an account folder holds, and the records that New, Copy as and Delete write (Milestone 4,
// S4). Folders are ordinary (user decision, 2026-10-24): a folder is a `folder` record, or just a
// path segment that has entries below it (like VR_Lulu's Characters and Items). A character's
// tabs and history sit under its own path and are part of it, not entries of the folder.

import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { displayNameOf, segmentFor } from "./names";

export type EntryKind = "folder" | "character" | "item" | "spell" | "feature";
export const NEW_KINDS: readonly EntryKind[] = [
  "folder",
  "character",
  "item",
  "spell",
  "feature",
];

export interface FolderEntry {
  readonly path: string;
  readonly segment: string;
  readonly name: string;
  readonly kind: EntryKind | "other";
}

const ENTRY_KINDS = new Set<string>(NEW_KINDS);

const nameOf = (r: RecordEnvelope | undefined, segment: string) =>
  String((r?.data as { name?: unknown } | undefined)?.name ?? "") ||
  displayNameOf(segment);

/** The record at `path` and everything under it. */
export function subtree(
  path: string,
  records: readonly RecordEnvelope[],
): RecordEnvelope[] {
  return records.filter((r) => r.id === path || r.id.startsWith(`${path}/`));
}

/** The entries directly inside a folder: folders first, then by name. */
export function childrenOf(
  folderPath: string,
  records: readonly RecordEnvelope[],
): FolderEntry[] {
  const byId = new Map(records.map((r) => [r.id as string, r]));
  const children = new Map<string, FolderEntry>();
  for (const r of records) {
    if (!r.id.startsWith(`${folderPath}/`)) continue;
    const segment = r.id.slice(folderPath.length + 1).split("/")[0] ?? "";
    const path = `${folderPath}/${segment}`;
    if (children.has(path)) continue;
    const own = byId.get(path);
    const kind = own
      ? ENTRY_KINDS.has(own.kind)
        ? (own.kind as EntryKind)
        : "other"
      : "folder";
    children.set(path, { path, segment, name: nameOf(own, segment), kind });
  }
  return [...children.values()].sort(
    (a, b) =>
      Number(b.kind === "folder") - Number(a.kind === "folder") ||
      a.name.localeCompare(b.name),
  );
}

/** Every folder in an account, its home included, for choosing where a copy goes. */
export function foldersIn(
  accountRoot: string,
  records: readonly RecordEnvelope[],
): string[] {
  const byId = new Map(records.map((r) => [r.id as string, r]));
  const folders = new Set([accountRoot]);
  for (const r of records) {
    if (!r.id.startsWith(`${accountRoot}/`)) continue;
    if (r.kind === "folder") folders.add(r.id);
    const segments = r.id.slice(accountRoot.length + 1).split("/");
    let path = accountRoot;
    for (const segment of segments.slice(0, -1)) {
      path = `${path}/${segment}`;
      const own = byId.get(path);
      if (own && own.kind !== "folder") break;
      folders.add(path);
    }
  }
  return [...folders].sort();
}

/** A 1:1 copy of an entry and everything under it at a new path; nothing in the data changes. */
export function copiedRecords(
  records: readonly RecordEnvelope[],
  from: string,
  to: string,
): RecordEnvelope[] {
  return subtree(from, records).map((r) => ({
    ...r,
    id: `${to}${r.id.slice(from.length)}` as RecordId,
    revision: 0,
  }));
}

const now = () => new Date().toISOString();

function envelope(
  id: string,
  kind: string,
  moduleId: string,
  owner: string,
  data: Record<string, unknown>,
): RecordEnvelope {
  return {
    id: id as RecordId,
    kind,
    moduleId,
    schemaVersion: 1,
    origin: { scope: "account", ownerId: owner },
    source: { status: "homebrew" },
    revision: 0,
    updatedAt: now(),
    data,
    raw: {},
  };
}

const MODULE_FOR: Record<"item" | "spell" | "feature", string> = {
  item: "containers",
  spell: "spellcasting",
  feature: "features",
};

/**
 * The records New writes for `kind` named `name` in `folderPath` of `owner`'s account. A
 * character is a blank sheet with only a name and an empty inventory (no classes, abilities of
 * 10); a custom item, spell or feature has only a name and a description and grants nothing.
 */
export function newRecords(
  kind: EntryKind,
  folderPath: string,
  owner: string,
  name: string,
  description: string,
): RecordEnvelope[] {
  const path = `${folderPath}/${segmentFor(name)}`;
  const shown = name.trim();
  if (kind === "folder")
    return [envelope(path, "folder", "account", owner, { name: shown })];
  if (kind === "character")
    return [
      envelope(path, "character", "dnd5e-2024", owner, {
        name: shown,
        classLevels: [],
        abilities: {
          base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        },
        features: [],
        hitPoints: { current: 0, temporary: 0 },
        activeEffects: [],
      }),
      envelope(`${path}/Inventory`, "inventory", "containers", owner, {
        lines: [],
      }),
    ];
  const text = description.trim();
  return [
    envelope(path, kind, MODULE_FOR[kind], owner, {
      name: shown,
      ...(text ? { description: text } : {}),
    }),
  ];
}
