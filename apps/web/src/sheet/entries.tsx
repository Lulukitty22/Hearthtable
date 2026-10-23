// Opening any entry — a feature, spell, item or class — in one panel, wherever it is mentioned
// (user decision, 2026-10-22). Links inside an entry open the linked entry; Back returns.

import type { BookView } from "@hearthtable/system-spellbook-readiness";
import { applyChoices, parseGrants } from "@hearthtable/kernel";
import { createContext, useContext, useState, type ReactNode } from "react";
import { describeGrants, type Described } from "./describe";
import { AllFields, DetailPanel, SourceLine } from "./Grid";
import { known, type TabProps } from "./shared";

export type OpenEntry = (id: string, context?: EntryContextInfo) => void;

/** Where an entry was opened from, when that adds this character's own details. */
export interface EntryContextInfo {
  /** For a feature: the choices this character made, and where it came from. */
  readonly choices?: Readonly<Record<string, string>>;
  readonly from?: string;
}

const Ctx = createContext<OpenEntry>(() => undefined);

export const useOpenEntry = () => useContext(Ctx);

export function nameOfRecord(props: TabProps, id: string): string {
  const name = (props.records.get(id)?.data as { name?: unknown } | undefined)
    ?.name;
  return typeof name === "string"
    ? name
    : (id.split("/").pop()?.replace(/_/g, " ") ?? id);
}

/** A clickable mention of another entry. */
export function EntryLink({
  id,
  props,
  children,
}: {
  id: string;
  props: TabProps;
  children?: ReactNode;
}) {
  const open = useOpenEntry();
  const exists = props.records.has(id);
  return (
    <button
      type="button"
      className={`entry-link${exists ? "" : " missing"}`}
      onClick={() => open(id)}
      title={exists ? undefined : `Reference not found: ${id}`}
    >
      {children ?? nameOfRecord(props, id)}
    </button>
  );
}

function Lines({
  lines,
  props,
}: {
  lines: readonly Described[];
  props: TabProps;
}) {
  return (
    <ul>
      {lines.map((l, i) => (
        <li key={i}>
          {l.ref ? (
            <EntryLink id={l.ref} props={props}>
              {l.text}
            </EntryLink>
          ) : (
            l.text
          )}
        </li>
      ))}
    </ul>
  );
}

