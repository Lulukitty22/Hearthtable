// /Campaigns/<name>/Table and …/Table/Dungeon_Master: the game in progress (Milestone 5 S2;
// Turns, Encounters and Time, "Scenes"). Both show the current scene, the game clock, who is
// present and the campaign log, live; during an encounter (S3), the turn order. Nothing is
// hidden from players yet. The DM's view adds the controls: setting the clock, titling the
// scene, making NPC templates, and starting and running encounters. A campaign's table opens
// the first time one of its DMs visits the DM's view, in a downtime scene at Day 1.

import {
  clockFrom,
  clockParts,
  encounterClock,
  formatClock,
  type Moment,
  sceneKindOf,
  sceneLabel,
} from "@hearthtable/play";
import {
  endEffects,
  LOG_TEXT_LIMIT,
  normalizeAlias,
  openTable,
  postToLog,
  setClock,
  titleScene,
  type LogEntry,
  type PlayState,
} from "@hearthtable/storage";
import { useEffect, useRef, useState } from "react";
import { useAliases } from "../account/useAliases";
import type { Viewer } from "../account/useViewer";
import { db, repository } from "../firebase";
import { tablePathFor, webPathFor } from "../routes";
import {
  AddCondition,
  ConditionChips,
  removeCondition,
  type ConditionTools,
} from "./Conditions";
import { EffectChips, useClearEndedEffects } from "./Effects";
import { EncounterPanel, type Control } from "./EncounterPanel";
import { NewNpcTemplate, StartEncounter } from "./StartEncounter";
import { useTable, type Participant } from "./useTable";
import type { ConditionRow } from "@hearthtable/system-conditions";

