// The record envelope shared by every stored record. Parsing never invents values: a missing
// or malformed field is an error, and any field this code does not know is carried through
// unchanged so a no-change round trip is lossless (Lessons from Character Manager).

import { parseId, type RecordId } from "./ids";
import { fail, issue, ok, type Issue, type Result } from "./validation";

/** How official or trustworthy a definition is (user decision, 2026-10-22). */
export const SOURCE_STATUSES = [
  "published",
  "playtest",
  "homebrew",
  "proposed",
  "unresolved",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** Which data scope owns the record, as in Campaigns and Shared Data. */
export const ORIGIN_SCOPES = ["core", "campaign", "account"] as const;
export type OriginScope = (typeof ORIGIN_SCOPES)[number];

export interface RecordOrigin {
  readonly scope: OriginScope;
  /** The owning campaign or account; absent for core content. */
  readonly ownerId?: string;
}

export interface RecordSource {
  readonly status: SourceStatus;
  /** Rules edition, e.g. `2024` or `2014`. */
  readonly edition?: string;
  /** Free-text confidence note, e.g. `secondary source`. */
  readonly confidence?: string;
  /** Book, page or link the rules came from. */
  readonly reference?: string;
}

export interface RecordEnvelope<TData = unknown> {
  readonly id: RecordId;
  readonly kind: string;
  readonly moduleId: string;
  readonly schemaVersion: number;
  readonly origin: RecordOrigin;
  readonly source: RecordSource;
  readonly revision: number;
  /** ISO 8601 timestamp of the last change. */
  readonly updatedAt: string;
  /** Module-owned payload. The kernel stores it as given; modules must edit it, never rebuild it. */
  readonly data: TData;
  /** The object this envelope was parsed from; unknown fields are restored from it on save. */
  readonly raw: Readonly<Record<string, unknown>>;
}

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function parseEnvelope(input: unknown): Result<RecordEnvelope> {
  if (!isPlain(input))
    return fail([
      issue("error", "envelope.not-object", "A record must be an object."),
    ]);
  const issues: Issue[] = [];
  const need = (key: string, ok: boolean, what: string) => {
    if (!ok)
      issues.push(
        issue("error", "envelope.bad-field", `"${key}" must be ${what}.`, key),
      );
  };

  const {
    id,
    kind,
    moduleId,
    schemaVersion,
    origin,
    source,
    revision,
    updatedAt,
  } = input;
  need(
    "id",
    typeof id === "string" && parseId(id).ok,
    'a "<scope>:<name>" identity',
  );
  need("kind", typeof kind === "string" && kind !== "", "a non-empty string");
  need(
    "moduleId",
    typeof moduleId === "string" && moduleId !== "",
    "a non-empty string",
  );
  need(
    "schemaVersion",
    Number.isInteger(schemaVersion) && (schemaVersion as number) >= 1,
    "an integer of at least 1",
  );
  need(
    "revision",
    Number.isInteger(revision) && (revision as number) >= 0,
    "an integer of at least 0",
  );
  need(
    "updatedAt",
    typeof updatedAt === "string" && !Number.isNaN(Date.parse(updatedAt)),
    "an ISO 8601 timestamp",
  );
  if (!("data" in input))
    issues.push(
      issue("error", "envelope.bad-field", '"data" is missing.', "data"),
    );

  let parsedOrigin: RecordOrigin | undefined;
  if (
    !isPlain(origin) ||
    !ORIGIN_SCOPES.includes(origin["scope"] as OriginScope)
  ) {
    issues.push(
      issue(
        "error",
        "envelope.bad-field",
        `"origin.scope" must be one of ${ORIGIN_SCOPES.join(", ")}.`,
        "origin.scope",
      ),
    );
  } else if (
    origin["ownerId"] !== undefined &&
    typeof origin["ownerId"] !== "string"
  ) {
    issues.push(
      issue(
        "error",
        "envelope.bad-field",
        '"origin.ownerId" must be a string.',
        "origin.ownerId",
      ),
    );
  } else {
    parsedOrigin = withOptional(
      { scope: origin["scope"] as OriginScope },
      "ownerId",
      origin["ownerId"],
    );
  }

  let parsedSource: RecordSource | undefined;
  if (
    !isPlain(source) ||
    !SOURCE_STATUSES.includes(source["status"] as SourceStatus)
  ) {
    issues.push(
      issue(
        "error",
        "envelope.bad-status",
        `"source.status" must be one of ${SOURCE_STATUSES.join(", ")}.`,
        "source.status",
      ),
    );
  } else {
    let s: RecordSource = { status: source["status"] as SourceStatus };
    for (const key of ["edition", "confidence", "reference"] as const) {
      const v = source[key];
      if (v !== undefined && typeof v !== "string") {
        issues.push(
          issue(
            "error",
            "envelope.bad-field",
            `"source.${key}" must be a string.`,
            `source.${key}`,
          ),
        );
      } else {
        s = withOptional(s, key, v);
      }
    }
    parsedSource = s;
  }

  if (
    issues.length > 0 ||
    parsedOrigin === undefined ||
    parsedSource === undefined
  )
    return fail(issues);
  return ok({
    id: id as RecordId,
    kind: kind as string,
    moduleId: moduleId as string,
    schemaVersion: schemaVersion as number,
    origin: parsedOrigin,
    source: parsedSource,
    revision: revision as number,
    updatedAt: updatedAt as string,
    data: structuredClone(input["data"]),
    raw: structuredClone(input),
  });
}

/** Writes the envelope back to a plain object, restoring every field this code did not know. */
export function serializeEnvelope(record: RecordEnvelope): Plain {
  const raw = structuredClone(record.raw) as Plain;
  return {
    ...raw,
    id: record.id,
    kind: record.kind,
    moduleId: record.moduleId,
    schemaVersion: record.schemaVersion,
    origin: mergeKnown(raw["origin"], record.origin, ["scope", "ownerId"]),
    source: mergeKnown(raw["source"], record.source, [
      "status",
      "edition",
      "confidence",
      "reference",
    ]),
    revision: record.revision,
    updatedAt: record.updatedAt,
    data: structuredClone(record.data),
  };
}

/** Starts a brand-new record, with nothing to carry through. */
export function newEnvelope<TData>(
  fields: Omit<RecordEnvelope<TData>, "raw">,
): RecordEnvelope<TData> {
  return { ...fields, raw: {} };
}

function withOptional<T extends object, K extends string>(
  target: T,
  key: K,
  value: unknown,
): T {
  return value === undefined ? target : { ...target, [key]: value };
}

/** Keeps unknown keys from `previous`; known keys take `next`'s value, or are removed if absent. */
function mergeKnown(
  previous: unknown,
  next: object,
  known: readonly string[],
): Plain {
  const kept = isPlain(previous)
    ? Object.entries(previous).filter(([key]) => !known.includes(key))
    : [];
  return { ...Object.fromEntries(kept), ...next };
}
