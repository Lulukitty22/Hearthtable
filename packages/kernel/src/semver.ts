// Just enough semantic versioning for `requires` ranges: `1.2.3`, `^1.2.3`, `>=1.2.3` and `*`.

type Triple = readonly [number, number, number];

export function parseVersion(version: string): Triple | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

function compare(a: Triple, b: Triple): number {
  for (let i = 0; i < 3; i++)
    if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number);
  return 0;
}

export function isValidRange(range: string): boolean {
  return (
    range === "*" || parseVersion(range.replace(/^(\^|>=)/, "")) !== undefined
  );
}

export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  if (!v) return false;
  if (range === "*") return true;
  if (range.startsWith(">=")) {
    const min = parseVersion(range.slice(2));
    return min !== undefined && compare(v, min) >= 0;
  }
  if (range.startsWith("^")) {
    const min = parseVersion(range.slice(1));
    if (!min || compare(v, min) < 0) return false;
    // ^0.y.z only accepts the same minor, as in npm.
    return min[0] === 0 ? v[0] === 0 && v[1] === min[1] : v[0] === min[0];
  }
  const exact = parseVersion(range);
  return exact !== undefined && compare(v, exact) === 0;
}
