// Using items and attacking with weapons from the sheet (Milestone 5 S10). Like casting, a review
// shows what the request will hold and use, and nothing is spent until the DM approves it.
//
// - Using an item (a Potion of Healing): who it is for, from who is in the scene.
// - Attacking: the weapon's attack actions are data (the Aetherlock's bursts and single-shot
//   modes, a bow's shot, a melee attack). Each round of the chosen action has its own options:
//   load (which slot, with which round from the inventory), fire (which slot) and clear (which
//   slot to empty afterwards), with a suggestion filled in. Firing with nothing loaded warns only.

import {
  BUDGET_NAMES,
  describeHolds,
  TIMING_NAMES,
  useItem,
  weaponAttack,
  type BudgetKind,
  type Shot,
  type Timing,
  type UseItemInput,
  type WeaponAttackInput,
} from "@hearthtable/play";
import { submitAction } from "@hearthtable/storage";
import type { LineRow } from "@hearthtable/system-containers";
import type { WeaponView } from "@hearthtable/system-magazines";
import { useState } from "react";
import { db } from "../firebase";
import { prepareAttack, type WeaponRules } from "../play/firing";
import type { Line } from "./drag";
import { nameOf, usePresent } from "./Requests";
import { known, type SheetPlay, type TabProps } from "./shared";

/** What an item does when used, from its definition. */
export interface ItemUse {
  readonly budget?: BudgetKind;
  readonly healing?: string;
  readonly consumed?: boolean;
  readonly targets?: string;
}

const rulesOf = (props: TabProps) => (ref: string) =>
  props.records.get(ref)?.data as WeaponRules | undefined;

function rowsOf(props: TabProps) {
  return (
    known(props.resolved.get<readonly LineRow[]>("containers.lines")) ?? []
  );
}

/** Timing, and whether it answers the open poll: shared by both reviews. */
function useTiming(play: SheetPlay, instantFirst: boolean) {
  const [timing, setTiming] = useState<Timing>(
    play.encounter && !instantFirst ? "next-turn" : "instant",
  );
  const openPoll = play.polls[0];
  const [responding, setResponding] = useState(false);
  const respondsTo = responding && openPoll ? openPoll.action : undefined;
  const view = (
    <>
      {openPoll && (
        <label className="chips">
          <input
            type="checkbox"
            checked={responding}
            onChange={() => setResponding(!responding)}
          />{" "}
          As a response to: {openPoll.event}
        </label>
      )}
      <span className="chips" role="radiogroup" aria-label="Timing">
        {(play.encounter
          ? (["instant", "next-turn"] as const)
          : (["instant"] as const)
        ).map((t) => (
          <label key={t}>
            <input
              type="radio"
              name="timing"
              checked={timing === t}
              onChange={() => setTiming(t)}
            />{" "}
            {TIMING_NAMES[t]}
          </label>
        ))}
      </span>
    </>
  );
  return {
    view,
    draft: {
      timing: respondsTo ? ("instant" as const) : timing,
      ...(respondsTo ? { respondsTo } : {}),
    },
  };
}