export function TablePage({
  segment,
  role,
  viewer,
}: {
  segment: string;
  role: "player" | "dm";
  viewer: Viewer;
}) {
  const table = useTable(segment);
  const { campaign, state, scene, log, participants } = table;
  const uid = viewer.status === "account" ? viewer.account.uid : undefined;
  const approved =
    viewer.status === "account" && viewer.account.status === "approved";
  const isDm = !!uid && approved && !!campaign?.dms.includes(uid);
  const isMember =
    !!uid &&
    approved &&
    !!campaign &&
    (campaign.dms.includes(uid) || campaign.players.includes(uid));
  const aliases = useAliases(
    campaign ? [...campaign.dms, ...campaign.players] : [],
  );
  const [problem, setProblem] = useState<string | undefined>();
  useClearEndedEffects(
    role === "dm" && isDm,
    table.id,
    table.people?.map,
    uid,
    table.now?.clock,
    setProblem,
  );

  // The first DM to open the DM's view opens the table.
  const opening = useRef(false);
  useEffect(() => {
    if (role !== "dm" || !isDm || !uid || state !== null || opening.current)
      return;
    opening.current = true;
    void openTable(db, repository, table.campaignPath, uid).then((e) => {
      if (e) setProblem(e);
      opening.current = false;
    });
  }, [role, isDm, uid, state, table.campaignPath]);

  if (table.failure)
    return (
      <main className="page">
        <div className="error-box">{table.failure}</div>
      </main>
    );
  if (campaign === null)
    return (
      <main className="page">
        <h1>No such campaign</h1>
      </main>
    );
  if (campaign === undefined || state === undefined)
    return <main className="page muted">Loading the table…</main>;
  if (role === "dm" && !isDm)
    return (
      <main className="page">
        <h1>{campaign.name}: Dungeon Master</h1>
        <p>
          Only this campaign&apos;s DMs can open the DM&apos;s view.{" "}
          <a href={tablePathFor(segment, "player")}>Go to the table</a>
        </p>
      </main>
    );
  if (state === null)
    return (
      <main className="page">
        <h1>{campaign.name}</h1>
        <p className="muted">
          {role === "dm"
            ? "Opening the table…"
            : "The table opens when a DM first visits the DM's view."}
        </p>
        {problem && <div className="error-box">{problem}</div>}
      </main>
    );

  const kind = sceneKindOf(state.scene);
  const name = (u: string) => aliases.get(u) ?? "…";
  const { encounter, people, order } = table;
  // During an encounter the clock runs with its rounds (six seconds each).
  const clock = encounter
    ? encounterClock(encounter.startClock, encounter.round)
    : state.clock;
  const alias =
    viewer.status === "account" ? normalizeAlias(viewer.account.alias) : "";
  const endEarly = (person: Participant) =>
    isDm && uid && role === "dm"
      ? (effect: { id: string; name: string }) =>
          void endEffects(
            db,
            repository,
            table.id,
            person.path,
            person.name,
            [effect],
            "early",
            uid,
            clock,
          ).then((e) => e && setProblem(e))
      : undefined;
  // The DM's condition controls for one participant, or nothing for others.
  const conditionTools = (person: Participant) =>
    isDm && uid && role === "dm"
      ? {
          onRemove: (c: ConditionRow) =>
            void removeCondition(table.id, person, c, uid, clock).then(
              (e) => e && setProblem(e),
            ),
          add: (
            <AddCondition
              person={person}
              kinds={table.conditionKinds}
              now={table.now}
              campaign={table.id}
              uid={uid}
              clock={clock}
              onProblem={setProblem}
            />
          ),
        }
      : undefined;
  const control: Control = {
    uid,
    isDm,
    // Its owner (the Alias folder it sits in) or a DM; delegates are honoured by the Rules.
    controls: (path) => {
      const parts = path.split("/");
      return (
        isDm ||
        (approved &&
          parts[2] === "Characters" &&
          normalizeAlias(parts[3] ?? "") === alias)
      );
    },
  };

  return (
    <main className="page table-page">
      <header className="stage-strip" aria-label="Current scene">
        <div>
          <p className="eyebrow">
            {campaign.name} · {role === "dm" ? "Dungeon Master" : "Table"}
          </p>
          <h1>{sceneLabel(state.scene, scene?.data.title)}</h1>
          <p className="muted">
            {kind === "encounter" ? "Encounter" : "Downtime · open floor"}
          </p>
        </div>
        <div className="stage-clock">
          <span className="vital-label">Game clock</span>
          <strong data-testid="game-clock">{formatClock(clock)}</strong>
        </div>
        <nav className="chips">
          <a href={webPathFor(table.campaignPath)}>Campaign</a>
          {isDm && role === "player" && (
            <a href={tablePathFor(segment, "dm")}>DM&apos;s view</a>
          )}
          {role === "dm" && (
            <a href={tablePathFor(segment, "player")}>Players&apos; view</a>
          )}
        </nav>
      </header>
      {problem && (
        <p className="error-box" role="status">
          {problem}{" "}
          <button
            type="button"
            className="link-button"
            aria-label="Dismiss"
            onClick={() => setProblem(undefined)}
          >
            ×
          </button>
        </p>
      )}

      <div className="table-layout">
        <div className="table-main">
          {role === "dm" && uid && (
            <DmControls
              key={`${state.scene}:${scene?.revision ?? 0}`}
              id={table.id}
              uid={uid}
              state={state}
              inEncounter={kind === "encounter"}
              title={scene?.data.title ?? ""}
              onTitle={(title) =>
                scene &&
                titleScene(
                  db,
                  repository,
                  table.id,
                  uid,
                  state.clock,
                  scene,
                  title,
                ).then((e) => e && setProblem(e))
              }
              onProblem={setProblem}
            />
          )}
          {role === "dm" && uid && kind === "downtime" && people && (
            <section className="panel" aria-label="Encounters and NPCs">
              <StartEncounter
                key={state.scene}
                id={table.id}
                campaignPath={table.campaignPath}
                uid={uid}
                state={state}
                downtime={scene}
                characters={participants?.filter((p) => !p.npc) ?? []}
                templates={people.templates}
                onProblem={setProblem}
              />
              <h3>New NPC template</h3>
              <NewNpcTemplate
                campaignPath={table.campaignPath}
                templates={people.templates}
                onProblem={setProblem}
              />
            </section>
          )}
          {kind === "encounter" && encounter && order && people && (
            <EncounterPanel
              id={table.id}
              campaignPath={table.campaignPath}
              encounter={encounter}
              record={scene}
              order={order}
              people={people.map}
              entries={table.entries}
              campaignCharacters={people.campaignCharacters}
              sceneNpcs={people.sceneNpcs}
              templates={people.templates}
              control={control}
              now={table.now}
              endEarly={endEarly}
              conditionTools={conditionTools}
              onProblem={setProblem}
            />
          )}
          {kind === "downtime" && (
            <section className="panel" aria-label="Present">
              <h2>At the table</h2>
              {!participants ? (
                <p className="muted">Loading characters…</p>
              ) : participants.length === 0 ? (
                <p className="muted">Nobody is here yet.</p>
              ) : (
                <ul className="party-list">
                  {participants.map((p) => (
                    <ParticipantCard
                      key={p.path}
                      participant={p}
                      now={table.now}
                      onEnd={endEarly(p)}
                      tools={conditionTools(p)}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        <Log
          entries={log}
          name={name}
          canPost={isMember}
          onPost={(text) =>
            uid
              ? postToLog(db, table.id, uid, clock, text)
              : Promise.resolve("Not signed in.")
          }
        />
      </div>
    </main>
  );
}

function ParticipantCard({
  participant: p,
  now,
  onEnd,
  tools,
}: {
  participant: Participant;
  now: Moment | undefined;
  onEnd: ((effect: { id: string; name: string }) => void) | undefined;
  tools: ConditionTools | undefined;
}) {
  return (
    <li className="party-card">
      {p.portrait ? (
        <img className="party-portrait" src={p.portrait.url} alt="" />
      ) : (
        <span className="party-portrait party-portrait-empty" aria-hidden>
          {p.name.slice(0, 1)}
        </span>
      )}
      <div>
        <a href={webPathFor(p.path)}>
          <strong>{p.name}</strong>
        </a>
        {p.npc && <span className="badge">NPC</span>}
        <div className="muted">{p.classes ?? ""}</div>
        <div className="chips">
          <span data-testid={`hp-${p.name}`}>
            HP {p.hp ? p.hp.current : "?"}
            {p.hp?.max !== undefined ? ` / ${p.hp.max}` : ""}
          </span>
          <span>AC {p.ac ?? "?"}</span>
        </div>
        <EffectChips person={p} now={now} {...(onEnd ? { onEnd } : {})} />
        <ConditionChips
          person={p}
          {...(tools ? { onRemove: tools.onRemove } : {})}
        />
        {tools?.add}
      </div>
    </li>
  );
}

function DmControls({
  id,
  uid,
  state,
  inEncounter,
  title,
  onTitle,
  onProblem,
}: {
  id: string;
  uid: string;
  state: PlayState;
  inEncounter: boolean;
  title: string;
  onTitle: (title: string) => void;
  onProblem: (message: string) => void;
}) {
  const now = clockParts(state.clock);
  const [day, setDay] = useState(String(now.day));
  const [time, setTime] = useState(
    `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`,
  );
  const [newTitle, setNewTitle] = useState(title);
  const [hh, mm] = time.split(":").map(Number);
  const next = clockFrom(Number(day), hh ?? NaN, mm ?? NaN);

  return (
    <section className="panel" aria-label="DM controls">
      <h2>Session controls</h2>
      {inEncounter ? (
        <p className="muted">
          During an encounter the clock moves six seconds a round.
        </p>
      ) : (
        <form
          className="chips"
          onSubmit={(e) => {
            e.preventDefault();
            if (next === undefined) return;
            void setClock(db, id, uid, state, next).then(
              (err) => err && onProblem(err),
            );
          }}
        >
          <label>
            Day{" "}
            <input
              type="number"
              min={1}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              aria-label="Day"
              style={{ width: 70 }}
            />
          </label>
          <label>
            Time{" "}
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Time of day"
            />
          </label>
          <button
            type="submit"
            className="secondary"
            disabled={next === undefined || next === state.clock}
          >
            Set the clock
          </button>
        </form>
      )}
      <form
        className="chips"
        style={{ marginTop: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          onTitle(newTitle);
        }}
      >
        <label>
          Scene title{" "}
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            aria-label="Scene title"
            placeholder="Untitled"
          />
        </label>
        <button
          type="submit"
          className="secondary"
          disabled={newTitle.trim() === title}
        >
          Save title
        </button>
      </form>
    </section>
  );
}

function Log({
  entries,
  name,
  canPost,
  onPost,
}: {
  entries: readonly LogEntry[];
  name: (uid: string) => string;
  canPost: boolean;
  onPost: (text: string) => Promise<string | undefined>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise here, which React would take for a cleanup.
    void end.current?.scrollIntoView({ block: "nearest" });
  }, [entries]);

  return (
    <section className="panel table-log" aria-label="Campaign log">
      <h2>Campaign log</h2>
      <ol className="log-list">
        {entries.map((e) => (
          <li key={e.id} className={`log-entry log-${e.kind}`}>
            <span className="muted log-time">{formatClock(e.clock)}</span>{" "}
            {e.kind === "post" ? (
              <>
                <strong>{name(e.by)}:</strong> {e.text}
              </>
            ) : (
              <em>{e.text}</em>
            )}
          </li>
        ))}
      </ol>
      <div ref={end} />
      {canPost && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSending(true);
            void onPost(text).then((err) => {
              setSending(false);
              setError(err);
              if (!err) setText("");
            });
          }}
        >
          <textarea
            aria-label="Write to the log"
            value={text}
            maxLength={LOG_TEXT_LIMIT}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" disabled={sending || !text.trim()}>
            Post
          </button>
          {error && <div className="error-box">{error}</div>}
        </form>
      )}
    </section>
  );
}
