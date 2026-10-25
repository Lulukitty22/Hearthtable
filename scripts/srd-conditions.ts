// `pnpm srd:conditions`: writes the fifteen 2024 conditions from the System Reference Document
// 5.2.1 into `content/core/conditions.json` (Turns, Encounters and Time, "Conditions"). SRD
// 5.2.1 is © Wizards of the Coast, released under CC-BY-4.0, so its text may be copied with
// credit. It reads `reference/srd-flow.txt`, made from the PDF kept out of Git:
//   pdftotext reference/SRD_CC_v5.2.1.pdf reference/srd-flow.txt
//
// Each record carries the full rules text and what the app automates, as data the `conditions`
// system reads: other conditions it includes, grants while it applies, and whether it breaks
// Concentration. Everything else is shown and applied by hand.

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "reference/srd-flow.txt";
const TARGET = "content/core/conditions.json";
const CREDIT =
  "This work includes material from the System Reference Document 5.2.1 (SRD 5.2.1) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

const NAMES = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const;

const ref = (name: string) => `core/Conditions/${name}`;
const autoFailStrDex = [
  { type: "capability", id: "auto-fail:saves.str" },
  { type: "capability", id: "auto-fail:saves.dex" },
];

/** What the app automates for each condition; the rest of its text is applied by hand. */
const AUTOMATED: Partial<Record<(typeof NAMES)[number], object>> = {
  Exhaustion: {
    levels: true,
    whileApplied: [
      {
        type: "bonus",
        target: "d20-tests",
        amount: { key: "conditions.exhaustion.level", times: -2 },
      },
    ],
  },
  Incapacitated: { breaksConcentration: true },
  Paralyzed: {
    includes: [ref("Incapacitated")],
    whileApplied: autoFailStrDex,
  },
  Petrified: {
    includes: [ref("Incapacitated")],
    // Resistance to all damage (Milestone 5 S7 applies damage).
    whileApplied: [
      ...autoFailStrDex,
      { type: "capability", id: "resistance:all" },
    ],
  },
  Stunned: { includes: [ref("Incapacitated")], whileApplied: autoFailStrDex },
  Unconscious: {
    includes: [ref("Incapacitated"), ref("Prone")],
    whileApplied: autoFailStrDex,
  },
};

const lines = readFileSync(SOURCE, "utf8").split(/\r?\n/);
const pageNoise = (l: string) =>
  l.trim() === "" ||
  /^\d+$/.test(l.trim()) ||
  l.trim() === "System Reference Document 5.2.1" ||
  /^\d+\s+System Reference Document 5\.2\.1$/.test(l.trim());

function textOf(name: string): string[] {
  const start = lines.findIndex((l) => l.trim() === `${name} [Condition]`);
  if (start < 0) throw new Error(`${name} is not in the SRD text.`);
  const out: string[] = [];
  for (const raw of lines.slice(start + 1)) {
    if (pageNoise(raw)) continue;
    const l = raw.trim();
    // Rules lines open with "While you have", a bolded name ending in a full stop, or continue
    // the previous line; the next glossary entry is a bare title.
    const rule =
      l.startsWith("While ") || /^[A-Z][A-Za-z0-9' -]{1,40}\. /.test(l);
    if (!rule && out.length > 0 && !/[.:]$/.test(out.at(-1) as string)) {
      out[out.length - 1] += ` ${l}`;
      continue;
    }
    if (!rule) break;
    out.push(l);
  }
  return out.map((p) => p.replace(/\s+/g, " "));
}

const records = NAMES.map((name) => ({
  id: ref(name),
  kind: "condition",
  moduleId: "conditions",
  schemaVersion: 1,
  origin: { scope: "core" },
  source: {
    status: "published",
    edition: "2024",
    reference: "SRD 5.2.1 (CC-BY-4.0), Rules Glossary",
  },
  revision: 0,
  updatedAt: "2026-10-25T09:00:00.000Z",
  data: {
    name,
    ...(AUTOMATED[name] ?? {}),
    srd: { version: "5.2.1", credit: CREDIT, text: textOf(name) },
  },
}));

writeFileSync(TARGET, JSON.stringify(records, null, 2) + "\n");
console.log(
  records
    .map((r) => `${r.data.name}: ${r.data.srd.text.length} lines`)
    .join("\n"),
);
