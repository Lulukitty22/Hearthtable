// The turn order of an encounter in progress (Milestone 5 S3; Turns, Encounters and Time,
// "Initiative and turn order", "Round 1", "Removing participants", "Ending a turn" and "Action
// budget"). Everyone sees the order, the round, whose turn it is, initiatives, hit points and
// what each participant has used this turn. A character's controller enters its initiative
// (rolled in the app or typed), ticks its budget and ends its turn; the DM can do all of that for
// anyone, begins round 1, moves, removes and adds participants, and ends the encounter.

import {
  BUDGET_KINDS,
  BUDGET_NAMES,
  changeUse,
  encounterClock,
  nextTurn,
  overBudget,
  rollInitiative,
  usesNow,
  type BudgetKind,
  type Moment,
} from "@hearthtable/play";
import {
  addToEncounter,
  beginRound1,
  changeParticipants,
  documentIdFor,
  endEncounter,
  enterInitiative,
  passTurn,
  setUse,
  takeStep,
  type EncounterState,
  type ParticipantState,
} from "@hearthtable/storage";
import type { RecordEnvelope } from "@hearthtable/kernel";
import { useState } from "react";
import { db, repository } from "../firebase";
import { webPathFor } from "../routes";
import {
  ConditionChips,
  saveReminder,
  type ConditionTools,
} from "./Conditions";
import { EffectChips } from "./Effects";

import { deploymentsFor } from "./StartEncounter";
import type { Participant, Template } from "./useTable";

export interface Control {
  readonly uid: string | undefined;
  readonly isDm: boolean;
  /** Whether the viewer controls this participant (its owner, or the DM for anyone). */
  readonly controls: (path: string) => boolean;
}

