// Names of folders, characters and custom entries (Campaigns and Shared Data): a name becomes
// the last segment of the record's path with spaces as underscores, keeps its capitals, and is
// refused when the destination already has the same name ignoring capitals and spaces versus
// underscores, or when it is a word the addresses use.

import { ADDRESS_WORDS } from "../routes";

/** The path segment for a name: trimmed, with each run of spaces as one underscore. */
export function segmentFor(name: string): string {
  return name.trim().replace(/ +/g, "_");
}

/** The form two names share when they count as the same. */
export function sameNameKey(name: string): string {
  return segmentFor(name).toLowerCase();
}

/** The name shown for a path segment: underscores read as spaces. */
export function displayNameOf(segment: string): string {
  return segment.replaceAll("_", " ");
}

/**
 * Why `name` cannot be used in a destination already holding `taken` (their path segments), or
 * undefined when it can.
 */
export function nameProblem(
  name: string,
  taken: readonly string[],
): string | undefined {
  const segment = segmentFor(name);
  if (!segment) return "Enter a name.";
  if (segment.length > 100) return "A name can have at most 100 characters.";
  if (/[/\\]/.test(segment)) return "A name cannot contain / or \\.";
  if (/^\.+$/.test(segment)) return "A name cannot be only dots.";
  const key = sameNameKey(name);
  const word = ADDRESS_WORDS.find((w) => w.toLowerCase() === key);
  if (word)
    return `"${word}" is used in web addresses, so it cannot be a name.`;
  const clash = taken.find((t) => sameNameKey(t) === key);
  if (clash)
    return `${displayNameOf(clash)} is already here. Capitals do not count, and spaces and underscores are the same.`;
  return undefined;
}
