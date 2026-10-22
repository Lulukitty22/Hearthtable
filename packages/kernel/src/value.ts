// Resolved values. Every number carries an explanation trail, and a value that cannot be worked
// out is visibly `unresolved` rather than a usable-looking default.

export interface Explanation {
  readonly label: string;
  /** Display value, e.g. `16` or `+3`. */
  readonly value?: string;
  readonly parts?: readonly Explanation[];
  /** Extra context, e.g. `authored` or `while attuned and held`. */
  readonly note?: string;
}

export interface Known<T> {
  readonly kind: "known";
  readonly value: T;
  readonly explain: Explanation;
}

export interface Unresolved {
  readonly kind: "unresolved";
  readonly reason: string;
  readonly explain?: Explanation;
}

export type Value<T> = Known<T> | Unresolved;

export function known<T>(
  value: T,
  label: string,
  extra: Omit<Explanation, "label" | "value"> = {},
): Known<T> {
  return {
    kind: "known",
    value,
    explain: { label, ...display(value), ...extra },
  };
}

export function unresolved(reason: string, explain?: Explanation): Unresolved {
  return explain === undefined
    ? { kind: "unresolved", reason }
    : { kind: "unresolved", reason, explain };
}

export function isKnown<T>(v: Value<T>): v is Known<T> {
  return v.kind === "known";
}

/** Adds numeric parts. Any unresolved part makes the total unresolved, naming the parts. */
export function sum(
  label: string,
  parts: readonly Value<number>[],
): Value<number> {
  const missing = parts.filter((p): p is Unresolved => p.kind === "unresolved");
  if (missing.length > 0) {
    return unresolved(
      `${label} depends on unresolved values: ${missing.map((m) => m.reason).join("; ")}`,
    );
  }
  const knownParts = parts as readonly Known<number>[];
  const total = knownParts.reduce((acc, p) => acc + p.value, 0);
  return known(total, label, { parts: knownParts.map((p) => p.explain) });
}

/** One-line form, e.g. `AC 16 = Mage Armor 13 + DEX +3`. */
export function formatExplanation(e: Explanation): string {
  const head = e.value === undefined ? e.label : `${e.label} ${e.value}`;
  const note = e.note ? ` (${e.note})` : "";
  if (!e.parts || e.parts.length === 0) return head + note;
  const parts = e.parts
    .map(
      (p) =>
        (p.value === undefined ? p.label : `${p.label} ${p.value}`) +
        (p.note ? ` (${p.note})` : ""),
    )
    .join(" + ");
  return `${head} = ${parts}${note}`;
}

/** Only plain values get a display value; lists and objects describe themselves in `note`. */
function display(value: unknown): { value?: string } {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? { value: String(value) }
    : {};
}