export function EncounterPanel({
  id,
  campaignPath,
  encounter,
  record,
  order,
  people,
  entries,
  campaignCharacters,
  sceneNpcs,
  templates,
  control,
  now,
  endEarly,
  conditionTools,
  onProblem,
}: {
  id: string;
  campaignPath: string;
  encounter: EncounterState;
  record: RecordEnvelope | undefined;
  order: readonly string[];
  people: ReadonlyMap<string, Participant>;
  entries: readonly ParticipantState[];
  campaignCharacters: readonly string[];
  sceneNpcs: readonly string[];
  templates: readonly Template[];
  control: Control;
  now: Moment | undefined;
  endEarly: (
    person: Participant,
  ) => ((effect: { id: string; name: string }) => void) | undefined;
  conditionTools: (person: Participant) => ConditionTools | undefined;
  onProblem: (message: string) => void;
}) {
  const clock = encounterClock(encounter.startClock, encounter.round);
  const name = (p: string) =>
    people.get(p)?.name ?? (p.split("/").at(-1) as string).replaceAll("_", " ");
  const entryOf = (p: string) => entries.find((e) => e.path === p);
  const report = (err: string | undefined) => err && onProblem(err);
  const { uid, isDm } = control;
  const missing = order.filter((p) => !entryOf(p)?.initiative);

  const endTurn = () => {
    if (!uid || !encounter.current) return;
    const next = nextTurn(order, {
      round: encounter.round,
      current: encounter.current,
    });
    if (!next) return;
    // Repeat saves come at the end of the character's turn: remind about them in the log.
    const saves = (people.get(encounter.current)?.conditions ?? []).flatMap(
      (c) => {
        const r = saveReminder(c);
        return r ? [r] : [];
      },
    );
    const text = `${name(encounter.current)}'s turn ended.${saves.length ? ` Repeat save${saves.length > 1 ? "s" : ""} due: ${saves.join("; ")}.` : ""} ${next.round > encounter.round ? `Round ${next.round} began. ` : ""}${name(next.current)}'s turn.`;
    void passTurn(
      db,
      id,
      encounter,
      next,
      uid,
      encounterClock(encounter.startClock, next.round),
      text,
    ).then(report);
  };

  return (
    <section className="panel" aria-label="Turn order">
      <div className="section-heading">
        <h2>Turn order</h2>
        <span className="muted" data-testid="round">
          {encounter.round === 0
            ? "Rolling initiative"
            : `Round ${encounter.round}${encounter.current ? ` · ${name(encounter.current)}'s turn` : ""}`}
        </span>
      </div>

      <ol className="turn-order">
        {order.map((p, i) => (
          <TurnRow
            key={p}
            path={p}
            index={i}
            last={i === order.length - 1}
            person={people.get(p)}
            entry={entryOf(p)}
            current={encounter.current === p}
            surprised={encounter.surprised.includes(p)}
            encounter={encounter}
            mine={control.controls(p)}
            isDm={isDm}
            onInitiative={(value, detail) =>
              uid &&
              void enterInitiative(
                db,
                id,
                encounter.scene,
                p,
                value,
                detail,
                uid,
                clock,
                name(p),
              ).then(report)
            }
            now={now}
            onEnd={
              people.get(p) ? endEarly(people.get(p) as Participant) : undefined
            }
            tools={
              people.get(p)
                ? conditionTools(people.get(p) as Participant)
                : undefined
            }
            onUse={(kind, delta) => {
              const start = encounter.turnStarts[documentIdFor(p)];
              void setUse(
                db,
                id,
                encounter.scene,
                p,
                kind,
                changeUse(entryOf(p)?.used[kind], start, encounter.seq, delta),
              ).then(report);
              // Taking an action or reaction moves the encounter's time on one step.
              if (delta > 0) void takeStep(db, id, encounter).then(report);
            }}
            onMove={(by) => {
              if (!uid) return;
              const next = [...order];
              next.splice(i, 1);
              next.splice(i + by, 0, p);
              void changeParticipants(
                db,
                id,
                encounter,
                { order: next },
                uid,
                clock,
                `The DM moved ${name(p)} ${by < 0 ? "up" : "down"} the turn order.`,
              ).then(report);
            }}
            onRemove={() =>
              uid &&
              void changeParticipants(
                db,
                id,
                encounter,
                {
                  participants: encounter.participants.filter((x) => x !== p),
                  ...(encounter.order
                    ? { order: encounter.order.filter((x) => x !== p) }
                    : {}),
                },
                uid,
                clock,
                `The DM removed ${name(p)} from the encounter.`,
              ).then(report)
            }
          />
        ))}
      </ol>

      <div className="chips" style={{ marginTop: 10 }}>
        {encounter.round === 0 && isDm && uid && (
          <>
            <button
              type="button"
              onClick={() =>
                void beginRound1(db, id, encounter, order, uid).then(report)
              }
              disabled={order.length === 0}
            >
              Begin round 1
            </button>
            {missing.length > 0 && (
              <span className="warn-text" role="status">
                Still without initiative, going last:{" "}
                {missing.map(name).join(", ")}.
              </span>
            )}
          </>
        )}
        {encounter.round >= 1 &&
          encounter.current &&
          (isDm || control.controls(encounter.current)) && (
            <button type="button" onClick={endTurn}>
              End {name(encounter.current)}&apos;s turn
            </button>
          )}
        {isDm && uid && record && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (
                !window.confirm(
                  "End the encounter? It becomes read-only history.",
                )
              )
                return;
              void endEncounter(db, repository, {
                campaign: id,
                campaignPath,
                uid,
                encounter,
                record,
                order,
                initiative: new Map(
                  entries.flatMap((e) =>
                    e.initiative ? [[e.path, e.initiative.value] as const] : [],
                  ),
                ),
              }).then(report);
            }}
          >
            End the encounter
          </button>
        )}
      </div>

      {isDm && uid && (
        <AddParticipants
          key={encounter.participants.join("|")}
          candidates={[...campaignCharacters, ...sceneNpcs].filter(
            (p) => !encounter.participants.includes(p),
          )}
          name={name}
          templates={templates}
          onAdd={(paths, counts) =>
            void addToEncounter(
              db,
              repository,
              id,
              encounter,
              paths,
              deploymentsFor(
                templates,
                counts,
                sceneNpcs.map(name),
                () => false,
              ),
              uid,
              clock,
              `The DM added ${[
                ...paths.map(name),
                ...templates
                  .filter((t) => (counts[t.path] ?? 0) > 0)
                  .map((t) => `${counts[t.path]} × ${t.name}`),
              ].join(", ")} to the encounter.`,
            ).then(report)
          }
        />
      )}
      <p className="muted">
        Sheets:{" "}
        {order.map((p, i) => (
          <span key={p}>
            {i > 0 && ", "}
            <a href={webPathFor(p)}>{name(p)}</a>
          </span>
        ))}
        {order.length === 0 && "nobody yet"}
      </p>
    </section>
  );
}

