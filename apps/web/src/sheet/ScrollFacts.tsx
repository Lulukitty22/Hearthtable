// What a physical scroll holds and what moving it costs (Milestone 3, S4). Shown in the scroll's
// item window and in its book entry once mounted. Mounting and removal are not paid yet: the
// crafting job system that charges for them is Milestone 5b.

import type {
  ScrollSnapshot,
  ScrollView,
  SnapshotFormula,
} from "@hearthtable/system-scrolls";
import { EntryLink, nameOfRecord } from "./entries";
import type { TabProps } from "./shared";

/** One frozen roll, e.g. `10d6 Fire + 5 (Empowered Evocation, once)`. */
export function formulaText(f: SnapshotFormula): string {
  const bonuses = f.bonuses.map((b) => {
    const notes = [
      b.source,
      ...(b.once ? ["once"] : []),
      ...(b.when ? [`if ${b.when.damageType}`] : []),
    ];
    return ` ${b.value < 0 ? "−" : "+"} ${Math.abs(b.value)} (${notes.join(", ")})`;
  });
  return `${f.count !== undefined ? `${f.count} × ` : ""}${f.dice}${f.type ? ` ${f.type}` : ""}${bonuses.join("")}`;
}

/** A calculated cost, shown exactly (Currency and Trade, "Rounding"). */
export function exactGp(gp: number): string {
  return `${Number(gp.toFixed(4))} gp`;
}

export function duration(hours: number): string {
  if (hours < 1) return `${Number((hours * 60).toFixed(2))} minutes`;
  return `${Number(hours.toFixed(2))} hours`;
}

export function ScrollFacts({
  props,
  scroll,
  onToggleSpent,
}: {
  props: TabProps;
  scroll: ScrollView;
  /** Omitted on the view-only sheet. */
  onToggleSpent?: () => void;
}) {
  const levelNote =
    scroll.level !== undefined && scroll.castLevel > scroll.level
      ? ` (upcast from level ${scroll.level})`
      : "";
  const snap = scroll.snapshot as Partial<ScrollSnapshot> | undefined;
  return (
    <div className="scroll-facts">
      <p>
        Holds <EntryLink id={scroll.spell} props={props} /> at{" "}
        {scroll.castLevel === 0 ? "cantrip level" : `level ${scroll.castLevel}`}
        {levelNote}.{" "}
        {scroll.spent ? (
          <span className="badge warn">spent</span>
        ) : (
          <span className="badge good">usable</span>
        )}
      </p>
      {scroll.scribe && (
        <p className="muted">
          Scribed by {nameOfRecord(props, scroll.scribe)}
          {snap &&
            (snap.spellSaveDC !== undefined ||
              snap.spellAttackBonus !== undefined) &&
            `; frozen at save DC ${String(snap.spellSaveDC ?? "—")}, spell attack +${String(snap.spellAttackBonus ?? "—")}`}
          .
        </p>
      )}
      {snap?.formulas && snap.formulas.length > 0 && (
        <ul className="snapshot-formulas">
          {snap.formulas.map((f, i) => (
            <li key={i}>
              {f.role === "damage" ? "Damage" : "Healing"}: {formulaText(f)}
              {f.note && <span className="muted"> ({f.note})</span>}
            </li>
          ))}
        </ul>
      )}
      <p>
        {scroll.place.kind === "loose" ? "Mounting" : "Removing"} it:{" "}
        {scroll.mounting.kind === "known" ? (
          <>
            {exactGp(
              scroll.mounting.value.feeGp.kind === "known"
                ? scroll.mounting.value.feeGp.value
                : NaN,
            )}{" "}
            and{" "}
            {scroll.mounting.value.hours.kind === "known"
              ? duration(scroll.mounting.value.hours.value)
              : "unknown time"}
          </>
        ) : (
          <span className="unresolved">{scroll.mounting.reason}</span>
        )}
        <span className="muted">
          {" "}
          (not charged until crafting jobs, Milestone 5b)
        </span>
      </p>
      {onToggleSpent && (
        <p>
          <button type="button" className="secondary" onClick={onToggleSpent}>
            {scroll.spent ? "Mark usable again" : "Mark spent"}
          </button>
        </p>
      )}
    </div>
  );
}
