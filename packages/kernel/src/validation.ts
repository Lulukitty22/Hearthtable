// Validation results. Problems are reported, never papered over with defaults.

export type Severity = "error" | "warning" | "info";

export interface Issue {
  readonly severity: Severity;
  /** Stable machine-readable code, e.g. `envelope.missing-field`. */
  readonly code: string;
  readonly message: string;
  /** Where the problem is, e.g. `source.status` or `modules.armor-class`. */
  readonly path?: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T; readonly issues: readonly Issue[] }
  | { readonly ok: false; readonly issues: readonly Issue[] };

export function ok<T>(value: T, issues: readonly Issue[] = []): Result<T> {
  return { ok: true, value, issues };
}

export function fail<T = never>(issues: readonly Issue[]): Result<T> {
  return { ok: false, issues };
}

export function issue(
  severity: Severity,
  code: string,
  message: string,
  path?: string,
): Issue {
  return path === undefined
    ? { severity, code, message }
    : { severity, code, message, path };
}

export function hasErrors(issues: readonly Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
