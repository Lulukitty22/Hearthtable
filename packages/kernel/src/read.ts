// Reading module data from records. Systems describe the part of a record they own with a Zod
// schema; anything that does not match is reported with its path and the system works with
// what it can, never with invented values. Parsing only reads: records are saved from their
// original data, so fields a schema does not mention are never lost.

import type { z } from "zod";
import type { RecordEnvelope } from "./envelope";
import type { ResolveContext } from "./resolve";
import { fail, issue, ok, type Result } from "./validation";

export function parseWith<S extends z.ZodType>(
  schema: S,
  input: unknown,
  where: string,
): Result<z.infer<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return fail(
    parsed.error.issues.map((i) =>
      issue(
        "error",
        "data.invalid",
        `${where}: ${i.path.length > 0 ? i.path.join(".") + " " : ""}${i.message}`,
        [where, ...i.path.map(String)].join("."),
      ),
    ),
  );
}

/** Parses one field of every record of `kind`, reporting problems once. */
export function readField<S extends z.ZodType>(
  ctx: ResolveContext,
  kind: string,
  field: string,
  schema: S,
): readonly { record: RecordEnvelope; value: z.infer<S> }[] {
  const out: { record: RecordEnvelope; value: z.infer<S> }[] = [];
  for (const record of ctx.ofKind(kind)) {
    const data = record.data as Record<string, unknown> | null;
    const raw =
      typeof data === "object" && data !== null ? data[field] : undefined;
    const parsed = parseWith(schema, raw, `${record.id}.${field}`);
    if (parsed.ok) out.push({ record, value: parsed.value });
    else parsed.issues.forEach((i) => ctx.report(i));
  }
  return out;
}

/** The definition a sheet line points at, parsed with `schema`, or why it is unusable. */
export function readDefinition<S extends z.ZodType>(
  ctx: ResolveContext,
  id: string,
  kind: string,
  schema: S,
):
  | {
      readonly ok: true;
      readonly record: RecordEnvelope;
      readonly value: z.infer<S>;
    }
  | { readonly ok: false; readonly reason: string } {
  const record = ctx.record(id);
  if (!record) return { ok: false, reason: `Reference not found: ${id}` };
  if (record.kind !== kind) {
    return { ok: false, reason: `${id} is a ${record.kind}, not a ${kind}` };
  }
  const parsed = parseWith(schema, record.data, id);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: parsed.issues.map((i) => i.message).join("; "),
    };
  }
  return { ok: true, record, value: parsed.value };
}
