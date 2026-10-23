// `pnpm srd:spells`: copies spell text and header facts from the System Reference Document 5.2.1
// into `content/core/spells.json` (Spell Effects and Active State, "Spell details and display").
// SRD 5.2.1 is © Wizards of the Coast, released under CC-BY-4.0, so its text may be copied with
// credit. The PDF is kept out of Git in `reference/`; make the text file it reads with
//   pdftotext reference/SRD_CC_v5.2.1.pdf reference/srd-flow.txt
//
// For each spell record whose name is in the SRD, this writes `data.srd` (the full text as
// paragraphs, plus any stat block or table lines) and the facts on the spell's header lines:
// casting time, ritual, range, components, duration and concentration. It also adds the spells
// named in ADD as new core records. Fields it does not own (summary, effect facts, classes) are
// kept as they are. Class lists are checked, not overwritten: the SRD has no Artificer.

import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "reference/srd-flow.txt";
const TARGET = "content/core/spells.json";
const CREDIT =
  "This work includes material from the System Reference Document 5.2.1 (SRD 5.2.1) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.";

/** Test spells for Carol's overflow book: rituals and costly or consumed components. */
const ADD = [
  "Alarm",
  "Find Familiar",
  "Arcane Lock",
  "Tiny Hut",
  "Glyph of Warding",
  "Revivify",
  "Telepathic Bond",
  "Teleportation Circle",
];

/** Records named differently from the SRD (the SRD drops character names). */
const SRD_NAME: Record<string, string> = {};

interface Parsed {
  name: string;
  level: number;
  school: string;
  classes: string[];
  castingTime: string;
  ritual: boolean;
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: string | null;
    costGp: number | null;
    consumed: boolean;
  };
  duration: string;
  concentration: boolean;
  paragraphs: string[];
  block: string[];
}

/** Rejoins words hyphenated at a line end, which come out as "profi- ciency". */
const dehyphen = (t: string) => t.replace(/(\p{Ll})- (\p{Ll})/gu, "$1$2");

const FOOTER = /^(\d+\s*)?(System Reference Document 5\.2\.1)?(\s*\d+)?$/;
const HEADER = /^(?:Level (\d) (\w+)|(\w+) Cantrip) \(([A-Za-z, ]+)\)$/;

function lines(): string[] {
  const text = readFileSync(SOURCE, "utf-8").replace(/\f/g, "\n");
  const all = text.split(/\r?\n/).map((l) => l.trimEnd());
  const start = all.indexOf("Spell Descriptions");
  if (start < 0) throw new Error(`"Spell Descriptions" not found in ${SOURCE}`);
  const end = all.findIndex((l, i) => i > start && l === "Rules Glossary");
  return all.slice(start + 1, end < 0 ? undefined : end);
}

function parseComponents(raw: string): Parsed["components"] {
  const material = /M \((.*)\)\s*$/.exec(raw)?.[1] ?? null;
  const cost = material
    ? /worth (?:at least )?([\d,]+)\+? GP/i.exec(material)?.[1]
    : undefined;
  return {
    verbal: /^V\b/.test(raw),
    somatic: /\bS\b/.test(raw.replace(/\(.*\)/, "")),
    material,
    costGp: cost ? Number(cost.replace(/,/g, "")) : null,
    consumed: material ? /consumes/i.test(material) : false,
  };
}