export function UseReview({
  props,
  play,
  row,
  use,
  onDone,
}: {
  props: TabProps;
  play: SheetPlay;
  row: LineRow;
  use: ItemUse;
  onDone: () => void;
}) {
  const present = usePresent(play);
  const [targets, setTargets] = useState<readonly string[]>([
    props.characterId,
  ]);
  const [note, setNote] = useState("");
  const timing = useTiming(play, use.budget === "reaction");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const who = nameOf(props);
  const input: UseItemInput = {
    line: row.line.id,
    name: row.name,
    ...(use.healing ? { healing: use.healing } : {}),
    targets,
    ...(use.budget ? { budget: use.budget } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
  };
  const holds = useItem.holds(input);
  const warnings = useItem.warnings(input, {
    name: who,
    slots: {},
    lines: { [row.line.id]: row.line.quantity - row.held },
  });
  return (
    <form
      className="panel cast-review"
      aria-label={`Use ${row.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        const summary = useItem.describe(input);
        void submitAction(
          db,
          play.campaign,
          {
            ...timing.draft,
            kind: useItem.id,
            character: props.characterId,
            input: { ...input },
            holds,
            ...(use.budget ? { budget: use.budget } : {}),
            summary,
          },
          play.uid,
          play.clock,
          `${who} queued a request: ${summary} (${TIMING_NAMES[timing.draft.timing]}).`,
        ).then((err) => {
          setBusy(false);
          setError(err);
          if (!err) onDone();
        });
      }}
    >
      <h3>Review</h3>
      <p>
        {row.name}
        {use.healing && ` · restores ${use.healing} Hit Points`}
        {use.targets && ` · ${use.targets}`}
      </p>
      {timing.view}
      {present.length > 0 && (
        <fieldset>
          <legend>For</legend>
          {present.map((p) => (
            <label key={p.path} className="chips">
              <input
                type="checkbox"
                checked={targets.includes(p.path)}
                onChange={() =>
                  setTargets(
                    targets.includes(p.path)
                      ? targets.filter((t) => t !== p.path)
                      : [...targets, p.path],
                  )
                }
              />{" "}
              {p.name}
            </label>
          ))}
        </fieldset>
      )}
      <div>
        <input
          aria-label="Notes"
          placeholder="Anything the DM should know"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <p className="muted">
        Holds {describeHolds(holds, () => row.name)}
        {use.budget ? `; uses ${BUDGET_NAMES[use.budget]}` : ""}. Nothing is
        used up until the DM approves it.
      </p>
      {warnings.map((w) => (
        <p key={w} className="warn-text" role="status">
          {w} The DM decides.
        </p>
      ))}
      <div className="chips">
        <button type="submit" disabled={busy}>
          Confirm
        </button>
        <button type="button" className="link-button" onClick={onDone}>
          Back
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
    </form>
  );
}

export function AttackReview({
  props,
  play,
  row,
  onDone,
}: {
  props: TabProps;
  play: SheetPlay;
  row: LineRow;
  onDone: () => void;
}) {
  const rules = rulesOf(props);
  const weaponRules = rules(row.line.ref) ?? {};
  const modes = weaponRules.attacks ?? [];
  const present = usePresent(play);
  const [modeId, setModeId] = useState(modes[0]?.id ?? "");
  const mode = modes.find((m) => m.id === modeId) ?? modes[0];
  const [target, setTarget] = useState("");
  const [shots, setShots] = useState<readonly Shot[] | undefined>();
  const [note, setNote] = useState("");
  const timing = useTiming(play, false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const rows = rowsOf(props);
  const lines = rows.map((r) => r.line as unknown as Line);
  // The Aetherlock aims with its declared ability; other weapons take a typed bonus for now.
  const view = (
    known(props.resolved.get<readonly WeaponView[]>("magazines.weapons")) ?? []
  ).find((w) => w.lineId === row.line.id);
  const aim = view?.aim?.kind === "known" ? view.aim.value : undefined;
  const aimAbility = (weaponRules as { aim?: { ability?: string } }).aim
    ?.ability;
  const aimModifier = aimAbility
    ? (known(props.resolved.get<number>(`abilities.${aimAbility}.modifier`)) ??
      0)
    : 0;
  const [bonus, setBonus] = useState(String(aim ?? 0));
  const prepared = prepareAttack({
    lines,
    held: Object.fromEntries(rows.map((r) => [r.line.id, r.held])),
    weaponId: row.line.id,
    ...(mode ? { mode } : {}),
    rulesOf: rules,
    ...(shots ? { shots } : {}),
    ...(target ? { target } : {}),
    fallback: weaponRules.weapon?.damage ? [weaponRules.weapon.damage] : [],
    aimModifier,
  });
  const state = prepared.state;
  const slots = state?.slots ?? [];
  const lineName = (id: string) =>
    rows.find((r) => r.line.id === id)?.name ?? id;
  // Edits keep only each shot's options; what it fires is worked out again.
  const setShot = <K extends "load" | "fire" | "clear">(
    i: number,
    key: K,
    value: Shot[K] | undefined,
  ) =>
    setShots(
      prepared.shots.map((s, k): Shot => {
        const plain: Shot = {
          ...(s.load ? { load: s.load } : {}),
          ...(s.fire ? { fire: s.fire } : {}),
          ...(s.clear ? { clear: s.clear } : {}),
        };
        if (k !== i) return plain;
        const { [key]: _old, ...rest } = plain;
        return value === undefined ? rest : { ...rest, [key]: value };
      }),
    );
  const who = nameOf(props);
  const input: WeaponAttackInput = {
    name: `${row.name}${mode && modes.length > 1 ? `: ${mode.name}` : ""}`,
    weapon: row.line.id,
    ...(mode ? { mode: mode.id } : {}),
    ...(mode?.precision ? { precision: true } : {}),
    // Each shot keeps only the options it uses; the round's details are filled in.
    shots: prepared.shots.map((s) => (target ? { ...s, target } : s)),
    bonus: Number(bonus) || 0,
    consumes: prepared.holds,
    ...(target ? { targets: [target] } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
  };
  const holds = weaponAttack.holds(input);
  const special = prepared.shots.some((s) => s.save || s.payload);

  return (
    <form
      className="panel cast-review"
      aria-label={`Attack with ${row.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        const summary = weaponAttack.describe(input);
        void submitAction(
          db,
          play.campaign,
          {
            ...timing.draft,
            kind: weaponAttack.id,
            character: props.characterId,
            input: { ...input },
            holds,
            budget: "action",
            summary,
          },
          play.uid,
          play.clock,
          `${who} queued a request: ${summary} (${TIMING_NAMES[timing.draft.timing]}).`,
        ).then((err) => {
          setBusy(false);
          setError(err);
          if (!err) onDone();
        });
      }}
    >
      <h3>Review</h3>
      {modes.length > 1 && (
        <label>
          Attack{" "}
          <select
            aria-label="Attack action"
            value={mode?.id}
            onChange={(e) => {
              setModeId(e.target.value);
              setShots(undefined);
            }}
          >
            {modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}{" "}
      <label>
        Attack bonus +
        <input
          aria-label="Attack bonus"
          type="number"
          value={bonus}
          onChange={(e) => setBonus(e.target.value)}
          style={{ width: 55 }}
        />
      </label>
      {mode?.precision && <span className="badge">Advantage</span>}
      {timing.view}
      {present.length > 0 && (
        <label>
          {special ? "Aimed at" : "Target"}{" "}
          <select
            aria-label="Target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">choose…</option>
            {present.map((p) => (
              <option key={p.path} value={p.path}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {mode && mode.rounds > 0 && (
        <ol className="plain-list" aria-label="Rounds">
          {prepared.shots.map((s, i) => (
            <li key={i} className="chips">
              <span>Round {i + 1}:</span>
              <label>
                load{" "}
                <select
                  aria-label={`Round ${i + 1}: load slot`}
                  value={s.load?.slot ?? ""}
                  onChange={(e) =>
                    setShot(
                      i,
                      "load",
                      e.target.value
                        ? {
                            slot: e.target.value,
                            line:
                              s.load?.line ?? state?.rounds[0]?.line.id ?? "",
                          }
                        : undefined,
                    )
                  }
                >
                  <option value="">nothing</option>
                  {slots.map((sl) => (
                    <option key={sl.id} value={sl.id}>
                      {sl.label}
                    </option>
                  ))}
                </select>
              </label>
              {s.load && (
                <select
                  aria-label={`Round ${i + 1}: load round`}
                  value={s.load.line}
                  onChange={(e) =>
                    setShot(i, "load", {
                      slot: s.load?.slot ?? "",
                      line: e.target.value,
                    })
                  }
                >
                  {(state?.rounds ?? []).map((r) => (
                    <option key={r.line.id} value={r.line.id}>
                      {lineName(r.line.id)} ({r.free})
                    </option>
                  ))}
                </select>
              )}
              <label>
                fire{" "}
                <select
                  aria-label={`Round ${i + 1}: fire slot`}
                  value={s.fire ?? ""}
                  onChange={(e) =>
                    setShot(i, "fire", e.target.value || undefined)
                  }
                >
                  <option value="">nothing</option>
                  {slots.map((sl) => (
                    <option key={sl.id} value={sl.id}>
                      {sl.label}
                      {sl.round ? ` (${lineName(sl.round.id)})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {slots.length > 1 && (
                <label>
                  clear{" "}
                  <select
                    aria-label={`Round ${i + 1}: clear slot`}
                    value={s.clear ?? ""}
                    onChange={(e) =>
                      setShot(i, "clear", e.target.value || undefined)
                    }
                  >
                    <option value="">nothing</option>
                    {slots.map((sl) => (
                      <option key={sl.id} value={sl.id}>
                        {sl.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <span className="muted">
                {s.payload
                  ? "casts the scroll it carries"
                  : s.save
                    ? `DC ${s.save.dc} ${s.save.ability.toUpperCase()} save, ${(s.damage ?? []).map((d) => `${d.dice} ${d.type ?? ""}`).join(" + ")}`
                    : (s.damage ?? [])
                        .map((d) => `${d.dice} ${d.type ?? ""}`)
                        .join(" + ")}
              </span>
            </li>
          ))}
        </ol>
      )}
      {mode?.rounds === 0 && (
        <p className="muted">
          {(prepared.shots[0]?.damage ?? [])
            .map((d) => `${d.dice} ${d.type ?? ""}`)
            .join(" + ")}
        </p>
      )}
      <div>
        <input
          aria-label="Notes"
          placeholder="Anything the DM should know"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>
      <p className="muted">
        Holds {describeHolds(holds, lineName)}; uses {BUDGET_NAMES.action}.
        Nothing is spent until the DM approves it.
      </p>
      {prepared.warnings.map((w) => (
        <p key={w} className="warn-text" role="status">
          {w} The DM decides.
        </p>
      ))}
      <div className="chips">
        <button type="submit" disabled={busy}>
          Confirm
        </button>
        <button type="button" className="link-button" onClick={onDone}>
          Back
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
    </form>
  );
}