function TurnRow({
  path,
  index,
  last,
  person,
  entry,
  current,
  surprised,
  encounter,
  mine,
  isDm,
  now,
  onEnd,
  tools,
  onInitiative,
  onUse,
  onMove,
  onRemove,
}: {
  path: string;
  index: number;
  last: boolean;
  person: Participant | undefined;
  entry: ParticipantState | undefined;
  current: boolean;
  surprised: boolean;
  encounter: EncounterState;
  mine: boolean;
  isDm: boolean;
  now: Moment | undefined;
  onEnd: ((effect: { id: string; name: string }) => void) | undefined;
  tools: ConditionTools | undefined;
  onInitiative: (value: number, detail: string) => void;
  onUse: (kind: BudgetKind, delta: 1 | -1) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const name = person?.name ?? path;
  const [typed, setTyped] = useState("");
  const [changing, setChanging] = useState(false);
  const start = encounter.turnStarts[documentIdFor(path)];
  const uses = BUDGET_KINDS.map(
    (k) => [k, usesNow(entry?.used[k], start)] as const,
  );
  const warnings = [
    ...uses.flatMap(([k, n]) => {
      const w = overBudget(k, n, name);
      return w ? [w] : [];
    }),
    // Rules warn; the DM decides.
    ...(person?.incapacitated && uses.some(([, n]) => n > 0)
      ? [
          `${name} is Incapacitated (${person.incapacitated}): the rules allow no action, Bonus Action or Reaction. The DM decides.`,
        ]
      : []),
  ];
  const showEntry = mine && (!entry?.initiative || changing);

  return (
    <li
      className={`turn-row${current ? " current" : ""}`}
      aria-label={name}
      aria-current={current ? "step" : undefined}
    >
      <span className="turn-marker" aria-hidden>
        {current ? "▶" : ""}
      </span>
      <div className="turn-who">
        <strong>{name}</strong>
        {person?.npc && <span className="badge">NPC</span>}
        {surprised && <span className="badge warn">surprised</span>}
        <div className="muted">
          HP {person?.hp ? person.hp.current : "?"}
          {person?.hp?.max !== undefined ? ` / ${person.hp.max}` : ""} · AC{" "}
          {person?.ac ?? "?"}
        </div>
        {person && (
          <EffectChips
            person={person}
            now={now}
            {...(onEnd ? { onEnd } : {})}
          />
        )}
        {person && (
          <ConditionChips
            person={person}
            {...(tools ? { onRemove: tools.onRemove } : {})}
          />
        )}
        {tools?.add}
      </div>
      <div className="turn-initiative">
        {entry?.initiative && !changing ? (
          <span
            title={entry.initiative.detail}
            data-testid={`initiative-${name}`}
          >
            {entry.initiative.value}
            {mine && (
              <button
                type="button"
                className="link-button"
                onClick={() => setChanging(true)}
                aria-label={`Change ${name}'s initiative`}
              >
                change
              </button>
            )}
          </span>
        ) : showEntry ? (
          <span className="chips">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const r = rollInitiative(
                  person?.initiativeBonus ?? 0,
                  surprised,
                );
                onInitiative(r.total, r.detail);
                setChanging(false);
              }}
            >
              Roll initiative
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = Number(typed);
                if (!typed || !Number.isInteger(v)) return;
                onInitiative(v, "typed");
                setTyped("");
                setChanging(false);
              }}
            >
              <input
                type="number"
                aria-label={`${name}'s initiative`}
                placeholder="or type"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                style={{ width: 80 }}
              />
            </form>
          </span>
        ) : (
          <span className="muted">waiting</span>
        )}
      </div>
      {encounter.round >= 1 && (
        <div className="turn-budget" aria-label={`${name}'s budget`}>
          {uses.map(([k, n]) => (
            <span key={k} className="chips">
              <label>
                <input
                  type="checkbox"
                  checked={n > 0}
                  disabled={!mine}
                  onChange={() => onUse(k, n > 0 ? -1 : 1)}
                />{" "}
                {BUDGET_NAMES[k]}
                {n > 1 ? ` ×${n}` : ""}
              </label>
              {mine && n > 0 && (
                <button
                  type="button"
                  className="link-button"
                  aria-label={`${name} uses another ${BUDGET_NAMES[k]}`}
                  onClick={() => onUse(k, 1)}
                >
                  +
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {isDm && (
        <div className="turn-dm chips">
          <button
            type="button"
            className="link-button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move ${name} up`}
          >
            ↑
          </button>
          <button
            type="button"
            className="link-button"
            disabled={last}
            onClick={() => onMove(1)}
            aria-label={`Move ${name} down`}
          >
            ↓
          </button>
          <button
            type="button"
            className="link-button"
            disabled={current}
            title={current ? "End their turn first." : undefined}
            onClick={onRemove}
            aria-label={`Remove ${name}`}
          >
            remove
          </button>
        </div>
      )}
      {warnings.map((w) => (
        <p key={w} className="warn-text turn-warning" role="status">
          {w}
        </p>
      ))}
    </li>
  );
}

function AddParticipants({
  candidates,
  name,
  templates,
  onAdd,
}: {
  candidates: readonly string[];
  name: (path: string) => string;
  templates: readonly Template[];
  onAdd: (paths: readonly string[], counts: Record<string, number>) => void;
}) {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const any =
    chosen.length > 0 || Object.values(counts).some((n) => (n ?? 0) > 0);
  return (
    <details className="add-participants">
      <summary>Add to the encounter</summary>
      {candidates.map((p) => (
        <label key={p} className="chips">
          <input
            type="checkbox"
            checked={chosen.includes(p)}
            onChange={() =>
              setChosen(
                chosen.includes(p)
                  ? chosen.filter((x) => x !== p)
                  : [...chosen, p],
              )
            }
          />{" "}
          {name(p)}
        </label>
      ))}
      {templates.map((t) => (
        <label key={t.path} className="chips">
          <input
            type="number"
            min={0}
            max={50}
            value={counts[t.path] ?? 0}
            onChange={(e) =>
              setCounts({ ...counts, [t.path]: Number(e.target.value) })
            }
            aria-label={`Add how many ${t.name}`}
            style={{ width: 60 }}
          />{" "}
          × {t.name}
        </label>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={!any}
        onClick={() => onAdd(chosen, counts)}
      >
        Add
      </button>
    </details>
  );
}