function parse(): Map<string, Parsed> {
  const src = lines();
  const spells = new Map<string, Parsed>();
  let i = 0;
  while (i < src.length) {
    const name = src[i]?.trim() ?? "";
    const head = HEADER.exec(src[i + 1]?.trim() ?? "");
    if (!name || !head || !src[i + 2]?.startsWith("Casting Time:")) {
      i++;
      continue;
    }
    // Header facts may wrap over several lines, ending at the Duration value.
    let facts = "";
    let j = i + 2;
    while (j < src.length && !/Duration:/.test(facts)) facts += ` ${src[j++]}`;
    const m =
      /Casting Time: (.*) Range: (.*) Components?: (.*) Duration: (.*)$/.exec(
        dehyphen(facts.trim().replace(/\s+/g, " ")),
      );
    if (!m) throw new Error(`Could not read the header of ${name}: ${facts}`);
    const [, castingRaw = "", range = "", comps = "", duration = ""] = m;
    // Body: until the next spell's name + header pair.
    const body: string[] = [];
    while (
      j < src.length &&
      !(
        HEADER.test(src[j + 1]?.trim() ?? "") &&
        src[j + 2]?.startsWith("Casting Time:")
      )
    ) {
      body.push(src[j++] ?? "");
    }
    const paragraphs: string[] = [];
    const block: string[] = [];
    // A stat block (such as Animated Object) starts two lines before its "AC n" line.
    const statAt = body.findIndex((l) => /^AC \d+/.test(l.trim()));
    const named = body
      .slice(0, Math.max(statAt, 0))
      .map((l, k) => ({ l: l.trim(), k }))
      .filter((x) => x.l !== "" && !FOOTER.test(x.l));
    const blockFrom = statAt < 0 ? body.length : (named.at(-2)?.k ?? statAt);
    let join = false;
    for (const [k, raw] of body.entries()) {
      const l = raw.trim();
      if (l === "" || FOOTER.test(l)) {
        join = true; // a page or column break: the next line may continue a paragraph
        continue;
      }
      if (l === "MOD SAVE") continue; // stat-block column labels
      if (k >= blockFrom) {
        block.push(l);
      } else if (
        join &&
        paragraphs.length > 0 &&
        !/[.:!?)"”]$/.test(paragraphs[paragraphs.length - 1] ?? "")
      ) {
        paragraphs[paragraphs.length - 1] += ` ${l}`;
      } else {
        paragraphs.push(l);
      }
      join = false;
    }
    const castingTime = castingRaw.replace(/ or Ritual$/, "");
    spells.set(name, {
      name,
      level: head[1] ? Number(head[1]) : 0,
      school: head[2] ?? head[3] ?? "",
      classes: (head[4] ?? "").split(", "),
      castingTime,
      ritual: castingRaw.endsWith("or Ritual"),
      range,
      components: parseComponents(comps.trim()),
      duration: duration.trim(),
      concentration: duration.startsWith("Concentration"),
      paragraphs: paragraphs.map(dehyphen),
      block: block.map(dehyphen),
    });
    i = j;
  }
  return spells;
}

interface SpellRecord {
  id: string;
  kind: string;
  source: Record<string, unknown>;
  data: Record<string, unknown> & { name: string; classes?: string[] };
  [key: string]: unknown;
}

const srd = parse();
const records = JSON.parse(readFileSync(TARGET, "utf-8")) as SpellRecord[];
const template = records[0];
if (!template) throw new Error(`${TARGET} is empty`);
for (const name of ADD) {
  if (records.some((r) => r.data.name === name)) continue;
  const s = srd.get(name);
  if (!s) throw new Error(`${name} is not in the SRD`);
  records.push({
    ...template,
    id: `core/${name.replace(/ /g, "_")}`,
    updatedAt: new Date().toISOString(),
    data: {
      name,
      level: s.level,
      school: s.school,
      classes: s.classes.map((c) => `core/${c}`),
    },
  });
}

const notes: string[] = [];
for (const r of records) {
  const s = srd.get(SRD_NAME[r.data.name] ?? r.data.name);
  if (!s) {
    notes.push(`not in the SRD (summary only): ${r.data.name}`);
    continue;
  }
  if (s.level !== r.data["level"] || s.school !== r.data["school"])
    notes.push(
      `${r.data.name}: level/school ${String(r.data["level"])} ${String(r.data["school"])} vs SRD ${s.level} ${s.school}`,
    );
  const ours = new Set(r.data.classes ?? []);
  const missing = s.classes.filter((c) => !ours.has(`core/${c}`));
  if (missing.length > 0)
    notes.push(`${r.data.name}: SRD class list also has ${missing.join(", ")}`);
  r.data = {
    ...r.data,
    castingTime: s.castingTime,
    ritual: s.ritual,
    range: s.range,
    components: s.components,
    duration: s.duration,
    concentration: s.concentration,
    srd: {
      version: "5.2.1",
      credit: CREDIT,
      paragraphs: s.paragraphs,
      ...(s.block.length > 0 ? { block: s.block } : {}),
    },
  };
  r.source = {
    ...r.source,
    reference:
      "SRD 5.2.1 (CC-BY-4.0) for text and header facts; class lists from the Player's Handbook (2024), checked 2026-10-22",
  };
}

writeFileSync(TARGET, `${JSON.stringify(records, null, 2)}\n`);
console.log(
  `Parsed ${srd.size} SRD spells; ${records.length} records written.`,
);
for (const n of notes) console.log(`  ${n}`);