function FeatureBody({
  props,
  data,
  context,
}: {
  props: TabProps;
  data: Record<string, unknown>;
  context?: EntryContextInfo;
}) {
  const nameOf = (id: string) => nameOfRecord(props, id);
  const choices = context?.choices ?? {};
  const parsed = parseGrants(data["grants"], "grants");
  const grants = parsed.ok
    ? parsed.value
        .map((g) => applyChoices(g, choices))
        .flatMap((r) => (r.ok ? [r.value] : []))
    : [];
  return (
    <>
      {context?.from && <p className="muted">From {context.from}</p>}
      {Object.keys(choices).length > 0 && (
        <>
          <h3>Choices made</h3>
          <ul>
            {Object.entries(choices).map(([k, v]) => (
              <li key={k}>
                {k}:{" "}
                {v.includes("/") ? (
                  <EntryLink id={v} props={props} />
                ) : (
                  v.replace(/-/g, " ")
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {grants.length > 0 ? (
        <>
          <h3>Grants</h3>
          <Lines lines={describeGrants(grants, nameOf)} props={props} />
        </>
      ) : (
        <p className="muted">
          No automated effects; the rule text applies at the table.
        </p>
      )}
    </>
  );
}

interface Components {
  readonly verbal: boolean;
  readonly somatic: boolean;
  readonly material: string | null;
  readonly costGp: number | null;
  readonly consumed: boolean;
}

interface SpellEffect {
  readonly attack?: string;
  readonly save?: { readonly ability: string; readonly success: string };
  readonly damage?: readonly {
    readonly dice: string;
    readonly type: string;
    readonly per?: string;
    readonly count?: number;
  }[];
  readonly healing?: { readonly dice: string; readonly addsModifier: boolean };
  readonly area?: string;
  readonly acBonus?: number;
  readonly acBase?: string;
  readonly scaling?: {
    readonly kind: "cantrip" | "slot";
    readonly dice?: readonly string[];
    readonly per?: string;
    readonly of?: string;
    readonly note?: string;
  };
  readonly review?: string;
}

function componentText(c: Components): string {
  const parts = [c.verbal && "V", c.somatic && "S", c.material && "M"].filter(
    Boolean,
  );
  return `${parts.join(", ")}${c.material ? ` (${c.material})` : ""}`;
}

function scalingText(s: NonNullable<SpellEffect["scaling"]>, level: number) {
  if (s.note) return s.note;
  if (s.kind === "cantrip" && s.dice)
    return `${s.of ?? "damage"} ${s.dice.join(" / ")} at levels 1 / 5 / 11 / 17`;
  return `+${s.per ?? "?"} ${s.of ?? "damage"} per slot level above ${level}`;
}

/** The facts stored on a spell definition, as a table (Spell details and display). */
function SpellFacts({ data }: { data: Record<string, unknown> }) {
  const c = data["components"] as Components | undefined;
  const e = (data["effect"] as SpellEffect | undefined) ?? {};
  const level = (data["level"] as number | undefined) ?? 0;
  const rows: [string, ReactNode][] = [];
  const add = (label: string, v: unknown) => {
    if (v !== undefined && v !== null && v !== "")
      rows.push([label, v as ReactNode]);
  };
  add("Casting time", data["castingTime"] as string | undefined);
  add("Range", data["range"] as string | undefined);
  if (c)
    add(
      "Components",
      <>
        {componentText(c)}
        {c.costGp !== null && (
          <span className="badge warn">
            {c.costGp}+ gp{c.consumed ? ", consumed" : ""}
          </span>
        )}
      </>,
    );
  add("Duration", data["duration"] as string | undefined);
  add(
    "Attack",
    e.attack &&
      `${e.attack === "weapon" ? "weapon" : `${e.attack} spell`} attack`,
  );
  add(
    "Save",
    e.save &&
      `${e.save.ability.toUpperCase()} save${e.save.success === "half" ? ", half on success" : ""}`,
  );
  add(
    "Damage",
    e.damage
      ?.map(
        (d) =>
          `${d.dice} ${d.type}${d.count ? ` × ${d.count} ${d.per ?? ""}s` : ""}`,
      )
      .join(" + "),
  );
  add(
    "Healing",
    e.healing &&
      `${e.healing.dice}${e.healing.addsModifier ? " + spellcasting modifier" : ""}`,
  );
  add("AC", e.acBase ? `base ${e.acBase}` : e.acBonus && `+${e.acBonus}`);
  add("Area", e.area);
  add(
    level === 0 ? "Cantrip upgrade" : "Higher levels",
    e.scaling && scalingText(e.scaling, level),
  );
  if (rows.length === 0) return null;
  return (
    <>
      <table className="spell-facts">
        <tbody>
          {rows.map(([label, v]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {e.review === "unreviewed" && (
        <p className="muted">
          Effect facts were entered from the text and are not yet reviewed.
        </p>
      )}
    </>
  );
}

/** The SRD 5.2.1 rules text, expandable, with its CC-BY credit. */
function SrdText({ data }: { data: Record<string, unknown> }) {
  const srd = data["srd"] as
    | {
        version: string;
        credit: string;
        paragraphs: readonly string[];
        block?: readonly string[];
      }
    | undefined;
  if (!srd)
    return (
      <p className="muted">
        Not in the SRD 5.2.1; summary only (see the source above).
      </p>
    );
  return (
    <details className="srd-text">
      <summary>Full text (SRD {srd.version})</summary>
      {srd.paragraphs.map((t, i) => {
        // The SRD starts some paragraphs with a short run-in label, such as "Cantrip Upgrade."
        const label =
          /^((?:[A-Z][\w'-]*)(?: [A-Za-z][\w'-]*){0,5})\. (?=[A-Z])/.exec(
            t,
          )?.[1];
        return label ? (
          <p key={i}>
            <strong>{label}.</strong> {t.slice(label.length + 2)}
          </p>
        ) : (
          <p key={i}>{t}</p>
        );
      })}
      {srd.block && <pre className="stat-block">{srd.block.join("\n")}</pre>}
      <p className="credit">{srd.credit}</p>
    </details>
  );
}

function SpellBody({
  props,
  id,
  data,
}: {
  props: TabProps;
  id: string;
  data: Record<string, unknown>;
}) {
  const level = data["level"] as number | undefined;
  const classes = (data["classes"] as string[] | undefined) ?? [];
  const books =
    known(
      props.resolved.get<readonly BookView[]>("spellbook-readiness.books"),
    ) ?? [];
  const inBooks = books.flatMap((b) =>
    b.entries.filter((e) => e.ref === id).map((e) => ({ book: b, entry: e })),
  );
  const titleOf = (b: BookView) =>
    String(
      (
        [...props.records.values()].find(
          (r) =>
            r.kind === "spellbook" &&
            (r.data as { book?: unknown }).book === b.lineId,
        )?.data as { title?: unknown } | undefined
      )?.title ?? b.name,
    );
  return (
    <>
      <p>
        {level === 0 ? "Cantrip" : `Level ${level}`}{" "}
        {String(data["school"] ?? "")}
        {data["ritual"] === true && <span className="badge">ritual</span>}
        {data["concentration"] === true && (
          <span className="badge">concentration</span>
        )}
      </p>
      {typeof data["summary"] === "string" && (
        <p className="spell-summary">{data["summary"]}</p>
      )}
      <SpellFacts data={data} />
      {classes.length > 0 && (
        <p>
          Class lists:{" "}
          {classes.map((c, i) => (
            <span key={c}>
              {i > 0 && ", "}
              <EntryLink id={c} props={props} />
            </span>
          ))}
        </p>
      )}
      {inBooks.map(({ book, entry }) => (
        <p key={entry.id}>
          In {titleOf(book)}:{" "}
          {entry.ready ? (
            <span className="badge good">ready</span>
          ) : (
            <span className="badge warn">not ready</span>
          )}{" "}
          <span className="muted">{entry.reasons.join("; ")}</span>
        </p>
      ))}
      <SrdText data={data} />
      {data["whileActive"] !== undefined && (
        <>
          <h3>While active</h3>
          <Lines
            lines={describeGrants(data["whileActive"], (x) =>
              nameOfRecord(props, x),
            )}
            props={props}
          />
        </>
      )}
    </>
  );
}

interface ContainerRules {
  readonly maxWeight?: number;
  readonly maxVolume?: number;
  readonly maxCount?: number;
  readonly slots?: readonly unknown[];
  readonly accepts?: readonly string[];
  readonly contentsAddWeight: boolean;
}

function ContainerLine({ c }: { c: ContainerRules }) {
  const limits = [
    c.maxWeight !== undefined && `${c.maxWeight} lb`,
    c.maxVolume !== undefined && `${c.maxVolume} cu ft`,
    c.maxCount !== undefined && `${c.maxCount} items`,
    c.slots !== undefined && `${c.slots.length} slots, one item each`,
    c.accepts !== undefined &&
      `holds only ${c.accepts.map((a) => a.replace(/-/g, " ")).join(", ")}`,
  ].filter(Boolean);
  return (
    <p>
      Container: {limits.length > 0 ? limits.join(", ") : "no stated limits"}
      {!c.contentsAddWeight && " (contents add no weight)"}
    </p>
  );
}

function ItemBody({
  props,
  data,
}: {
  props: TabProps;
  data: Record<string, unknown>;
}) {
  const att = data["attunement"] as
    { required: boolean; requiresClass?: string } | undefined;
  return (
    <>
      <p>
        Weight:{" "}
        {data["weight"] === undefined ? (
          <span className="muted">unknown</span>
        ) : (
          `${String(data["weight"])} lb`
        )}
      </p>
      {data["container"] !== undefined && (
        <ContainerLine c={data["container"] as ContainerRules} />
      )}
      {att?.required && (
        <p>
          Requires attunement
          {att.requiresClass && (
            <>
              {" "}
              by <EntryLink id={att.requiresClass} props={props} />
            </>
          )}
        </p>
      )}
      {data["grants"] !== undefined && (
        <>
          <h3>Grants {String(data["grantsWhen"] ?? "").replace(/-/g, " ")}</h3>
          <Lines
            lines={describeGrants(data["grants"], (x) =>
              nameOfRecord(props, x),
            )}
            props={props}
          />
        </>
      )}
    </>
  );
}

function ClassBody({ data }: { data: Record<string, unknown> }) {
  const sc = data["spellcasting"] as { ability: string } | undefined;
  return (
    <p>
      Hit die d{String(data["hitDie"])} · saving throws{" "}
      {((data["savingThrows"] as string[] | undefined) ?? [])
        .map((s) => s.toUpperCase())
        .join(", ")}
      {sc && ` · casts with ${sc.ability.toUpperCase()}`}
    </p>
  );
}

export function EntryBody({
  props,
  id,
  context,
}: {
  props: TabProps;
  id: string;
  context?: EntryContextInfo;
}) {
  const record = props.records.get(id);
  if (!record) return <p className="unresolved">Reference not found: {id}</p>;
  const data = record.data as Record<string, unknown>;
  return (
    <>
      <SourceLine record={record} />
      {record.kind === "feature" && (
        <FeatureBody
          props={props}
          data={data}
          {...(context ? { context } : {})}
        />
      )}
      {record.kind === "spell" && (
        <SpellBody props={props} id={id} data={data} />
      )}
      {record.kind === "item" && <ItemBody props={props} data={data} />}
      {record.kind === "class" && <ClassBody data={data} />}
      <AllFields record={record} />
    </>
  );
}

/** Holds the stack of open entries for the whole sheet. */
export function EntryProvider({
  props,
  children,
}: {
  props: TabProps;
  children: ReactNode;
}) {
  const [stack, setStack] = useState<
    readonly { id: string; context?: EntryContextInfo }[]
  >([]);
  const open: OpenEntry = (id, context) =>
    setStack((s) => [...s, context ? { id, context } : { id }]);
  const top = stack[stack.length - 1];
  return (
    <Ctx.Provider value={open}>
      {children}
      {top && (
        <DetailPanel
          key={stack.length}
          title={nameOfRecord(props, top.id)}
          onClose={() => setStack([])}
        >
          {stack.length > 1 && (
            <p>
              <button
                type="button"
                className="secondary"
                onClick={() => setStack((s) => s.slice(0, -1))}
              >
                ← Back to{" "}
                {nameOfRecord(props, stack[stack.length - 2]?.id ?? "")}
              </button>
            </p>
          )}
          <EntryBody
            props={props}
            id={top.id}
            {...(top.context ? { context: top.context } : {})}
          />
        </DetailPanel>
      )}
    </Ctx.Provider>
  );
}
