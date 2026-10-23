// What a physical scroll holds and what moving it costs (Milestone 3, S4). Shown in the scroll's
// item window and in its book entry once mounted. Mounting and removal are not paid yet: the
// crafting job system that charges for them is Milestone 5b.

import type { ScrollView } from "@hearthtable/system-scrolls";
import { EntryLink, nameOfRecord } from "./entries";
import type { TabProps } from "./shared";

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
  onToggleSpent: () => void;
}) {
  const levelNote =
    scroll.level !== undefined && scroll.castLevel > scroll.level
      ? ` (upcast from level ${scroll.level})`
      : "";
  const snap = scroll.snapshot as
    { saveDc?: unknown; attackBonus?: unknown } | undefined;
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
            (snap.saveDc !== undefined || snap.attackBonus !== undefined) &&
            `; frozen at save DC ${String(snap.saveDc ?? "—")}, spell attack +${String(snap.attackBonus ?? "—")}`}
          .
        </p>
      )}
      <p>
        {scroll.place.kind === "book" ? "Removing" : "Mounting"} it:{" "}
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
      <p>
        <button type="button" className="secondary" onClick={onToggleSpent}>
          {scroll.spent ? "Mark usable again" : "Mark spent"}
        </button>
      </p>
    </div>
  );
}
